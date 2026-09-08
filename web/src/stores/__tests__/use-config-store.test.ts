import { describe, expect, it } from "vitest";

import { COMFYUI_DEFAULT_MODELS, createModelChannel, defaultConfig, isAiConfigReady, normalizeApiFormat, normalizeChannelModels, resolveModelChannel, resolveModelRequestConfig, useConfigStore, type AiConfig, type ModelChannel } from "@/stores/use-config-store";

describe("COMFYUI_DEFAULT_MODELS", () => {
    it("pre-provisions the default ComfyUI models", () => {
        expect(COMFYUI_DEFAULT_MODELS.map((model) => model.name)).toEqual([
            "ComfyUI T2I",
            "ComfyUI I2I",
            "ComfyUI Inpaint",
            "ComfyUI LLM",
            "ComfyUI Video",
            "ComfyUI Frame Video",
        ]);
    });
});

describe("createModelChannel", () => {
    it("pre-provisions the default models for a new ComfyUI channel without models", () => {
        const channel = createModelChannel();
        expect(channel.apiFormat).toBe("comfyui");
        expect(channel.models.map((model) => model.name)).toEqual(COMFYUI_DEFAULT_MODELS.map((model) => model.name));
    });

    it("keeps an explicit model list instead of pre-provisioning", () => {
        const channel = createModelChannel({ models: [{ name: "My Workflow", capability: "image" }] });
        expect(channel.models.map((model) => model.name)).toEqual(["My Workflow"]);
    });

    it("does not pre-provision when the option is disabled (load path)", () => {
        const channel = createModelChannel({}, { preprovisionComfyuiModels: false });
        expect(channel.models).toEqual([]);
    });
});

describe("normalizeChannelModels", () => {
    it("normalizes string entries with a guessed capability and dedupes by name", () => {
        expect(normalizeChannelModels(["ComfyUI T2I", "ComfyUI T2I", "Custom T2I"])).toEqual([
            { name: "ComfyUI T2I", capability: "image", script: undefined, comfyuiWorkflow: undefined },
            { name: "Custom T2I", capability: "image", script: undefined, comfyuiWorkflow: undefined },
        ]);
    });
});

describe("normalizeApiFormat", () => {
    it("always returns comfyui", () => {
        expect(normalizeApiFormat("gemini")).toBe("comfyui");
        expect(normalizeApiFormat("comfyui")).toBe("comfyui");
        expect(normalizeApiFormat("openai")).toBe("comfyui");
        expect(normalizeApiFormat(undefined)).toBe("comfyui");
    });
});

describe("isAiConfigReady", () => {
    const comfyuiChannel = (overrides: Partial<{ comfyuiProxyUrl: string; comfyuiProxyToken: string }> = {}) =>
        createModelChannel({ baseUrl: "", apiKey: "", models: [], comfyuiProxyUrl: "http://127.0.0.1:8188", comfyuiProxyToken: "secret", ...overrides });

    it("returns true when at least one ComfyUI channel has proxy URL", () => {
        const config: AiConfig = { ...defaultConfig, channels: [comfyuiChannel()] };
        expect(isAiConfigReady(config, "any::model")).toBe(true);
    });

    it("returns false when a ComfyUI channel is missing the proxy URL", () => {
        const config: AiConfig = { ...defaultConfig, channels: [comfyuiChannel({ comfyuiProxyUrl: "" })] };
        expect(isAiConfigReady(config, "any::model")).toBe(false);
    });

    it("returns true when proxy token is empty for native ComfyUI", () => {
        const config: AiConfig = { ...defaultConfig, channels: [comfyuiChannel({ comfyuiProxyToken: "" })] };
        expect(isAiConfigReady(config, "any::model")).toBe(true);
    });

    it("returns false when the model string is empty even if channels are ready", () => {
        const config: AiConfig = { ...defaultConfig, channels: [comfyuiChannel()] };
        expect(isAiConfigReady(config, "")).toBe(false);
    });

    it("is also exposed on the store under the same signature", () => {
        const config: AiConfig = { ...defaultConfig, channels: [comfyuiChannel()] };
        expect(useConfigStore.getState().isAiConfigReady(config, "any::model")).toBe(true);
    });
});

describe("ComfyUI model resolution", () => {
    const comfyChannel: ModelChannel = {
        id: "comfy",
        name: "ComfyUI",
        baseUrl: "",
        apiKey: "",
        apiFormat: "comfyui",
        models: [{ name: "ComfyUI T2I", capability: "image", comfyuiWorkflow: { name: "t2i", json: {}, createdAt: 0 } }],
        comfyuiProxyUrl: "http://127.0.0.1:8189",
        comfyuiProxyToken: "tok",
    };
    const config: AiConfig = { ...defaultConfig, channels: [comfyChannel] };

    it("resolves a ComfyUI model to the ComfyUI channel", () => {
        const resolved = resolveModelRequestConfig(config, "comfy::ComfyUI T2I");
        expect(resolved.apiFormat).toBe("comfyui");
        expect(resolved.model).toBe("ComfyUI T2I");
        expect(resolved.baseUrl).toBe("http://127.0.0.1:8189");
    });

    it("resolves multiple ComfyUI channels to their respective IP addresses", () => {
        const channel1: ModelChannel = {
            id: "channel-1",
            name: "ComfyUI 1",
            baseUrl: "",
            apiKey: "",
            apiFormat: "comfyui",
            models: [{ name: "ComfyUI Video", capability: "video" }],
            comfyuiProxyUrl: "http://127.0.0.1:8188",
        };
        const channel2: ModelChannel = {
            id: "channel-2",
            name: "ComfyUI 2",
            baseUrl: "",
            apiKey: "",
            apiFormat: "comfyui",
            models: [{ name: "ComfyUI Video", capability: "video" }],
            comfyuiProxyUrl: "http://192.168.1.200:8188",
        };
        const cfg: AiConfig = { ...defaultConfig, channels: [channel1, channel2] };

        const res1 = resolveModelChannel(cfg, "channel-1::ComfyUI Video");
        expect(res1.id).toBe("channel-1");
        expect(res1.comfyuiProxyUrl).toBe("http://127.0.0.1:8188");

        const res2 = resolveModelChannel(cfg, "channel-2::ComfyUI Video");
        expect(res2.id).toBe("channel-2");
        expect(res2.comfyuiProxyUrl).toBe("http://192.168.1.200:8188");
    });
});

describe("persistence merge stability", () => {
    it("preserves custom workflows and proxy URL across merge", () => {
        const customT2i = { name: "custom-t2i.json", json: { test: 1 }, createdAt: 100 };
        const customChannel: ModelChannel = createModelChannel({
            id: "default",
            name: "My ComfyUI",
            comfyuiProxyUrl: "http://192.168.1.50:8188",
            comfyuiT2iWorkflow: customT2i,
            models: [
                { name: "ComfyUI T2I", capability: "image", comfyuiWorkflow: customT2i },
            ],
        });
        const persistOptions = (useConfigStore as any).persist.getOptions();
        const merged = persistOptions.merge(
            {
                config: {
                    ...defaultConfig,
                    channels: [customChannel],
                    imageModel: "default::ComfyUI T2I",
                },
            },
            useConfigStore.getState(),
        );

        expect(merged.config.channels[0].comfyuiProxyUrl).toBe("http://192.168.1.50:8188");
        expect(merged.config.channels[0].comfyuiT2iWorkflow).toEqual(customT2i);
        expect(merged.config.imageModel).toBe("default::ComfyUI T2I");
    });

    it("falls back to default models when persisted model references obsolete names", () => {
        const persistOptions = (useConfigStore as any).persist.getOptions();
        const merged = persistOptions.merge(
            {
                config: {
                    ...defaultConfig,
                    imageModel: "default::obsolete-gpt-image",
                    videoModel: "default::obsolete-video",
                    textModel: "default::obsolete-llm",
                },
            },
            useConfigStore.getState(),
        );

        expect(merged.config.imageModel).toBe("default::ComfyUI T2I");
        expect(merged.config.videoModel).toBe("default::ComfyUI Video");
        expect(merged.config.textModel).toBe("default::ComfyUI LLM");
    });
});
