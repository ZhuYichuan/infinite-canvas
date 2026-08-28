import { describe, expect, it } from "vitest";

import { COMFYUI_DEFAULT_MODELS, createModelChannel, defaultConfig, isAiConfigReady, normalizeApiFormat, normalizeChannelModels, useConfigStore, type AiConfig } from "@/stores/use-config-store";

describe("COMFYUI_DEFAULT_MODELS", () => {
    it("pre-provisions three image workflow models", () => {
        expect(COMFYUI_DEFAULT_MODELS.map((model) => model.name)).toEqual(["ComfyUI T2I", "ComfyUI I2I 1ref", "ComfyUI I2I 3ref"]);
        for (const model of COMFYUI_DEFAULT_MODELS) expect(model.capability).toBe("image");
    });
});

describe("createModelChannel", () => {
    it("pre-provisions the default models for a new ComfyUI channel without models", () => {
        const channel = createModelChannel({ apiFormat: "comfyui" });
        expect(channel.apiFormat).toBe("comfyui");
        expect(channel.models.map((model) => model.name)).toEqual(COMFYUI_DEFAULT_MODELS.map((model) => model.name));
    });

    it("keeps an explicit model list instead of pre-provisioning", () => {
        const channel = createModelChannel({ apiFormat: "comfyui", models: [{ name: "My Workflow", capability: "image" }] });
        expect(channel.models.map((model) => model.name)).toEqual(["My Workflow"]);
    });

    it("does not pre-provision when the option is disabled (load path)", () => {
        const channel = createModelChannel({ apiFormat: "comfyui" }, { preprovisionComfyuiModels: false });
        expect(channel.models).toEqual([]);
    });

    it("does not pre-provision for non-ComfyUI channels", () => {
        expect(createModelChannel({ apiFormat: "openai" }).models).toEqual([]);
        expect(createModelChannel({ apiFormat: "gemini" }).models).toEqual([]);
    });
});

describe("normalizeChannelModels", () => {
    it("normalizes string entries with a guessed capability and dedupes by name", () => {
        expect(normalizeChannelModels(["gpt-5.5", "gpt-5.5", "sora-2"])).toEqual([
            { name: "gpt-5.5", capability: "text", script: undefined, comfyuiWorkflow: undefined },
            { name: "sora-2", capability: "video", script: undefined, comfyuiWorkflow: undefined },
        ]);
    });
});

describe("normalizeApiFormat", () => {
    it("passes through known formats and falls back to openai", () => {
        expect(normalizeApiFormat("gemini")).toBe("gemini");
        expect(normalizeApiFormat("comfyui")).toBe("comfyui");
        expect(normalizeApiFormat("openai")).toBe("openai");
        expect(normalizeApiFormat(undefined)).toBe("openai");
        expect(normalizeApiFormat("unknown-format")).toBe("openai");
    });
});

describe("isAiConfigReady", () => {
    const comfyuiChannel = (overrides: Partial<{ comfyuiProxyUrl: string; comfyuiProxyToken: string }> = {}) =>
        createModelChannel({ apiFormat: "comfyui", baseUrl: "", apiKey: "", models: [], comfyuiProxyUrl: "http://127.0.0.1:8188", comfyuiProxyToken: "secret", ...overrides });

    it("returns true when at least one ComfyUI channel has proxy URL and token (no baseUrl/apiKey needed)", () => {
        const config: AiConfig = { ...defaultConfig, channels: [comfyuiChannel()] };
        expect(isAiConfigReady(config, "any::model")).toBe(true);
    });

    it("returns false when a ComfyUI channel is missing the proxy URL", () => {
        const config: AiConfig = { ...defaultConfig, channels: [comfyuiChannel({ comfyuiProxyUrl: "" })] };
        expect(isAiConfigReady(config, "any::model")).toBe(false);
    });

    it("returns false when a ComfyUI channel is missing the proxy token", () => {
        const config: AiConfig = { ...defaultConfig, channels: [comfyuiChannel({ comfyuiProxyToken: "" })] };
        expect(isAiConfigReady(config, "any::model")).toBe(false);
    });

    it("returns true when an OpenAI channel has baseUrl, apiKey, and at least one model", () => {
        const channel = createModelChannel({ apiFormat: "openai", baseUrl: "https://api.openai.com", apiKey: "sk-test", models: [{ name: "gpt-image-2", capability: "image" }] });
        const config: AiConfig = { ...defaultConfig, channels: [channel] };
        expect(isAiConfigReady(config, "any::model")).toBe(true);
    });

    it("returns false when an OpenAI channel is missing the apiKey", () => {
        const channel = createModelChannel({ apiFormat: "openai", baseUrl: "https://api.openai.com", apiKey: "", models: [{ name: "gpt-image-2", capability: "image" }] });
        const config: AiConfig = { ...defaultConfig, channels: [channel] };
        expect(isAiConfigReady(config, "any::model")).toBe(false);
    });

    it("returns false when an OpenAI channel is missing the baseUrl", () => {
        // Build a raw channel because createModelChannel auto-fills a default baseUrl for OpenAI.
        const channel = { id: "x", name: "x", baseUrl: "", apiKey: "sk-test", apiFormat: "openai" as const, models: [{ name: "gpt-image-2", capability: "image" as const }] };
        const config: AiConfig = { ...defaultConfig, channels: [channel] };
        expect(isAiConfigReady(config, "any::model")).toBe(false);
    });

    it("returns false when the model string is empty even if channels are ready", () => {
        const channel = createModelChannel({ apiFormat: "openai", baseUrl: "https://api.openai.com", apiKey: "sk-test", models: [{ name: "gpt-image-2", capability: "image" }] });
        const config: AiConfig = { ...defaultConfig, channels: [channel] };
        expect(isAiConfigReady(config, "")).toBe(false);
    });

    it("matches channels.some so a single ready ComfyUI channel suffices among others", () => {
        const incomplete = createModelChannel({ apiFormat: "openai", baseUrl: "", apiKey: "", models: [] });
        const config: AiConfig = { ...defaultConfig, channels: [incomplete, comfyuiChannel()] };
        expect(isAiConfigReady(config, "any::model")).toBe(true);
    });

    it("is also exposed on the store under the same signature", () => {
        const config: AiConfig = { ...defaultConfig, channels: [comfyuiChannel()] };
        expect(useConfigStore.getState().isAiConfigReady(config, "any::model")).toBe(true);
    });
});
