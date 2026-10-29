import { describe, expect, it } from "vitest";
import {
    audioMinimaxMusic3Profile,
    BUILTIN_AUDIO_WORKFLOW_MODELS,
    BUILTIN_WORKFLOW_MODELS,
    dispatchComfyuiModelWorkflow,
    getModelProfile,
    listModelsByCapability,
    parseAudioPrompt,
} from "../index";
import { isModelSupportedByHost, type ModelChannel } from "@/stores/use-config-store";

describe("Audio Workflow Model DSL & Dispatcher", () => {
    describe("audioMinimaxMusic3Profile definition", () => {
        it("declares standard audio model metadata", () => {
            expect(audioMinimaxMusic3Profile.id).toBe("audio-minimax-music-3");
            expect(audioMinimaxMusic3Profile.capability).toBe("audio");
            expect(audioMinimaxMusic3Profile.category).toBe("audio");
            expect(audioMinimaxMusic3Profile.protocol).toBe("comfyui");
            expect(audioMinimaxMusic3Profile.durationOffset).toBe(1);
        });

        it("defines duration bounds and quick tags in capabilityConfig", () => {
            const dur = audioMinimaxMusic3Profile.capabilityConfig.duration;
            expect(dur?.selection).toBe("range");
            expect(dur?.min).toBe(10);
            expect(dur?.max).toBe(300);
            expect(dur?.default).toBe(60);
            expect(dur?.tags).toEqual([60, 120, 180]);
        });

        it("forbids image, video, and audio reference inputs in capabilityConfig", () => {
            const refs = audioMinimaxMusic3Profile.capabilityConfig.references;
            expect(refs.minImages).toBe(0);
            expect(refs.maxImages).toBe(0);
            expect(refs.minVideos).toBe(0);
            expect(refs.maxVideos).toBe(0);
            expect(refs.maxAudios).toBe(0);
        });

        it("is registered in BUILTIN_AUDIO_WORKFLOW_MODELS and BUILTIN_WORKFLOW_MODELS", () => {
            expect(BUILTIN_AUDIO_WORKFLOW_MODELS).toContain(audioMinimaxMusic3Profile);
            expect(BUILTIN_WORKFLOW_MODELS).toContain(audioMinimaxMusic3Profile);
            const audioModels = listModelsByCapability("audio");
            expect(audioModels).toContain(audioMinimaxMusic3Profile);
        });
    });

    describe("getModelProfile resolution for audio", () => {
        it("resolves exact id audio-minimax-music-3", () => {
            expect(getModelProfile("audio-minimax-music-3")).toBe(audioMinimaxMusic3Profile);
        });

        it("resolves historical and simplified audio aliases", () => {
            expect(getModelProfile("minimax_music_3")).toBe(audioMinimaxMusic3Profile);
            expect(getModelProfile("minimax-music")).toBe(audioMinimaxMusic3Profile);
            expect(getModelProfile("music")).toBe(audioMinimaxMusic3Profile);
            expect(getModelProfile("audio")).toBe(audioMinimaxMusic3Profile);
        });
    });

    describe("parseAudioPrompt helper", () => {
        it("returns empty caption and lyrics for empty input", () => {
            expect(parseAudioPrompt("")).toEqual({ caption: "", lyrics: "" });
            expect(parseAudioPrompt("   ")).toEqual({ caption: "", lyrics: "" });
        });

        it("treats plain text as caption with empty lyrics", () => {
            const result = parseAudioPrompt("90年代怀旧粤语流行乐，温暖吉他配弦乐");
            expect(result).toEqual({
                caption: "90年代怀旧粤语流行乐，温暖吉他配弦乐",
                lyrics: "",
            });
        });

        it("parses structured [caption] and [lyrics] tags", () => {
            const raw = "[caption] 欢快的流行摇滚 [lyrics] 第一段歌词\n第二段歌词";
            const result = parseAudioPrompt(raw);
            expect(result.caption).toBe("欢快的流行摇滚");
            expect(result.lyrics).toBe("第一段歌词\n第二段歌词");
        });
    });

    describe("dispatchComfyuiModelWorkflow for Audio", () => {
        const mockRawWorkflow = {
            "44": {
                inputs: { value: "" },
                class_type: "PrimitiveStringMultiline",
                _meta: { title: "caption" },
            },
            "45": {
                inputs: { value: "" },
                class_type: "PrimitiveStringMultiline",
                _meta: { title: "lyrics" },
            },
            "46": {
                inputs: { value: 0 },
                class_type: "PrimitiveInt",
                _meta: { title: "seed" },
            },
            "47": {
                inputs: { Number: "0" },
                class_type: "Float",
                _meta: { title: "duration" },
            },
            "1": {
                inputs: {},
                class_type: "SaveAudioAdvanced",
                _meta: { title: "output_audio" },
            },
        };

        it("dispatches prompt, caption, seed, and automatically applies +1s hardware offset to duration", () => {
            const dispatched = dispatchComfyuiModelWorkflow(
                audioMinimaxMusic3Profile,
                mockRawWorkflow,
                {
                    prompt: "欢快的民谣吉他",
                    duration: 60,
                    seed: 42,
                },
            );

            const n44 = (dispatched as any)["44"].inputs;
            const n45 = (dispatched as any)["45"].inputs;
            const n46 = (dispatched as any)["46"].inputs;
            const n47 = (dispatched as any)["47"].inputs;

            expect(n44.value).toBe("欢快的民谣吉他");
            expect(n45.value).toBe("");
            expect(n46.value).toBe(42);
            // 60s + 1s hardware compensation = 61s
            expect(n47.Number).toBe("61");
        });

        it("dispatches structured lyrics and caption when provided in prompt", () => {
            const dispatched = dispatchComfyuiModelWorkflow(
                audioMinimaxMusic3Profile,
                mockRawWorkflow,
                {
                    prompt: "[caption] 治愈系钢琴 [lyrics] 远方的微光 照亮了夜",
                    duration: 120,
                    seed: 12345,
                },
            );

            const n44 = (dispatched as any)["44"].inputs;
            const n45 = (dispatched as any)["45"].inputs;
            const n47 = (dispatched as any)["47"].inputs;

            expect(n44.value).toBe("治愈系钢琴");
            expect(n45.value).toBe("远方的微光 照亮了夜");
            // 120s + 1s = 121s
            expect(n47.Number).toBe("121");
        });

        it("fails loudly if duration is below min (10s) or above max (300s)", () => {
            expect(() =>
                dispatchComfyuiModelWorkflow(audioMinimaxMusic3Profile, mockRawWorkflow, {
                    prompt: "test",
                    duration: 5,
                }),
            ).toThrow("音频时长必须在 10 ~ 300 秒之间");

            expect(() =>
                dispatchComfyuiModelWorkflow(audioMinimaxMusic3Profile, mockRawWorkflow, {
                    prompt: "test",
                    duration: 350,
                }),
            ).toThrow("音频时长必须在 10 ~ 300 秒之间");
        });

        it("fails loudly if unauthorized images or videos are provided", () => {
            expect(() =>
                dispatchComfyuiModelWorkflow(audioMinimaxMusic3Profile, mockRawWorkflow, {
                    prompt: "test",
                    duration: 60,
                    assetIds: ["unwanted.png"],
                }),
            ).toThrow("最多支持 0 张参考图片");
        });
    });

    describe("Host support check for audio", () => {
        it("returns true for channel explicitly declaring audio-minimax-music-3", () => {
            const channel: ModelChannel = {
                id: "chan-1",
                name: "Test",
                baseUrl: "",
                apiKey: "",
                apiFormat: "comfyui",
                models: [],
                supportedModelIds: ["audio-minimax-music-3", "image-qwen-2.1"],
            };
            expect(isModelSupportedByHost(channel, "audio-minimax-music-3")).toBe(true);
        });

        it("returns true out-of-the-box when host has not configured any explicit audio models", () => {
            const legacyChannel: ModelChannel = {
                id: "chan-legacy",
                name: "Legacy Video Host",
                baseUrl: "",
                apiKey: "",
                apiFormat: "comfyui",
                models: [],
                supportedModelIds: ["omni-video-minimax-h3-fp8-4step-pdmd"],
            };
            // Should pass because host has no audio models configured yet
            expect(isModelSupportedByHost(legacyChannel, "audio-minimax-music-3")).toBe(true);
        });

        it("returns false when host explicitly declares another audio model but excludes audio-minimax-music-3", () => {
            const exclusiveChannel: ModelChannel = {
                id: "chan-other",
                name: "Other Audio Host",
                baseUrl: "",
                apiKey: "",
                apiFormat: "comfyui",
                models: [],
                supportedModelIds: ["audio-other-custom", "image-qwen-2.1"],
            };
            expect(isModelSupportedByHost(exclusiveChannel, "audio-minimax-music-3")).toBe(false);
        });
    });
});
