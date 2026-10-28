import { describe, expect, it } from "vitest";
import { BUILTIN_WORKFLOW_MODELS, evaluateModelAvailability, getModelProfile } from "@/services/api/models";
import { isModelSupportedByHost } from "@/stores/use-config-store";
import type { ModelChannel } from "@/types/config";

describe("VideoModelPicker Data Contract & Hierarchy", () => {
    it("BUILTIN_WORKFLOW_MODELS only contains 4 FP8 models without BF16", () => {
        expect(BUILTIN_WORKFLOW_MODELS).toHaveLength(4);
        const ids = BUILTIN_WORKFLOW_MODELS.map((m) => m.id);
        expect(ids).toContain("omni-video-minimax-h3-fp8-4step-pdmd");
        expect(ids).toContain("omni-video-minimax-h3-fp8");
        expect(ids).toContain("frame-video-minimax-h3-fp8-4step-pdmd");
        expect(ids).toContain("frame-video-minimax-h3-fp8");

        // Ensure BF16 models are purged
        ids.forEach((id) => {
            expect(id).not.toContain("bf16");
        });
    });

    it("model profile names and VRAM tiers are human readable without raw IDs", () => {
        BUILTIN_WORKFLOW_MODELS.forEach((model) => {
            expect(model.name).not.toBe("video_minimax_h3_omni");
            expect(model.name).not.toBe("video_minimax_h3_frame");
            expect(model.vramTier).toBeDefined();
            expect(["8GB", "16GB", "24GB", "32GB"]).toContain(model.vramTier);
        });
    });

    it("all 4 video models define tags: [5, 10, 15] in capabilityConfig.duration for quick presets", () => {
        BUILTIN_WORKFLOW_MODELS.forEach((model) => {
            expect(model.capabilityConfig.duration).toBeDefined();
            expect(model.capabilityConfig.duration?.tags).toEqual([5, 10, 15]);
            expect(model.capabilityConfig.duration?.default).toBe(5);
            expect(model.capabilityConfig.duration?.min).toBe(1);
            expect(model.capabilityConfig.duration?.max).toBe(15);
        });
    });

    it("isModelSupportedByHost correctly flags supported vs unsupported models for hosts", () => {
        const hostWithOmniOnly: ModelChannel = {
            id: "host-rtx3060",
            name: "RTX 3060 8G 算力机",
            baseUrl: "http://192.168.1.100:8188",
            apiKey: "",
            apiFormat: "comfyui",
            models: [],
            supportedModelIds: ["omni-video-minimax-h3-fp8-4step-pdmd"],
        };

        expect(isModelSupportedByHost(hostWithOmniOnly, "omni-video-minimax-h3-fp8-4step-pdmd")).toBe(true);
        expect(isModelSupportedByHost(hostWithOmniOnly, "frame-video-minimax-h3-fp8-4step-pdmd")).toBe(false);
    });

    it("getModelProfile resolves both new canonical IDs and legacy aliases seamlessly", () => {
        const canonical = getModelProfile("omni-video-minimax-h3-fp8-4step-pdmd");
        expect(canonical).toBeDefined();
        expect(canonical?.id).toBe("omni-video-minimax-h3-fp8-4step-pdmd");

        const legacyOmni = getModelProfile("video_minimax_h3_omni");
        expect(legacyOmni?.id).toBe("omni-video-minimax-h3-fp8-4step-pdmd");

        const legacyFrame = getModelProfile("video_minimax_h3_frame");
        expect(legacyFrame?.id).toBe("frame-video-minimax-h3-fp8-4step-pdmd");
    });

    it("evaluates candidate model availability with image over-quota (Frame video disabled with 3 images)", () => {
        const frameModel = BUILTIN_WORKFLOW_MODELS.find((m) => m.category === "frameVideo")!;
        const omniModel = BUILTIN_WORKFLOW_MODELS.find((m) => m.category === "omniVideo")!;

        const frameCheck = evaluateModelAvailability({
            targetModel: frameModel,
            connectedImages: 3,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "",
        });
        expect(frameCheck.isAvailable).toBe(false);
        expect(frameCheck.reasons).toContain("已连接 3 张参考图，该模型最多支持 2 张");

        const omniCheck = evaluateModelAvailability({
            targetModel: omniModel,
            connectedImages: 3,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "",
        });
        expect(omniCheck.isAvailable).toBe(true);
        expect(omniCheck.reasons).toEqual([]);
    });

    it("evaluates candidate model availability with video connection (Frame video disabled)", () => {
        const frameModel = BUILTIN_WORKFLOW_MODELS.find((m) => m.category === "frameVideo")!;
        const check = evaluateModelAvailability({
            targetModel: frameModel,
            connectedImages: 2,
            connectedVideos: 1,
            connectedAudios: 0,
            promptText: "",
        });
        expect(check.isAvailable).toBe(false);
        expect(check.reasons).toContain("该模型不支持参考视频，当前已连接 1 个视频");
    });
});
