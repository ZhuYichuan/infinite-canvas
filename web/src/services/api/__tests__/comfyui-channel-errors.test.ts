import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComfyuiApiError, ComfyuiNetworkError, requestComfyuiAudio, requestComfyuiImage, requestComfyuiInpaint, requestComfyuiText, requestComfyuiVideo, resetComfyuiBatchPollers } from "@/services/api/comfyui";
import { defaultConfig, type AiConfig, type ModelChannel } from "@/stores/use-config-store";

vi.mock("localforage", () => ({
    default: { createInstance: () => ({ setItem: vi.fn(async () => undefined) }) },
}));

const WORKFLOW = {
    "1": { class_type: "PrimitiveStringMultiline", inputs: { value: "" }, _meta: { title: "prompt" } },
};
const CHANNEL_NAME = "第二台 ComfyUI";

function buildConfig(): AiConfig {
    const workflow = { name: "custom", json: WORKFLOW, createdAt: 0 };
    const channel: ModelChannel = {
        id: "selected",
        name: CHANNEL_NAME,
        baseUrl: "",
        apiKey: "",
        apiFormat: "comfyui",
        models: [],
        comfyuiProxyUrl: "http://127.0.0.1:8188",
        comfyuiT2iWorkflow: workflow,
        comfyuiInpaintWorkflow: workflow,
        comfyuiTextWorkflow: workflow,
        comfyuiVideoWorkflow: workflow,
        comfyuiAudioWorkflow: workflow,
    };
    return {
        ...defaultConfig,
        channels: [{ ...channel, id: "other", name: "其他渠道" }, channel],
        model: "selected::custom",
        imageModel: "selected::custom",
        textModel: "selected::custom",
        videoModel: "selected::custom",
        audioModel: "selected::custom",
    };
}

const requests = {
    image: (config: AiConfig) => requestComfyuiImage({ config, model: config.model, prompt: "test" }),
    inpaint: (config: AiConfig) => requestComfyuiInpaint({ config, prompt: "test", sourceDataUrl: "data:image/png;base64,AA==", maskDataUrl: "data:image/png;base64,AA==" }),
    text: (config: AiConfig) => requestComfyuiText({ config, prompt: "test" }),
    video: (config: AiConfig) => requestComfyuiVideo({ config, prompt: "test" }),
    videoUpload: (config: AiConfig) => requestComfyuiVideo({ config, prompt: "test", references: [{ id: "reference", name: "reference.png", type: "image/png", dataUrl: "data:image/png;base64,AA==" }] }),
    audio: (config: AiConfig) => requestComfyuiAudio({ config, prompt: "test", duration: 60 }),
};

describe("ComfyUI generation channel error context", () => {
    beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
    afterEach(() => {
        resetComfyuiBatchPollers();
        vi.unstubAllGlobals();
    });

    it("keeps channel names independent for a shared job's batched history failure", async () => {
        vi.mocked(fetch).mockImplementation(async (input) => new Response(null, {
            status: String(input).endsWith("/queue") ? 404 : 503,
        }));
        const config = buildConfig();
        const errors = await Promise.all(["other::custom", "selected::custom"].map((model) =>
            requestComfyuiImage({ config, model, prompt: "test", jobId: "shared-job" }).catch((error) => error),
        ));
        expect(errors[0]).toBeInstanceOf(ComfyuiApiError);
        expect(errors[1]).toBeInstanceOf(ComfyuiApiError);
        expect(errors[0].message).toContain("渠道「其他渠道」");
        expect(errors[0].message).not.toContain(CHANNEL_NAME);
        expect(errors[1].message).toContain(`渠道「${CHANNEL_NAME}」`);
        expect(errors[1].message).not.toContain("其他渠道");
        expect(errors[1].message).toContain("GET http://127.0.0.1:8188/history/shared-job");
        expect(errors[0]).not.toBe(errors[1]);
    });

    for (const [kind, request] of Object.entries(requests)) {
        for (const failure of ["network", "http"] as const) {
            it(`${kind} identifies the actual selected channel on ${failure} failure, including channels sharing a URL`, async () => {
                vi.mocked(fetch).mockImplementation(async (input) => {
                    if (String(input).startsWith("data:")) return new Response(new Blob(["image"]));
                    if (failure === "network") throw new TypeError("Failed to fetch");
                    return new Response(JSON.stringify({ error: { message: "服务不可用" } }), { status: 503 });
                });

                const error = await request(buildConfig()).catch((caught: unknown) => caught);
                expect(error).toBeInstanceOf(failure === "network" ? ComfyuiNetworkError : ComfyuiApiError);
                expect((error as Error).message).toContain(CHANNEL_NAME);
                expect((error as Error).message).not.toContain("其他渠道");
                expect((error as Error).message.split(CHANNEL_NAME)).toHaveLength(2);
                if (failure === "http") expect(error).toMatchObject({ status: 503 });
            });
        }
    }
});
