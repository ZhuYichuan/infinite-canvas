import { describe, expect, it } from "vitest";

import { COMFYUI_DEFAULT_MODELS, createModelChannel, normalizeApiFormat, normalizeChannelModels } from "@/stores/use-config-store";

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
