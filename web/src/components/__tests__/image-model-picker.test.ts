import { describe, expect, it } from "vitest";
import {
    BUILTIN_IMAGE_WORKFLOW_MODELS,
    evaluateModelAvailability,
    getModelProfile,
    imageFlux2DevProfile,
    imageQwen21Profile,
    imageQwenInpaintProfile,
    imageZTurboProfile,
} from "@/services/api/models";

describe("ImageModelPicker Data Contract & Constraints", () => {
    it("BUILTIN_IMAGE_WORKFLOW_MODELS registers exactly 4 native image models", () => {
        expect(BUILTIN_IMAGE_WORKFLOW_MODELS).toHaveLength(4);
        const ids = BUILTIN_IMAGE_WORKFLOW_MODELS.map((m) => m.id);
        expect(ids).toContain("image-qwen-2.1");
        expect(ids).toContain("image-z-turbo");
        expect(ids).toContain("image-flux2-dev");
        expect(ids).toContain("image-qwen-inpaint");
    });

    it("evaluates Z-Image Turbo availability (rejects connected images)", () => {
        const check0 = evaluateModelAvailability({
            targetModel: imageZTurboProfile,
            connectedImages: 0,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "a cute cat",
        });
        expect(check0.isAvailable).toBe(true);

        const checkWithImg = evaluateModelAvailability({
            targetModel: imageZTurboProfile,
            connectedImages: 1,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "a cute cat",
        });
        expect(checkWithImg.isAvailable).toBe(false);
        expect(checkWithImg.reasons).toContain("该模型不支持参考图，当前已连接 1 张图片");
    });

    it("evaluates Flux2.Dev availability (allows up to 2 images, rejects 3rd)", () => {
        const check2 = evaluateModelAvailability({
            targetModel: imageFlux2DevProfile,
            connectedImages: 2,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "style blend",
        });
        expect(check2.isAvailable).toBe(true);

        const check3 = evaluateModelAvailability({
            targetModel: imageFlux2DevProfile,
            connectedImages: 3,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "style blend",
        });
        expect(check3.isAvailable).toBe(false);
        expect(check3.reasons).toContain("已连接 3 张参考图，该模型最多支持 2 张");
    });

    it("evaluates Qwen-Image 2.1 availability (allows up to 10 images)", () => {
        const check10 = evaluateModelAvailability({
            targetModel: imageQwen21Profile,
            connectedImages: 10,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "multi-ref composition",
        });
        expect(check10.isAvailable).toBe(true);

        const check11 = evaluateModelAvailability({
            targetModel: imageQwen21Profile,
            connectedImages: 11,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "multi-ref composition",
        });
        expect(check11.isAvailable).toBe(false);
        expect(check11.reasons).toContain("已连接 11 张参考图，该模型最多支持 10 张");
    });

    it("evaluates Qwen-Image Inpaint availability (requires exactly 2 images: base + mask)", () => {
        const check0 = evaluateModelAvailability({
            targetModel: imageQwenInpaintProfile,
            connectedImages: 0,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "inpaint area",
        });
        expect(check0.isAvailable).toBe(false);
        expect(check0.reasons).toContain("该模型需要两张参考图（一张原图 + 一张蒙版），当前已连接 0 张");

        const check1 = evaluateModelAvailability({
            targetModel: imageQwenInpaintProfile,
            connectedImages: 1,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "inpaint area",
        });
        expect(check1.isAvailable).toBe(false);
        expect(check1.reasons).toContain("该模型需要两张参考图（一张原图 + 一张蒙版），当前已连接 1 张");

        const check2 = evaluateModelAvailability({
            targetModel: imageQwenInpaintProfile,
            connectedImages: 2,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "inpaint area",
        });
        expect(check2.isAvailable).toBe(true);

        const check3 = evaluateModelAvailability({
            targetModel: imageQwenInpaintProfile,
            connectedImages: 3,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "inpaint area",
        });
        expect(check3.isAvailable).toBe(false);
        expect(check3.reasons).toContain("该模型需要两张参考图（一张原图 + 一张蒙版），当前已连接 3 张");
    });

    it("evaluates media type compatibility (rejects video/audio for image models)", () => {
        const checkVideo = evaluateModelAvailability({
            targetModel: imageQwen21Profile,
            connectedImages: 1,
            connectedVideos: 1,
            connectedAudios: 0,
            promptText: "test",
        });
        expect(checkVideo.isAvailable).toBe(false);
        expect(checkVideo.reasons).toContain("该模型不支持参考视频，当前已连接 1 个视频");

        const checkAudio = evaluateModelAvailability({
            targetModel: imageQwen21Profile,
            connectedImages: 1,
            connectedVideos: 0,
            connectedAudios: 1,
            promptText: "test",
        });
        expect(checkAudio.isAvailable).toBe(false);
        expect(checkAudio.reasons).toContain("该模型不支持参考音频，当前已连接 1 个音频");
    });

    it("getModelProfile resolves all 4 image models and aliases", () => {
        expect(getModelProfile("image-qwen-2.1")).toEqual(imageQwen21Profile);
        expect(getModelProfile("t2i")).toEqual(imageQwen21Profile);
        expect(getModelProfile("image-z-turbo")).toEqual(imageZTurboProfile);
        expect(getModelProfile("turbo")).toEqual(imageZTurboProfile);
        expect(getModelProfile("image-flux2-dev")).toEqual(imageFlux2DevProfile);
        expect(getModelProfile("i2i")).toEqual(imageFlux2DevProfile);
        expect(getModelProfile("image-qwen-inpaint")).toEqual(imageQwenInpaintProfile);
        expect(getModelProfile("inpaint")).toEqual(imageQwenInpaintProfile);
    });
});
