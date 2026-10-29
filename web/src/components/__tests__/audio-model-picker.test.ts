import { describe, expect, it } from "vitest";
import {
    audioMinimaxMusic3Profile,
    BUILTIN_AUDIO_WORKFLOW_MODELS,
    evaluateModelAvailability,
    getModelProfile,
} from "@/services/api/models";

describe("AudioModelPicker Data Contract & Unified MiniMax Music 03 Constraints", () => {
    it("BUILTIN_AUDIO_WORKFLOW_MODELS registers unified MiniMax Music 03 model", () => {
        expect(BUILTIN_AUDIO_WORKFLOW_MODELS).toHaveLength(1);
        const ids = BUILTIN_AUDIO_WORKFLOW_MODELS.map((m) => m.id);
        expect(ids).toContain("audio-minimax-music-3");
        expect(audioMinimaxMusic3Profile.capability).toBe("audio");
        expect(audioMinimaxMusic3Profile.durationOffset).toBe(1);
        expect(audioMinimaxMusic3Profile.capabilityConfig.references.minImages).toBe(0);
        expect(audioMinimaxMusic3Profile.capabilityConfig.references.maxImages).toBe(0);
        expect(audioMinimaxMusic3Profile.capabilityConfig.references.maxVideos).toBe(0);
        expect(audioMinimaxMusic3Profile.capabilityConfig.references.maxAudios).toBe(0);
        expect(audioMinimaxMusic3Profile.capabilityConfig.duration?.min).toBe(10);
        expect(audioMinimaxMusic3Profile.capabilityConfig.duration?.max).toBe(300);
        expect(audioMinimaxMusic3Profile.capabilityConfig.duration?.default).toBe(60);
        expect(audioMinimaxMusic3Profile.capabilityConfig.duration?.tags).toEqual([60, 120, 180]);
    });

    it("evaluates MiniMax Music 03 availability (pure text prompt with 0 media references)", () => {
        const check0 = evaluateModelAvailability({
            targetModel: audioMinimaxMusic3Profile,
            connectedImages: 0,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "赛博朋克风格的电子音乐，带有强劲的贝斯与合成器旋律",
        });
        expect(check0.isAvailable).toBe(true);
        expect(check0.isSelectable).toBe(true);
        expect(check0.reasons).toHaveLength(0);
    });

    it("evaluates media boundaries (rejects images, videos, audios)", () => {
        const checkImg = evaluateModelAvailability({
            targetModel: audioMinimaxMusic3Profile,
            connectedImages: 1,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "music prompt",
        });
        expect(checkImg.isAvailable).toBe(false);
        expect(checkImg.isSelectable).toBe(false);
        expect(checkImg.reasons).toContain("该模型不支持参考图，当前已连接 1 张图片");

        const checkVid = evaluateModelAvailability({
            targetModel: audioMinimaxMusic3Profile,
            connectedImages: 0,
            connectedVideos: 1,
            connectedAudios: 0,
            promptText: "music prompt",
        });
        expect(checkVid.isAvailable).toBe(false);
        expect(checkVid.isSelectable).toBe(false);
        expect(checkVid.reasons).toContain("该模型不支持参考视频，当前已连接 1 个视频");

        const checkAud = evaluateModelAvailability({
            targetModel: audioMinimaxMusic3Profile,
            connectedImages: 0,
            connectedVideos: 0,
            connectedAudios: 1,
            promptText: "music prompt",
        });
        expect(checkAud.isAvailable).toBe(false);
        expect(checkAud.isSelectable).toBe(false);
        expect(checkAud.reasons).toContain("该模型不支持参考音频，当前已连接 1 个音频");
    });

    it("evaluates prompt length limits (max 3000 chars)", () => {
        const checkLong = evaluateModelAvailability({
            targetModel: audioMinimaxMusic3Profile,
            connectedImages: 0,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "a".repeat(3001),
        });
        expect(checkLong.isAvailable).toBe(false);
        expect(checkLong.reasons[0]).toContain("3000");
    });

    it("evaluates host channel support rule for audio model", () => {
        const channelWithModels = {
            id: "host-1",
            name: "Host 1",
            baseUrl: "http://127.0.0.1:8188",
            apiKey: "",
            apiFormat: "comfyui" as const,
            models: [
                {
                    name: "MiniMax Music 03",
                    capability: "audio" as const,
                },
            ],
        };

        const checkSupported = evaluateModelAvailability({
            targetModel: audioMinimaxMusic3Profile,
            connectedImages: 0,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "valid prompt",
            activeChannel: channelWithModels,
        });
        expect(checkSupported.isSelectable).toBe(true);
    });

    it("getModelProfile resolves channel-prefixed model names and aliases", () => {
        expect(getModelProfile("audio-minimax-music-3")?.id).toBe("audio-minimax-music-3");
        expect(getModelProfile("builtin::MiniMax Music 03")?.id).toBe("audio-minimax-music-3");
        expect(getModelProfile("builtin::audio-minimax-music-3")?.id).toBe("audio-minimax-music-3");
        expect(getModelProfile("music")?.id).toBe("audio-minimax-music-3");
        expect(getModelProfile("audio")?.id).toBe("audio-minimax-music-3");
    });
});
