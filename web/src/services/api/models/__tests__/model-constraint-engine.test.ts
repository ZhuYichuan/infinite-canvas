import { describe, expect, it } from "vitest";
import {
    evaluateModelAvailability,
    HostSupportRule,
    ImageQuotaRule,
    VideoQuotaRule,
    AudioQuotaRule,
    PromptLengthRule,
    type ConstraintContext,
} from "../constraint-engine";
import {
    videoMinimaxH3OmniFp8PdmdProfile,
    videoMinimaxH3FrameFp8PdmdProfile,
    imageQwenInpaintProfile,
} from "../index";
import type { ModelChannel } from "@/types/config";

describe("Model Constraint Engine (Specification Pattern)", () => {
    const baseHost: ModelChannel = {
        id: "channel-1",
        name: "本地 3090 算力主机",
        baseUrl: "http://127.0.0.1:8188",
        apiKey: "",
        apiFormat: "comfyui",
        models: [],
        supportedModelIds: ["omni-video-minimax-h3-fp8-4step-pdmd"],
    };

    it("passes evaluation when all constraints are satisfied", () => {
        const ctx: ConstraintContext = {
            targetModel: videoMinimaxH3OmniFp8PdmdProfile,
            connectedImages: 3,
            connectedVideos: 1,
            connectedAudios: 1,
            promptText: "A cinematic scene",
            activeChannel: baseHost,
        };

        const result = evaluateModelAvailability(ctx);
        expect(result.isAvailable).toBe(true);
        expect(result.reasons).toEqual([]);
    });

    describe("HostSupportRule", () => {
        const rule = new HostSupportRule();

        it("fails when model is not supported by active host", () => {
            const ctx: ConstraintContext = {
                targetModel: videoMinimaxH3FrameFp8PdmdProfile, // not in baseHost.supportedModelIds
                connectedImages: 2,
                connectedVideos: 0,
                connectedAudios: 0,
                promptText: "",
                activeChannel: baseHost,
            };

            const result = rule.check(ctx);
            expect(result.passed).toBe(false);
            expect(result.reason).toContain("未启用该模型支持");
        });

        it("passes when active host has no supportedModelIds restriction (all allowed)", () => {
            const openHost: ModelChannel = { ...baseHost, supportedModelIds: [] };
            const ctx: ConstraintContext = {
                targetModel: videoMinimaxH3FrameFp8PdmdProfile,
                connectedImages: 2,
                connectedVideos: 0,
                connectedAudios: 0,
                promptText: "",
                activeChannel: openHost,
            };

            expect(rule.check(ctx).passed).toBe(true);
        });
    });

    describe("ImageQuotaRule", () => {
        const rule = new ImageQuotaRule();

        it("detects when connected images exceed model maxImages", () => {
            // Frame model strictly supports 2 images
            const ctx: ConstraintContext = {
                targetModel: videoMinimaxH3FrameFp8PdmdProfile,
                connectedImages: 3,
                connectedVideos: 0,
                connectedAudios: 0,
                promptText: "",
            };

            const result = rule.check(ctx);
            expect(result.passed).toBe(false);
            expect(result.reason).toBe("已连接 3 张参考图，该模型最多支持 2 张");
        });

        it("detects when connected images are less than model minImages", () => {
            // Frame model requires at least 2 images
            const ctx: ConstraintContext = {
                targetModel: videoMinimaxH3FrameFp8PdmdProfile,
                connectedImages: 1,
                connectedVideos: 0,
                connectedAudios: 0,
                promptText: "",
            };

            const result = rule.check(ctx);
            expect(result.passed).toBe(false);
            expect(result.reason).toBe("该模型至少需要 2 张参考图，当前仅连接 1 张");
        });

        it("passes when connected images is within allowed range", () => {
            const ctx: ConstraintContext = {
                targetModel: videoMinimaxH3OmniFp8PdmdProfile, // supports 0~9 images
                connectedImages: 5,
                connectedVideos: 0,
                connectedAudios: 0,
                promptText: "",
            };

            expect(rule.check(ctx).passed).toBe(true);
        });

        it("strictly enforces exactly 2 images for inpaint (base + mask)", () => {
            const checkCount = (count: number) => rule.check({
                targetModel: imageQwenInpaintProfile,
                connectedImages: count,
                connectedVideos: 0,
                connectedAudios: 0,
                promptText: "",
            });

            expect(checkCount(0).passed).toBe(false);
            expect(checkCount(0).reason).toBe("该模型需要两张参考图（一张原图 + 一张蒙版），当前已连接 0 张");

            expect(checkCount(1).passed).toBe(false);
            expect(checkCount(1).reason).toBe("该模型需要两张参考图（一张原图 + 一张蒙版），当前已连接 1 张");

            expect(checkCount(2).passed).toBe(true);

            expect(checkCount(3).passed).toBe(false);
            expect(checkCount(3).reason).toBe("该模型需要两张参考图（一张原图 + 一张蒙版），当前已连接 3 张");
        });
    });

    describe("VideoQuotaRule", () => {
        const rule = new VideoQuotaRule();

        it("rejects when model forbids video references (maxVideos = 0) but video is connected", () => {
            // Frame model does not support video references (maxVideos: 0)
            const ctx: ConstraintContext = {
                targetModel: videoMinimaxH3FrameFp8PdmdProfile,
                connectedImages: 2,
                connectedVideos: 1,
                connectedAudios: 0,
                promptText: "",
            };

            const result = rule.check(ctx);
            expect(result.passed).toBe(false);
            expect(result.reason).toBe("该模型不支持参考视频，当前已连接 1 个视频");
        });

        it("rejects when connected videos exceed maxVideos", () => {
            // Omni model supports up to 3 videos
            const ctx: ConstraintContext = {
                targetModel: videoMinimaxH3OmniFp8PdmdProfile,
                connectedImages: 1,
                connectedVideos: 4,
                connectedAudios: 0,
                promptText: "",
            };

            const result = rule.check(ctx);
            expect(result.passed).toBe(false);
            expect(result.reason).toBe("已连接 4 个参考视频，该模型最多支持 3 个");
        });
    });

    describe("AudioQuotaRule", () => {
        const rule = new AudioQuotaRule();

        it("rejects when model forbids audio references (maxAudios = 0) but audio is connected", () => {
            // Frame model does not support audio references (maxAudios: 0)
            const ctx: ConstraintContext = {
                targetModel: videoMinimaxH3FrameFp8PdmdProfile,
                connectedImages: 2,
                connectedVideos: 0,
                connectedAudios: 1,
                promptText: "",
            };

            const result = rule.check(ctx);
            expect(result.passed).toBe(false);
            expect(result.reason).toBe("该模型不支持参考音频，当前已连接 1 个音频");
        });

        it("rejects when connected audios exceed maxAudios", () => {
            // Omni model supports up to 3 audios
            const ctx: ConstraintContext = {
                targetModel: videoMinimaxH3OmniFp8PdmdProfile,
                connectedImages: 1,
                connectedVideos: 0,
                connectedAudios: 4,
                promptText: "",
            };

            const result = rule.check(ctx);
            expect(result.passed).toBe(false);
            expect(result.reason).toBe("已连接 4 个参考音频，该模型最多支持 3 个");
        });
    });

    describe("PromptLengthRule", () => {
        const rule = new PromptLengthRule();

        it("rejects when prompt length exceeds promptMaxChars", () => {
            const maxChars = videoMinimaxH3OmniFp8PdmdProfile.capabilityConfig.references?.promptMaxChars || 2000;
            const longPrompt = "a".repeat(maxChars + 5);
            const ctx: ConstraintContext = {
                targetModel: videoMinimaxH3OmniFp8PdmdProfile,
                connectedImages: 0,
                connectedVideos: 0,
                connectedAudios: 0,
                promptText: longPrompt,
            };

            const result = rule.check(ctx);
            expect(result.passed).toBe(false);
            expect(result.reason).toBe(`提示词字数 (${maxChars + 5}) 超出该模型上限 (${maxChars} 字符)`);
        });

        it("passes when prompt is within promptMaxChars", () => {
            const ctx: ConstraintContext = {
                targetModel: videoMinimaxH3OmniFp8PdmdProfile,
                connectedImages: 0,
                connectedVideos: 0,
                connectedAudios: 0,
                promptText: "Valid prompt under limit",
            };

            expect(rule.check(ctx).passed).toBe(true);
        });
    });

    describe("evaluateModelAvailability with multiple violations", () => {
        it("collects all diagnostic reasons when multiple rules fail simultaneously", () => {
            const maxChars = videoMinimaxH3FrameFp8PdmdProfile.capabilityConfig.references?.promptMaxChars || 2000;
            const ctx: ConstraintContext = {
                targetModel: videoMinimaxH3FrameFp8PdmdProfile,
                connectedImages: 5,        // exceeds maxImages: 2
                connectedVideos: 1,        // forbids videos
                connectedAudios: 1,        // forbids audios
                promptText: "x".repeat(maxChars + 100), // exceeds promptMaxChars
                activeChannel: baseHost,   // does not support frame model
            };

            const result = evaluateModelAvailability(ctx);
            expect(result.isAvailable).toBe(false);
            expect(result.reasons).toHaveLength(5);
            expect(result.reasons).toContain("当前主机「本地 3090 算力主机」未启用该模型支持");
            expect(result.reasons).toContain("已连接 5 张参考图，该模型最多支持 2 张");
            expect(result.reasons).toContain("该模型不支持参考视频，当前已连接 1 个视频");
            expect(result.reasons).toContain("该模型不支持参考音频，当前已连接 1 个音频");
            expect(result.reasons).toContain(`提示词字数 (${maxChars + 100}) 超出该模型上限 (${maxChars} 字符)`);
        });
    });
});
