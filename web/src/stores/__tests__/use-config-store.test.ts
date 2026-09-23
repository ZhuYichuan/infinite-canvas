import { beforeEach, describe, expect, it } from "vitest";

import {
    COMFYUI_DEFAULT_MODELS,
    createModelChannel,
    defaultConfig,
    isAiConfigReady,
    modelOptionLabel,
    modelOptionsFromChannels,
    normalizeApiFormat,
    normalizeChannelModels,
    resolveModelChannel,
    resolveModelForCapability,
    resolveModelRequestConfig,
    selectableModelsByCapability,
    useConfigStore,
    type AiConfig,
    type ModelChannel,
} from "@/stores/use-config-store";

describe("COMFYUI_DEFAULT_MODELS", () => {
    it("pre-provisions the default ComfyUI models", () => {
        expect(COMFYUI_DEFAULT_MODELS.map((model) => model.name)).toEqual([
            "Z-Image-Turbo",
            "Flux2.Dev",
            "Qwen-Image Inpaint",
            "Qwen3.5 4B",
            "MiniMax H3 全能视频",
            "MiniMax H3 首尾帧视频",
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
        expect(normalizeChannelModels(["Z-Image-Turbo", "Z-Image-Turbo", "Custom T2I"])).toEqual([
            { name: "Z-Image-Turbo", capability: "image", script: undefined, comfyuiWorkflow: undefined },
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
        models: [{ name: "Z-Image-Turbo", capability: "image", comfyuiWorkflow: { name: "t2i", json: {}, createdAt: 0 } }],
        comfyuiProxyUrl: "http://127.0.0.1:8189",
        comfyuiProxyToken: "tok",
    };
    const config: AiConfig = { ...defaultConfig, channels: [comfyChannel] };

    it("resolves a ComfyUI model to the ComfyUI channel", () => {
        const resolved = resolveModelRequestConfig(config, "comfy::Z-Image-Turbo");
        expect(resolved.apiFormat).toBe("comfyui");
        expect(resolved.model).toBe("Z-Image-Turbo");
        expect(resolved.baseUrl).toBe("http://127.0.0.1:8189");
    });

    it("resolves multiple ComfyUI channels to their respective IP addresses", () => {
        const channel1: ModelChannel = {
            id: "channel-1",
            name: "ComfyUI 1",
            baseUrl: "",
            apiKey: "",
            apiFormat: "comfyui",
            models: [{ name: "MiniMax H3 全能视频", capability: "video" }],
            comfyuiProxyUrl: "http://127.0.0.1:8188",
        };
        const channel2: ModelChannel = {
            id: "channel-2",
            name: "ComfyUI 2",
            baseUrl: "",
            apiKey: "",
            apiFormat: "comfyui",
            models: [{ name: "MiniMax H3 全能视频", capability: "video" }],
            comfyuiProxyUrl: "http://192.168.1.200:8188",
        };
        const cfg: AiConfig = { ...defaultConfig, channels: [channel1, channel2] };

        const res1 = resolveModelChannel(cfg, "channel-1::MiniMax H3 全能视频");
        expect(res1.id).toBe("channel-1");
        expect(res1.comfyuiProxyUrl).toBe("http://127.0.0.1:8188");

        const res2 = resolveModelChannel(cfg, "channel-2::MiniMax H3 全能视频");
        expect(res2.id).toBe("channel-2");
        expect(res2.comfyuiProxyUrl).toBe("http://192.168.1.200:8188");
    });
});

describe("persistence merge stability", () => {
    beforeEach(() => {
        useConfigStore.setState({ config: defaultConfig });
    });

    it("preserves custom workflows and proxy URL across merge", () => {
        const customT2i = { name: "custom-t2i.json", json: { test: 1 }, createdAt: 100 };
        const customChannel: ModelChannel = createModelChannel({
            id: "default",
            name: "My ComfyUI",
            comfyuiProxyUrl: "http://192.168.1.50:8188",
            comfyuiT2iWorkflow: customT2i,
            models: [{ name: "Z-Image-Turbo", capability: "image", comfyuiWorkflow: customT2i }],
        });
        const persistOptions = (useConfigStore as any).persist.getOptions();
        const merged = persistOptions.merge(
            {
                config: {
                    ...defaultConfig,
                    channels: [customChannel],
                    imageModel: "default::Z-Image-Turbo",
                },
            },
            useConfigStore.getState(),
        );

        expect(merged.config.channels[0].comfyuiProxyUrl).toBe("http://192.168.1.50:8188");
        expect(merged.config.channels[0].comfyuiT2iWorkflow).toEqual(customT2i);
        expect(merged.config.imageModel).toBe("default::Z-Image-Turbo");
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

        expect(merged.config.imageModel).toBe("builtin::Z-Image-Turbo");
        expect(merged.config.videoModel).toBe("builtin::MiniMax H3 全能视频");
        expect(merged.config.textModel).toBe("builtin::Qwen3.5 4B");
    });

    it("rehydrates after modifying channel via setConfig", async () => {
        const initialChannels = useConfigStore.getState().config.channels;
        const modifiedChannel = {
            ...initialChannels[0],
            comfyuiProxyUrl: "http://192.168.1.99:8188",
        };
        useConfigStore.getState().setConfig({
            ...useConfigStore.getState().config,
            channels: [modifiedChannel],
        });
        expect(useConfigStore.getState().config.channels[0].comfyuiProxyUrl).toBe("http://192.168.1.99:8188");

        await useConfigStore.persist.rehydrate();
        expect(useConfigStore.getState().config.channels[0].comfyuiProxyUrl).toBe("http://192.168.1.99:8188");
    });

    it("persists when deleting custom channel", async () => {
        const initialChannels = useConfigStore.getState().config.channels;
        const extraChannel = createModelChannel({ id: "extra", name: "额外渠道" });
        useConfigStore.getState().setConfig({
            ...useConfigStore.getState().config,
            channels: [...initialChannels, extraChannel],
        });
        expect(useConfigStore.getState().config.channels.length).toBe(2);

        useConfigStore.getState().setConfig({
            ...useConfigStore.getState().config,
            channels: initialChannels,
        });
        await useConfigStore.persist.rehydrate();
        expect(useConfigStore.getState().config.channels.length).toBe(1);
    });

    it("persists when reordering channels via setDefaultChannel", async () => {
        const initialChannels = useConfigStore.getState().config.channels;
        const extraChannel = createModelChannel({ id: "extra", name: "额外渠道" });
        useConfigStore.getState().setConfig({
            ...useConfigStore.getState().config,
            channels: [extraChannel, initialChannels[0]],
        });
        await useConfigStore.persist.rehydrate();
        expect(useConfigStore.getState().config.channels[0].id).toBe("extra");
    });

    it("persists all preferences fields across rehydration", async () => {
        useConfigStore.getState().updateConfig("imageModel", "builtin::Flux2.Dev");
        useConfigStore.getState().updateConfig("videoModel", "builtin::MiniMax H3 全能视频");
        useConfigStore.getState().updateConfig("textModel", "builtin::Qwen3.5 4B");
        useConfigStore.getState().updateConfig("canvasImageCount", "5");
        useConfigStore.getState().updateConfig("audioVoice", "echo");
        useConfigStore.getState().updateConfig("audioFormat", "wav");
        useConfigStore.getState().updateConfig("audioSpeed", "1.25");
        useConfigStore.getState().updateConfig("audioInstructions", "Speak in a calm voice");
        useConfigStore.getState().updateConfig("systemPrompt", "You are a professional designer");

        await useConfigStore.persist.rehydrate();

        const config = useConfigStore.getState().config;
        expect(config.imageModel).toBe("builtin::Flux2.Dev");
        expect(config.model).toBe("builtin::Flux2.Dev");
        expect(config.videoModel).toBe("builtin::MiniMax H3 全能视频");
        expect(config.textModel).toBe("builtin::Qwen3.5 4B");
        expect(config.canvasImageCount).toBe("5");
        expect(config.audioVoice).toBe("echo");
        expect(config.audioFormat).toBe("wav");
        expect(config.audioSpeed).toBe("1.25");
        expect(config.audioInstructions).toBe("Speak in a calm voice");
        expect(config.systemPrompt).toBe("You are a professional designer");
    });

    it("persists all WebDAV configuration fields across rehydration", async () => {
        useConfigStore.getState().updateWebdavConfig("url", "https://nas.example.com/webdav");
        useConfigStore.getState().updateWebdavConfig("directory", "my-canvas-backup");
        useConfigStore.getState().updateWebdavConfig("username", "admin");
        useConfigStore.getState().updateWebdavConfig("password", "secret123");
        useConfigStore.getState().updateWebdavConfig("lastSyncedAt", "2026-09-11T12:00:00.000Z");

        await useConfigStore.persist.rehydrate();

        const webdav = useConfigStore.getState().webdav;
        expect(webdav.url).toBe("https://nas.example.com/webdav");
        expect(webdav.directory).toBe("my-canvas-backup");
        expect(webdav.username).toBe("admin");
        expect(webdav.password).toBe("secret123");
        expect(webdav.lastSyncedAt).toBe("2026-09-11T12:00:00.000Z");
    });

    it("persists all 6 custom workflow slots and token across rehydration", async () => {
        const customWf = (name: string) => ({ name, json: { node: name }, createdAt: 1000 });
        const channels = useConfigStore.getState().config.channels;
        const modified = {
            ...channels[0],
            comfyuiProxyToken: "my-secret-token",
            comfyuiT2iWorkflow: customWf("custom-t2i"),
            comfyuiI2iWorkflow: customWf("custom-i2i"),
            comfyuiInpaintWorkflow: customWf("custom-inpaint"),
            comfyuiTextWorkflow: customWf("custom-text"),
            comfyuiVideoWorkflow: customWf("custom-video"),
            comfyuiFrameVideoWorkflow: customWf("custom-frame-video"),
        };
        useConfigStore.getState().setConfig({
            ...useConfigStore.getState().config,
            channels: [modified],
        });

        await useConfigStore.persist.rehydrate();

        const savedChannel = useConfigStore.getState().config.channels[0];
        expect(savedChannel.comfyuiProxyToken).toBe("my-secret-token");
        expect(savedChannel.comfyuiT2iWorkflow?.name).toBe("custom-t2i");
        expect(savedChannel.comfyuiI2iWorkflow?.name).toBe("custom-i2i");
        expect(savedChannel.comfyuiInpaintWorkflow?.name).toBe("custom-inpaint");
        expect(savedChannel.comfyuiTextWorkflow?.name).toBe("custom-text");
        expect(savedChannel.comfyuiVideoWorkflow?.name).toBe("custom-video");
        expect(savedChannel.comfyuiFrameVideoWorkflow?.name).toBe("custom-frame-video");
    });

    it("supports adding an extra channel, selecting its models, routing its API calls, and persisting across reload", async () => {
        const initialChannels = useConfigStore.getState().config.channels;
        const channel2 = createModelChannel({
            id: "chan-2",
            name: "私有 GPU",
            comfyuiProxyUrl: "http://192.168.10.88:8188",
            comfyuiProxyToken: "token2",
        });

        useConfigStore.getState().setConfig({
            ...useConfigStore.getState().config,
            channels: [...initialChannels, channel2],
            models: modelOptionsFromChannels([...initialChannels, channel2]),
        });

        const stateBefore = useConfigStore.getState();
        expect(stateBefore.config.channels.length).toBe(2);

        // 1. Check selectable models include channel 2
        const imageModels = selectableModelsByCapability(stateBefore.config, "image");
        expect(imageModels).toContain("chan-2::Z-Image-Turbo");
        expect(modelOptionLabel(stateBefore.config, "chan-2::Z-Image-Turbo")).toBe("Z-Image-Turbo（私有 GPU）");

        // 2. Check API resolution points to channel 2's URL and token
        const reqConfig = resolveModelRequestConfig(stateBefore.config, "chan-2::Z-Image-Turbo");
        expect(reqConfig.baseUrl).toBe("http://192.168.10.88:8188");
        expect(reqConfig.apiKey).toBe("token2");
        expect(reqConfig.model).toBe("Z-Image-Turbo");

        // 3. Check canvas node resolution selects channel 2
        const resolved = resolveModelForCapability(stateBefore.config, "chan-2::Z-Image-Turbo", "image");
        expect(resolved).toBe("chan-2::Z-Image-Turbo");

        // 4. Rehydrate (simulate browser refresh)
        await useConfigStore.persist.rehydrate();

        const stateAfter = useConfigStore.getState();
        expect(stateAfter.config.channels.length).toBe(2);
        const rehydratedChan2 = stateAfter.config.channels.find((c) => c.id === "chan-2");
        expect(rehydratedChan2).toBeDefined();
        expect(rehydratedChan2?.name).toBe("私有 GPU");
        expect(rehydratedChan2?.comfyuiProxyUrl).toBe("http://192.168.10.88:8188");
        expect(rehydratedChan2?.comfyuiProxyToken).toBe("token2");

        // 5. Post-reload API resolution still routes correctly to channel 2
        const postReloadReqConfig = resolveModelRequestConfig(stateAfter.config, "chan-2::Z-Image-Turbo");
        expect(postReloadReqConfig.baseUrl).toBe("http://192.168.10.88:8188");
        expect(postReloadReqConfig.apiKey).toBe("token2");
    });
});

describe("default built-in ComfyUI channel", () => {
    it("provides the unified built-in channel in defaultConfig", () => {
        expect(defaultConfig.channels.map((c) => c.id)).toEqual(["builtin"]);
        expect(defaultConfig.channels[0].name).toBe("系统内置 ComfyUI");
        expect(defaultConfig.channels[0].comfyuiProxyUrl).toBe("http://127.0.0.1:8188");
        expect(defaultConfig.channels[0].models.map((m) => m.name)).toEqual([
            "Z-Image-Turbo",
            "Flux2.Dev",
            "Qwen-Image Inpaint",
            "Qwen3.5 4B",
            "MiniMax H3 全能视频",
            "MiniMax H3 首尾帧视频",
        ]);
        expect(defaultConfig.channels[0].workflows?.length).toBe(8);
    });

    it("creates custom channel with builtin models and workflows", () => {
        const customChannel = createModelChannel({ id: "my-custom", name: "自定义 ComfyUI" });
        expect(customChannel.name).toBe("自定义 ComfyUI");
        expect(customChannel.models.length).toBe(6);
        expect(customChannel.workflows?.length).toBe(8);
        expect(customChannel.workflows?.every((w) => w.isBuiltin)).toBe(true);
        expect(customChannel.comfyuiT2iWorkflow?.isBuiltin).toBe(true);
        expect(customChannel.comfyuiI2iWorkflow?.isBuiltin).toBe(true);
        expect(customChannel.comfyuiInpaintWorkflow?.isBuiltin).toBe(true);
        expect(customChannel.comfyuiTextWorkflow?.isBuiltin).toBe(true);
        expect(customChannel.comfyuiVideoWorkflow?.isBuiltin).toBe(true);
        expect(customChannel.comfyuiFrameVideoWorkflow?.isBuiltin).toBe(true);
    });
});

