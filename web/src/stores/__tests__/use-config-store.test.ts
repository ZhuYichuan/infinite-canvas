import { describe, expect, it } from "vitest";

import { COMFYUI_DEFAULT_MODELS, createModelChannel, defaultConfig, isAiConfigReady, modelOptionLabel, modelOptionsFromChannels, normalizeApiFormat, normalizeChannelModels, resolveModelChannel, resolveModelForCapability, resolveModelRequestConfig, selectableModelsByCapability, useConfigStore, type AiConfig, type ModelChannel } from "@/stores/use-config-store";

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

        expect(merged.config.imageModel).toBe("local::ComfyUI T2I");
        expect(merged.config.videoModel).toBe("local::ComfyUI Video");
        expect(merged.config.textModel).toBe("local::ComfyUI LLM");
    });

    it("rehydrates after modifying channel via setConfig", async () => {
        const initialChannels = useConfigStore.getState().config.channels;
        const modifiedChannel = {
            ...initialChannels[0],
            comfyuiProxyUrl: "http://192.168.1.99:8188",
        };
        useConfigStore.getState().setConfig({
            ...useConfigStore.getState().config,
            channels: [modifiedChannel, initialChannels[1]],
        });
        expect(useConfigStore.getState().config.channels[0].comfyuiProxyUrl).toBe("http://192.168.1.99:8188");

        await useConfigStore.persist.rehydrate();
        expect(useConfigStore.getState().config.channels[0].comfyuiProxyUrl).toBe("http://192.168.1.99:8188");
    });

    it("persists when deleting cloud channel", async () => {
        const initialChannels = useConfigStore.getState().config.channels;
        const keptChannels = initialChannels.filter((c) => c.id !== "cloud");
        useConfigStore.getState().setConfig({
            ...useConfigStore.getState().config,
            channels: keptChannels,
        });
        await useConfigStore.persist.rehydrate();
        expect(useConfigStore.getState().config.channels.length).toBe(1);
    });

    it("persists when reordering channels via setDefaultChannel", async () => {
        const initialChannels = useConfigStore.getState().config.channels;
        const cloudChannel = initialChannels.find((c) => c.id === "cloud")!;
        const localChannel = initialChannels.find((c) => c.id === "local")!;
        useConfigStore.getState().setConfig({
            ...useConfigStore.getState().config,
            channels: [cloudChannel, localChannel],
        });
        await useConfigStore.persist.rehydrate();
        expect(useConfigStore.getState().config.channels[0].id).toBe("cloud");
    });

    it("persists all preferences fields across rehydration", async () => {
        useConfigStore.getState().updateConfig("imageModel", "cloud::ComfyUI T2I");
        useConfigStore.getState().updateConfig("videoModel", "cloud::ComfyUI Video");
        useConfigStore.getState().updateConfig("textModel", "cloud::ComfyUI LLM");
        useConfigStore.getState().updateConfig("canvasImageCount", "5");
        useConfigStore.getState().updateConfig("audioVoice", "echo");
        useConfigStore.getState().updateConfig("audioFormat", "wav");
        useConfigStore.getState().updateConfig("audioSpeed", "1.25");
        useConfigStore.getState().updateConfig("audioInstructions", "Speak in a calm voice");
        useConfigStore.getState().updateConfig("systemPrompt", "You are a professional designer");

        await useConfigStore.persist.rehydrate();

        const config = useConfigStore.getState().config;
        expect(config.imageModel).toBe("cloud::ComfyUI T2I");
        expect(config.model).toBe("cloud::ComfyUI T2I");
        expect(config.videoModel).toBe("cloud::ComfyUI Video");
        expect(config.textModel).toBe("cloud::ComfyUI LLM");
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
            channels: [modified, channels[1]],
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

    it("supports adding a 3rd channel, selecting its models, routing its API calls, and persisting across reload", async () => {
        const initialChannels = useConfigStore.getState().config.channels;
        const channel3 = createModelChannel({
            id: "chan-3",
            name: "私有 GPU",
            comfyuiProxyUrl: "http://192.168.10.88:8188",
            comfyuiProxyToken: "token3",
        });

        useConfigStore.getState().setConfig({
            ...useConfigStore.getState().config,
            channels: [...initialChannels, channel3],
            models: modelOptionsFromChannels([...initialChannels, channel3]),
        });

        const stateBefore = useConfigStore.getState();
        expect(stateBefore.config.channels.length).toBe(3);

        // 1. Check selectable models include channel 3
        const imageModels = selectableModelsByCapability(stateBefore.config, "image");
        expect(imageModels).toContain("chan-3::ComfyUI T2I");
        expect(modelOptionLabel(stateBefore.config, "chan-3::ComfyUI T2I")).toBe("ComfyUI T2I（私有 GPU）");

        // 2. Check API resolution points to channel 3's URL and token
        const reqConfig = resolveModelRequestConfig(stateBefore.config, "chan-3::ComfyUI T2I");
        expect(reqConfig.baseUrl).toBe("http://192.168.10.88:8188");
        expect(reqConfig.apiKey).toBe("token3");
        expect(reqConfig.model).toBe("ComfyUI T2I");

        // 3. Check canvas node resolution selects channel 3
        const resolved = resolveModelForCapability(stateBefore.config, "chan-3::ComfyUI T2I", "image");
        expect(resolved).toBe("chan-3::ComfyUI T2I");

        // 4. Rehydrate (simulate browser refresh)
        await useConfigStore.persist.rehydrate();

        const stateAfter = useConfigStore.getState();
        expect(stateAfter.config.channels.length).toBe(3);
        const rehydratedChan3 = stateAfter.config.channels.find((c) => c.id === "chan-3");
        expect(rehydratedChan3).toBeDefined();
        expect(rehydratedChan3?.name).toBe("私有 GPU");
        expect(rehydratedChan3?.comfyuiProxyUrl).toBe("http://192.168.10.88:8188");
        expect(rehydratedChan3?.comfyuiProxyToken).toBe("token3");

        // 5. Post-reload API resolution still routes correctly to channel 3
        const postReloadReqConfig = resolveModelRequestConfig(stateAfter.config, "chan-3::ComfyUI T2I");
        expect(postReloadReqConfig.baseUrl).toBe("http://192.168.10.88:8188");
        expect(postReloadReqConfig.apiKey).toBe("token3");
    });
});

describe("default dual ComfyUI channels", () => {
    it("provides both local and cloud channels in defaultConfig", () => {
        expect(defaultConfig.channels.map((c) => c.id)).toEqual(["local", "cloud"]);
        expect(defaultConfig.channels[0].name).toBe("本地 ComfyUI");
        expect(defaultConfig.channels[1].name).toBe("云端 ComfyUI");
        expect(defaultConfig.channels[0].comfyuiProxyUrl).toBe("http://127.0.0.1:8188");
        expect(defaultConfig.channels[1].comfyuiProxyUrl).toBe("");
    });

    it("creates cloud channel with cloud models and workflows", () => {
        const cloudChannel = createModelChannel({ id: "cloud" });
        expect(cloudChannel.name).toBe("云端 ComfyUI");
        expect(cloudChannel.models.length).toBe(6);
    });
});
