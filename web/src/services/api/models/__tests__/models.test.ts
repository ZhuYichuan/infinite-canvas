import { describe, expect, it } from "vitest";
import {
    dispatchComfyuiModelWorkflow,
    getModelProfile,
    listModelsByCapability,
    validateModelExecution,
    videoMinimaxH3FrameProfile,
    videoMinimaxH3OmniProfile,
    MINIMAX_H3_SIZES,
} from "../index";

describe("Workflow Model Profiles", () => {
    it("registers video_minimax_h3_omni with correct DSL capability config", () => {
        const profile = getModelProfile("video_minimax_h3_omni");
        expect(profile).toBeDefined();
        expect(profile?.capability).toBe("video");
        expect(profile?.category).toBe("omniVideo");
        expect(profile?.capabilityConfig.references.maxImages).toBe(9);
        expect(profile?.capabilityConfig.references.maxVideos).toBe(3);
        expect(profile?.capabilityConfig.references.maxAudios).toBe(3);
        expect(profile?.capabilityConfig.size?.values).toEqual(MINIMAX_H3_SIZES);
        expect(profile?.capabilityConfig.size?.allowCustom).toBe(false);
        expect(profile?.capabilityConfig.duration).toEqual({
            selection: "range",
            min: 1,
            max: 15,
            step: 1,
            tags: [5, 10, 15],
            default: 5,
        });
    });

    it("registers video_minimax_h3_frame with strictly 2 frames quota", () => {
        const profile = getModelProfile("video_minimax_h3_frame");
        expect(profile).toBeDefined();
        expect(profile?.capability).toBe("video");
        expect(profile?.category).toBe("frameVideo");
        expect(profile?.capabilityConfig.references.minImages).toBe(2);
        expect(profile?.capabilityConfig.references.maxImages).toBe(2);
        expect(profile?.capabilityConfig.references.maxVideos).toBe(0);
        expect(profile?.capabilityConfig.references.maxAudios).toBe(0);
        expect(profile?.capabilityConfig.duration?.tags).toEqual([5, 10, 15]);
    });

    it("resolves model profile by category keyword fallback", () => {
        expect(getModelProfile("omniVideo")?.id).toBe("video_minimax_h3_omni");
        expect(getModelProfile("frameVideo")?.id).toBe("video_minimax_h3_frame");
    });

    it("lists models by capability", () => {
        const videoModels = listModelsByCapability("video");
        expect(videoModels.length).toBeGreaterThanOrEqual(2);
        expect(videoModels.some((m) => m.id === "video_minimax_h3_omni")).toBe(true);
        expect(videoModels.some((m) => m.id === "video_minimax_h3_frame")).toBe(true);
    });
});

describe("validateModelExecution (Fail-loud validation)", () => {
    it("rejects frame video when image count is not exactly 2", () => {
        expect(() =>
            validateModelExecution(videoMinimaxH3FrameProfile, { imagesCount: 1 })
        ).toThrow("至少需要 2 张参考图片");

        expect(() =>
            validateModelExecution(videoMinimaxH3FrameProfile, { imagesCount: 3 })
        ).toThrow("最多支持 2 张参考图片");
    });

    it("rejects omni video when resource limits are exceeded", () => {
        expect(() =>
            validateModelExecution(videoMinimaxH3OmniProfile, { imagesCount: 10 })
        ).toThrow("最多支持 9 张参考图片");

        expect(() =>
            validateModelExecution(videoMinimaxH3OmniProfile, { videosCount: 4 })
        ).toThrow("最多支持 3 个参考视频");

        expect(() =>
            validateModelExecution(videoMinimaxH3OmniProfile, { audiosCount: 4 })
        ).toThrow("最多支持 3 个参考音频");
    });

    it("rejects sizes outside the 9 hardware-aligned tiers", () => {
        expect(() =>
            validateModelExecution(videoMinimaxH3OmniProfile, { size: "1000x500" })
        ).toThrow("不支持尺寸 1000x500");

        // Valid size should not throw
        expect(() =>
            validateModelExecution(videoMinimaxH3OmniProfile, { size: "1280x736" })
        ).not.toThrow();

        expect(() =>
            validateModelExecution(videoMinimaxH3OmniProfile, { size: "736x1280" })
        ).not.toThrow();
    });

    it("rejects duration outside the 1-15s range", () => {
        expect(() =>
            validateModelExecution(videoMinimaxH3OmniProfile, { duration: 0 })
        ).toThrow("必须在 1 ~ 15 秒之间");

        expect(() =>
            validateModelExecution(videoMinimaxH3OmniProfile, { duration: 16 })
        ).toThrow("必须在 1 ~ 15 秒之间");

        expect(() =>
            validateModelExecution(videoMinimaxH3OmniProfile, { duration: 8 })
        ).not.toThrow();
    });
});

describe("dispatchComfyuiModelWorkflow (Cascade Pruning & Parameter Injection)", () => {
    it("injects parameters and prunes unassigned slots in Omni video workflow", () => {
        const rawWorkflow = {
            "1": { inputs: { value: "old prompt" }, class_type: "PrimitiveStringMultiline", _meta: { title: "prompt" } },
            "2": { inputs: { Number: "1024" }, class_type: "Int", _meta: { title: "width" } },
            "3": { inputs: { Number: "1024" }, class_type: "Int", _meta: { title: "height" } },
            "4": { inputs: { value: 5 }, class_type: "PrimitiveFloat", _meta: { title: "duration" } },
            "5": { inputs: { value: 0 }, class_type: "PrimitiveInt", _meta: { title: "seed" } },
            "11": { inputs: { image: "test1.png" }, class_type: "LoadImage", _meta: { title: "ref_image_01" } },
            "12": { inputs: { image: "test2.png" }, class_type: "LoadImage", _meta: { title: "ref_image_02" } },
            "13": { inputs: { image: "test3.png" }, class_type: "LoadImage", _meta: { title: "ref_image_03" } },
            "21": { inputs: { file: "vid1.mp4" }, class_type: "LoadVideo", _meta: { title: "ref_video_01" } },
            "22": { inputs: { video: ["21", 0] }, class_type: "GetVideoComponents" },
            "30": {
                inputs: {
                    prompt: ["1", 0],
                    "ref_images.ref_image_0": ["11", 0],
                    "ref_images.ref_image_1": ["12", 0],
                    "ref_images.ref_image_2": ["13", 0],
                    "ref_videos.ref_video_0": ["22", 0],
                },
                class_type: "MiniMaxOmniSampler",
            },
        };

        // Pass 2 reference images and 0 videos
        const dispatched = dispatchComfyuiModelWorkflow(videoMinimaxH3OmniProfile, rawWorkflow, {
            prompt: "宇宙战舰对轰",
            width: 1280,
            height: 736,
            duration: 10,
            seed: 42,
            assetIds: ["uploaded_img_1.png", "uploaded_img_2.png"],
        });

        // 1. Check parameter injection
        expect((dispatched["1"] as any).inputs.value).toBe("宇宙战舰对轰");
        expect((dispatched["2"] as any).inputs.Number).toBe("1280");
        expect((dispatched["3"] as any).inputs.Number).toBe("736");
        expect((dispatched["4"] as any).inputs.value).toBe(10);
        expect((dispatched["5"] as any).inputs.value).toBe(42);

        // 2. Check assigned images are bound
        expect((dispatched["11"] as any).inputs.image).toBe("uploaded_img_1.png");
        expect((dispatched["12"] as any).inputs.image).toBe("uploaded_img_2.png");

        // 3. Check unassigned ref_image_03 is pruned
        expect(dispatched["13"]).toBeUndefined();
        expect((dispatched["30"] as any).inputs["ref_images.ref_image_2"]).toBeUndefined();

        // 4. Check unassigned video and its GetVideoComponents bridge are pruned
        expect(dispatched["21"]).toBeUndefined();
        expect(dispatched["22"]).toBeUndefined();
        expect((dispatched["30"] as any).inputs["ref_videos.ref_video_0"]).toBeUndefined();
    });

    it("binds first_frame and last_frame for Frame video workflow", () => {
        const rawWorkflow = {
            "1": { inputs: { value: "prompt" }, class_type: "PrimitiveStringMultiline", _meta: { title: "prompt" } },
            "10": { inputs: { image: "first.png" }, class_type: "LoadImage", _meta: { title: "first_frame" } },
            "11": { inputs: { image: "last.png" }, class_type: "LoadImage", _meta: { title: "last_frame" } },
        };

        const dispatched = dispatchComfyuiModelWorkflow(videoMinimaxH3FrameProfile, rawWorkflow, {
            prompt: "从破损空间站飞向恒星",
            firstFrameAssetId: "asset_first.png",
            lastFrameAssetId: "asset_last.png",
        });

        expect((dispatched["10"] as any).inputs.image).toBe("asset_first.png");
        expect((dispatched["11"] as any).inputs.image).toBe("asset_last.png");
    });
});
