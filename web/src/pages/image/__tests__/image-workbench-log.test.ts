import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestGeneration } from "@/services/api/image";
import { defaultConfig, type AiConfig, type ModelChannel } from "@/stores/use-config-store";

// Shared in-memory store for localforage instances of "image_generation_logs"
const storeMap = new Map<string, unknown>();

vi.mock("localforage", () => ({
    default: {
        createInstance: (options: { name?: string; storeName?: string }) => {
            if (options?.storeName === "image_generation_logs") {
                return {
                    setItem: vi.fn(async (key: string, value: unknown) => {
                        storeMap.set(key, value);
                    }),
                    getItem: vi.fn(async (key: string) => storeMap.get(key) ?? null),
                    removeItem: vi.fn(async (key: string) => {
                        storeMap.delete(key);
                    }),
                    iterate: vi.fn(async (callback: (val: unknown, key: string) => void) => {
                        for (const [key, val] of storeMap.entries()) {
                            callback(val, key);
                        }
                    }),
                };
            }
            return {
                setItem: vi.fn(async () => undefined),
                getItem: vi.fn(async () => null),
                removeItem: vi.fn(async () => undefined),
                iterate: vi.fn(async () => undefined),
            };
        },
    },
}));

vi.mock("@/services/image-storage", () => ({
    uploadImage: vi.fn(async (url: string) => ({
        url,
        storageKey: "mock-storage-key",
        width: 512,
        height: 512,
        bytes: 1024,
        mimeType: "image/png",
    })),
    resolveImageUrl: vi.fn(async (_key: string, url: string) => url),
    deleteStoredImages: vi.fn(async () => undefined),
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

describe("Image Workbench generation logs (Issue #18 regression)", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        storeMap.clear();
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    it("writes exactly one log entry when image workbench executes a generation with skipLog: true", async () => {
        fetchMock.mockImplementation(nativeFlowWith("succeeded"));

        // 1. Image workbench calls requestGeneration with { skipLog: true }
        const config = buildComfyuiConfig();
        const results = await requestGeneration(config, "1个女生", { skipLog: true });

        expect(results.length).toBe(1);
        // Underlying ComfyUI service should NOT have logged to storeMap
        expect(storeMap.size).toBe(0);

        // 2. Image workbench then calls saveLog(buildLog(...)) as in pages/image/index.tsx L198
        const localforage = (await import("localforage")).default;
        const logStore = localforage.createInstance({ name: "infinite-canvas", storeName: "image_generation_logs" });

        const workbenchLog = {
            id: "workbench-nanoid-1",
            createdAt: Date.now(),
            title: "1个女生",
            prompt: "1个女生",
            model: "comfy::ComfyUI T2I",
            config: { model: "comfy::ComfyUI T2I", count: "1" },
            references: [],
            durationMs: 1200,
            successCount: 1,
            failCount: 0,
            status: "success",
            images: results,
        };
        await logStore.setItem(workbenchLog.id, workbenchLog);

        // Exactly 1 log entry in storeMap
        expect(storeMap.size).toBe(1);
        expect(storeMap.get("workbench-nanoid-1")).toEqual(workbenchLog);
    });
});
