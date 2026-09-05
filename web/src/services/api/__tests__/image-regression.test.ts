import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestGeneration } from "@/services/api/image";
import * as comfyui from "@/services/api/comfyui";
import { defaultConfig, type AiConfig, type ModelChannel } from "@/stores/use-config-store";

vi.mock("@/services/api/comfyui", () => ({
    requestComfyuiImage: vi.fn(),
    ComfyuiNoWorkflowError: class ComfyuiNoWorkflowError extends Error {},
}));

const mockedRequestComfyuiImage = vi.mocked(comfyui.requestComfyuiImage);

function buildComfyUIConfig(): AiConfig {
    const channel: ModelChannel = {
        id: "comfy",
        name: "ComfyUI channel",
        baseUrl: "",
        apiKey: "",
        apiFormat: "comfyui",
        models: [
            { name: "ComfyUI T2I", capability: "image", comfyuiWorkflow: { name: "t2i", json: {}, createdAt: 0 } },
        ],
        comfyuiProxyUrl: "http://127.0.0.1:8189",
        comfyuiProxyToken: "tok",
    };
    return { ...defaultConfig, channels: [channel], model: "comfy::ComfyUI T2I", imageModel: "comfy::ComfyUI T2I", models: ["comfy::ComfyUI T2I"] };
}

describe("image.ts ComfyUI generation", () => {
    beforeEach(() => {
        mockedRequestComfyuiImage.mockReset();
    });

    it("single generation calls requestComfyuiImage once", async () => {
        mockedRequestComfyuiImage.mockResolvedValue({
            items: [{ id: "img1", dataUrl: "data:image/png;base64,aaa", seed: 123 }],
            jobId: "job-1",
            seed: 123,
        });
        const config = buildComfyUIConfig();
        const result = await requestGeneration(config, "a cat");
        expect(result).toHaveLength(1);
        expect(mockedRequestComfyuiImage).toHaveBeenCalledTimes(1);
    });

    it("batch generation (count = 3) calls requestComfyuiImage 3 times", async () => {
        mockedRequestComfyuiImage
            .mockResolvedValueOnce({ items: [{ id: "1", dataUrl: "data:1", seed: 1 }], jobId: "j1", seed: 1 })
            .mockResolvedValueOnce({ items: [{ id: "2", dataUrl: "data:2", seed: 2 }], jobId: "j2", seed: 2 })
            .mockResolvedValueOnce({ items: [{ id: "3", dataUrl: "data:3", seed: 3 }], jobId: "j3", seed: 3 });

        const config = { ...buildComfyUIConfig(), count: "3" };
        const result = await requestGeneration(config, "a cat");
        expect(result).toHaveLength(3);
        expect(mockedRequestComfyuiImage).toHaveBeenCalledTimes(3);
    });
});
