import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestComfyuiImage } from "@/services/api/comfyui";
import { defaultConfig, type AiConfig, type ModelChannel } from "@/stores/use-config-store";

const { comfyuiLogStore } = vi.hoisted(() => ({
    comfyuiLogStore: {
        setItem: vi.fn(async (_key: string, _value: unknown) => undefined),
    },
}));

vi.mock("localforage", () => ({
    default: {
        createInstance: () => comfyuiLogStore,
    },
}));

const FULL_FLOW_WORKFLOW = {
    "1": { inputs: { text: "" }, class_type: "CLIPTextEncode", _meta: { title: "prompt" } },
    "2": { inputs: { value: 512 }, class_type: "PrimitiveInt", _meta: { title: "width" } },
    "3": { inputs: { value: 512 }, class_type: "PrimitiveInt", _meta: { title: "height" } },
};

function buildComfyuiConfig(): AiConfig {
    const channel: ModelChannel = {
        id: "comfy",
        name: "ComfyUI channel",
        baseUrl: "",
        apiKey: "",
        apiFormat: "comfyui",
        models: [{ name: "ComfyUI T2I", capability: "image", comfyuiWorkflow: { name: "t2i", json: FULL_FLOW_WORKFLOW, createdAt: 0 } }],
        comfyuiProxyUrl: "http://127.0.0.1:8188",
        comfyuiProxyToken: "tok",
    };
    return { ...defaultConfig, channels: [channel], model: "comfy::ComfyUI T2I", imageModel: "comfy::ComfyUI T2I", models: ["comfy::ComfyUI T2I"] };
}

function nativeFlowWith(jobStatus: string) {
    const png = new Blob(["fake-png"], { type: "image/png" });
    return (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";
        if (method === "POST" && url.endsWith("/prompt")) return { ok: true, status: 200, json: async () => ({ prompt_id: "job_1" }) };
        if (method === "GET" && url.endsWith("/history/job_1")) {
            if (jobStatus === "succeeded") {
                return { ok: true, status: 200, json: async () => ({ job_1: { status: { status_str: "success", completed: true }, outputs: { "4": { images: [{ filename: "prompt_out.png", subfolder: "", type: "output" }] } } } }) };
            }
            return { ok: true, status: 200, json: async () => ({ job_1: { status: { status_str: "error", messages: ["boom"] } } }) };
        }
        if (method === "GET" && url.includes("/api/view?")) return { ok: true, status: 200, blob: async () => png };
        return { ok: false, status: 500, json: async () => ({}) };
    };
}

describe("image_generation_logs provider field (T19 AC 8)", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        comfyuiLogStore.setItem.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("writes a ComfyUI log entry tagged with provider: 'comfyui' on success", async () => {
        fetchMock.mockImplementation(nativeFlowWith("succeeded"));
        await expect(requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "a cat" })).resolves.toMatchObject({ jobId: "job_1" });
        expect(comfyuiLogStore.setItem).toHaveBeenCalledTimes(1);
        const [, record] = comfyuiLogStore.setItem.mock.calls[0] as [string, Record<string, unknown>];
        expect(record.provider).toBe("comfyui");
        expect(record.status).toBe("success");
    });

    it("writes a ComfyUI log entry tagged with provider: 'comfyui' on failure", async () => {
        fetchMock.mockImplementation(nativeFlowWith("failed"));
        await expect(requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "a cat" })).rejects.toBeDefined();
        expect(comfyuiLogStore.setItem).toHaveBeenCalledTimes(1);
        const [, record] = comfyuiLogStore.setItem.mock.calls[0] as [string, Record<string, unknown>];
        expect(record.provider).toBe("comfyui");
        expect(record.status).toBe("failed");
    });
});
