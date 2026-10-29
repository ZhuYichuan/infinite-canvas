import { describe, expect, it } from "vitest";
import { applyTextBindings } from "../../comfyui";
import {
    BUILTIN_IMAGE_WORKFLOW_MODELS,
    BUILTIN_VIDEO_WORKFLOW_MODELS,
    BUILTIN_TEXT_WORKFLOW_MODELS,
    BUILTIN_WORKFLOW_MODELS,
    dispatchComfyuiModelWorkflow,
    getModelProfile,
    imageFlux2DevProfile,
    imageQwen21Profile,
    imageQwenInpaintProfile,
    imageZTurboProfile,
    textQwen35ChatProfile,
    textQwen35VlmProfile,
    listModelsByCapability,
    validateModelExecution,
    videoMinimaxH3FrameFp8PdmdProfile,
    videoMinimaxH3FrameFp8Profile,
    videoMinimaxH3FrameProfile,
    videoMinimaxH3OmniFp8PdmdProfile,
    videoMinimaxH3OmniFp8Profile,
    videoMinimaxH3OmniProfile,
    MINIMAX_H3_SIZES,
    IMAGE_RESOLUTION_PRESETS,
    getImageDimensions,
    parseImageSizeTierAndRatio,
} from "../index";

describe("Workflow Model Profiles (MiniMax H3 4 FP8 Models)", () => {
    it("registers exactly 4 FP8 models and excludes BF16", () => {
        expect(BUILTIN_VIDEO_WORKFLOW_MODELS.length).toBe(4);
        expect(BUILTIN_VIDEO_WORKFLOW_MODELS.every((m) => m.precision === "fp8")).toBe(true);

        // BF16 models should be completely purged
        expect(getModelProfile("omni-video-minimax-h3-bf16-turbo")).toBeUndefined();
        expect(getModelProfile("omni-video-minimax-h3-bf16-20step")).toBeUndefined();
        expect(getModelProfile("frame-video-minimax-h3-bf16-turbo")).toBeUndefined();
        expect(getModelProfile("frame-video-minimax-h3-bf16-20step")).toBeUndefined();
    });

    it("registers omni-video-minimax-h3-fp8-4step-pdmd with 4 steps and 8GB VRAM tier", () => {
        const profile = getModelProfile("omni-video-minimax-h3-fp8-4step-pdmd");
        expect(profile).toBeDefined();
        expect(profile?.capability).toBe("video");
        expect(profile?.category).toBe("omniVideo");
        expect(profile?.steps).toBe(4);
        expect(profile?.precision).toBe("fp8");
        expect(profile?.vramTier).toBe("8GB");
        expect(profile?.capabilityConfig.vram?.recommendedDuration).toEqual({
            min: 3,
            max: 5,
            description: "推荐 8G/16G 显存，极速分镜 3~5 秒",
        });
        expect(profile?.capabilityConfig.references.maxImages).toBe(9);
        expect(profile?.capabilityConfig.references.maxVideos).toBe(3);
        expect(profile?.capabilityConfig.references.maxAudios).toBe(3);
        expect(profile?.capabilityConfig.size?.values).toEqual(MINIMAX_H3_SIZES);
        expect(profile?.capabilityConfig.duration?.tags).toEqual([5, 10, 15]);
    });

    it("registers omni-video-minimax-h3-fp8 with 20 steps and 16GB VRAM tier", () => {
        const profile = getModelProfile("omni-video-minimax-h3-fp8");
        expect(profile).toBeDefined();
        expect(profile?.steps).toBe(20);
        expect(profile?.precision).toBe("fp8");
        expect(profile?.vramTier).toBe("16GB");
        expect(profile?.capabilityConfig.vram?.recommendedDuration).toEqual({
            min: 5,
            max: 8,
            description: "推荐 16G/24G 显存，标准分镜 5~8 秒",
        });
    });

    it("registers frame-video-minimax-h3-fp8-4step-pdmd with 4 steps and strictly 2 frames quota", () => {
        const profile = getModelProfile("frame-video-minimax-h3-fp8-4step-pdmd");
        expect(profile).toBeDefined();
        expect(profile?.capability).toBe("video");
        expect(profile?.category).toBe("frameVideo");
        expect(profile?.steps).toBe(4);
        expect(profile?.precision).toBe("fp8");
        expect(profile?.vramTier).toBe("8GB");
        expect(profile?.capabilityConfig.references.minImages).toBe(2);
        expect(profile?.capabilityConfig.references.maxImages).toBe(2);
        expect(profile?.capabilityConfig.references.maxVideos).toBe(0);
        expect(profile?.capabilityConfig.references.maxAudios).toBe(0);
        expect(profile?.capabilityConfig.vram?.recommendedDuration).toEqual({
            min: 3,
            max: 5,
            description: "推荐 8G/16G 显存，极速插值 3~5 秒",
        });
    });

    it("registers frame-video-minimax-h3-fp8 with 20 steps and 16GB VRAM tier", () => {
        const profile = getModelProfile("frame-video-minimax-h3-fp8");
        expect(profile).toBeDefined();
        expect(profile?.steps).toBe(20);
        expect(profile?.precision).toBe("fp8");
        expect(profile?.vramTier).toBe("16GB");
        expect(profile?.capabilityConfig.vram?.recommendedDuration).toEqual({
            min: 5,
            max: 8,
            description: "推荐 16G/24G 显存，标准平滑插值 5~8 秒",
        });
    });

    it("resolves model profile by category keyword and legacy aliases", () => {
        expect(getModelProfile("video_minimax_h3_omni")?.id).toBe("omni-video-minimax-h3-fp8-4step-pdmd");
        expect(getModelProfile("video_minimax_h3_frame")?.id).toBe("frame-video-minimax-h3-fp8-4step-pdmd");
        expect(getModelProfile("omniVideo")?.id).toBe("omni-video-minimax-h3-fp8-4step-pdmd");
        expect(getModelProfile("omni 20")?.id).toBe("omni-video-minimax-h3-fp8");
        expect(getModelProfile("frameVideo")?.id).toBe("frame-video-minimax-h3-fp8-4step-pdmd");
        expect(getModelProfile("frame 20")?.id).toBe("frame-video-minimax-h3-fp8");
    });

    it("configures supportedTools on model profiles", () => {
        const omni = getModelProfile("omni-video-minimax-h3-fp8-4step-pdmd");
        expect(omni?.supportedTools?.faceRefine).toBe(true);
        expect(omni?.supportedTools?.depthVideo).toBe(true);

        const frame = getModelProfile("frame-video-minimax-h3-fp8-4step-pdmd");
        expect(frame?.supportedTools?.faceRefine).toBe(true);
        expect(frame?.supportedTools?.depthVideo).toBe(true);

        const image = getModelProfile("image-qwen-2.1");
        expect(image?.supportedTools?.maskEdit).toBe(true);
        expect(image?.supportedTools?.reversePrompt).toBe(true);
    });

    it("lists models by capability", () => {
        const videoModels = listModelsByCapability("video");
        expect(videoModels.length).toBe(4);
        expect(videoModels.map((m) => m.id)).toEqual([
            "omni-video-minimax-h3-fp8-4step-pdmd",
            "omni-video-minimax-h3-fp8",
            "frame-video-minimax-h3-fp8-4step-pdmd",
            "frame-video-minimax-h3-fp8",
        ]);

        const imageModels = listModelsByCapability("image");
        expect(imageModels.length).toBe(4);
        expect(imageModels.map((m) => m.id)).toEqual([
            "image-qwen-2.1",
            "image-z-turbo",
            "image-flux2-dev",
            "image-qwen-inpaint",
        ]);
    });
});

describe("Workflow Model Profiles (Image Workflow Models)", () => {
    it("registers exactly 4 native image models", () => {
        expect(BUILTIN_IMAGE_WORKFLOW_MODELS.length).toBe(4);
        expect(BUILTIN_IMAGE_WORKFLOW_MODELS.every((m) => m.capability === "image")).toBe(true);
    });

    it("registers image-qwen-2.1 with max 10 images and standard aspect ratios", () => {
        const profile = getModelProfile("image-qwen-2.1");
        expect(profile).toBeDefined();
        expect(profile?.capabilityConfig.references.maxImages).toBe(10);
        expect(profile?.capabilityConfig.references.minImages).toBe(0);
        expect(profile?.capabilityConfig.size?.parameter).toBe("aspect_ratio");
        expect(profile?.capabilityConfig.size?.values).toContain("1:1");
        expect(profile?.capabilityConfig.size?.values).toContain("9:16");
    });

    it("registers image-z-turbo as pure text-to-image (max 0 images)", () => {
        const profile = getModelProfile("image-z-turbo");
        expect(profile).toBeDefined();
        expect(profile?.capabilityConfig.references.maxImages).toBe(0);
    });

    it("registers image-flux2-dev with max 2 images", () => {
        const profile = getModelProfile("image-flux2-dev");
        expect(profile).toBeDefined();
        expect(profile?.capabilityConfig.references.maxImages).toBe(2);
    });

    it("registers image-qwen-inpaint with exactly 2 images (base + mask) and undefined size", () => {
        const profile = getModelProfile("image-qwen-inpaint");
        expect(profile).toBeDefined();
        expect(profile?.capabilityConfig.references.minImages).toBe(2);
        expect(profile?.capabilityConfig.references.maxImages).toBe(2);
        expect(profile?.capabilityConfig.references.maskSupported).toBe(true);
        expect(profile?.capabilityConfig.size).toBeUndefined();
    });

    it("resolves image profiles by legacy aliases", () => {
        expect(getModelProfile("t2i")?.id).toBe("image-qwen-2.1");
        expect(getModelProfile("qwen-2.1")?.id).toBe("image-qwen-2.1");
        expect(getModelProfile("turbo")?.id).toBe("image-z-turbo");
        expect(getModelProfile("z-turbo")?.id).toBe("image-z-turbo");
        expect(getModelProfile("i2i")?.id).toBe("image-flux2-dev");
        expect(getModelProfile("flux")?.id).toBe("image-flux2-dev");
        expect(getModelProfile("inpaint")?.id).toBe("image-qwen-inpaint");
    });

    it("resolves text profiles and aliases correctly", () => {
        expect(getModelProfile("text-qwen-35")?.id).toBe("text-qwen-35");
        expect(getModelProfile("text-qwen-35-chat")?.id).toBe("text-qwen-35");
        expect(getModelProfile("qwen-35-chat")?.id).toBe("text-qwen-35");
        expect(getModelProfile("qwen3.5 4b")?.id).toBe("text-qwen-35");
        expect(getModelProfile("text")?.id).toBe("text-qwen-35");

        expect(getModelProfile("text-qwen-35-vlm")?.id).toBe("text-qwen-35");
        expect(getModelProfile("qwen-35-vlm")?.id).toBe("text-qwen-35");
        expect(getModelProfile("vlm")?.id).toBe("text-qwen-35");

        const textProfile = getModelProfile("text-qwen-35");
        expect(textProfile?.capability).toBe("text");
        expect(textProfile?.capabilityConfig.references.minImages).toBe(0);
        expect(textProfile?.capabilityConfig.references.maxImages).toBe(1);
        expect(textProfile?.capabilityConfig.textConfig).toBeUndefined();
    });

    it("verifies 1K / 2K / 4K resolution tiers and 64-pixel alignment presets", () => {
        // 1K presets (512 base)
        expect(IMAGE_RESOLUTION_PRESETS["1k"]["1:1"]).toEqual({ width: 512, height: 512 });
        expect(IMAGE_RESOLUTION_PRESETS["1k"]["16:9"]).toEqual({ width: 640, height: 384 });
        expect(IMAGE_RESOLUTION_PRESETS["1k"]["9:16"]).toEqual({ width: 384, height: 640 });
        expect(IMAGE_RESOLUTION_PRESETS["1k"]["4:3"]).toEqual({ width: 576, height: 448 });
        expect(IMAGE_RESOLUTION_PRESETS["1k"]["3:4"]).toEqual({ width: 448, height: 576 });

        // 2K presets (1024 base)
        expect(IMAGE_RESOLUTION_PRESETS["2k"]["1:1"]).toEqual({ width: 1024, height: 1024 });
        expect(IMAGE_RESOLUTION_PRESETS["2k"]["16:9"]).toEqual({ width: 1344, height: 768 });
        expect(IMAGE_RESOLUTION_PRESETS["2k"]["9:16"]).toEqual({ width: 768, height: 1344 });

        // 4K presets (2048 base)
        expect(IMAGE_RESOLUTION_PRESETS["4k"]["1:1"]).toEqual({ width: 2048, height: 2048 });
        expect(IMAGE_RESOLUTION_PRESETS["4k"]["16:9"]).toEqual({ width: 2688, height: 1536 });
        expect(IMAGE_RESOLUTION_PRESETS["4k"]["9:16"]).toEqual({ width: 1536, height: 2688 });

        // Default size in profiles is 512x512
        expect(imageQwen21Profile.capabilityConfig.size?.default).toBe("512x512");
        expect(imageZTurboProfile.capabilityConfig.size?.default).toBe("512x512");
        expect(imageFlux2DevProfile.capabilityConfig.size?.default).toBe("512x512");
    });

    it("verifies getImageDimensions and parseImageSizeTierAndRatio helpers", () => {
        expect(getImageDimensions("1:1", "1k")).toEqual({ width: 512, height: 512 });
        expect(getImageDimensions("16:9", "2k")).toEqual({ width: 1344, height: 768 });
        expect(getImageDimensions("1:1", "4k")).toEqual({ width: 2048, height: 2048 });

        // Exact pixel match
        expect(parseImageSizeTierAndRatio("512x512")).toEqual({
            tier: "1k",
            ratio: "1:1",
            width: 512,
            height: 512,
        });
        expect(parseImageSizeTierAndRatio("1344x768")).toEqual({
            tier: "2k",
            ratio: "16:9",
            width: 1344,
            height: 768,
        });
        expect(parseImageSizeTierAndRatio("2688x1536")).toEqual({
            tier: "4k",
            ratio: "16:9",
            width: 2688,
            height: 1536,
        });

        // Ratio strings
        expect(parseImageSizeTierAndRatio("1:1")).toEqual({
            tier: "1k",
            ratio: "1:1",
            width: 512,
            height: 512,
        });
        expect(parseImageSizeTierAndRatio("16:9-2k")).toEqual({
            tier: "2k",
            ratio: "16:9",
            width: 1344,
            height: 768,
        });
    });
});

describe("validateModelExecution (Fail-loud validation)", () => {
    it("rejects frame video when image count is not exactly 2", () => {
        expect(() =>
            validateModelExecution(videoMinimaxH3FrameFp8PdmdProfile, { imagesCount: 1 })
        ).toThrow("至少需要 2 张参考图片");

        expect(() =>
            validateModelExecution(videoMinimaxH3FrameFp8PdmdProfile, { imagesCount: 3 })
        ).toThrow("最多支持 2 张参考图片");
    });

    it("rejects omni video when resource limits are exceeded", () => {
        expect(() =>
            validateModelExecution(videoMinimaxH3OmniFp8PdmdProfile, { imagesCount: 10 })
        ).toThrow("最多支持 9 张参考图片");

        expect(() =>
            validateModelExecution(videoMinimaxH3OmniFp8PdmdProfile, { videosCount: 4 })
        ).toThrow("最多支持 3 个参考视频");

        expect(() =>
            validateModelExecution(videoMinimaxH3OmniFp8PdmdProfile, { audiosCount: 4 })
        ).toThrow("最多支持 3 个参考音频");
    });

    it("rejects sizes outside the 9 hardware-aligned tiers", () => {
        expect(() =>
            validateModelExecution(videoMinimaxH3OmniFp8PdmdProfile, { size: "1000x500" })
        ).toThrow("不支持尺寸 1000x500");

        // Valid size should not throw
        expect(() =>
            validateModelExecution(videoMinimaxH3OmniFp8PdmdProfile, { size: "1280x736" })
        ).not.toThrow();

        expect(() =>
            validateModelExecution(videoMinimaxH3OmniFp8PdmdProfile, { size: "736x1280" })
        ).not.toThrow();
    });

    it("rejects duration outside the 1-15s range", () => {
        expect(() =>
            validateModelExecution(videoMinimaxH3OmniFp8PdmdProfile, { duration: 0 })
        ).toThrow("必须在 1 ~ 15 秒之间");

        expect(() =>
            validateModelExecution(videoMinimaxH3OmniFp8PdmdProfile, { duration: 16 })
        ).toThrow("必须在 1 ~ 15 秒之间");

        expect(() =>
            validateModelExecution(videoMinimaxH3OmniFp8PdmdProfile, { duration: 8 })
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
        const dispatched = dispatchComfyuiModelWorkflow(videoMinimaxH3OmniFp8PdmdProfile, rawWorkflow, {
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

        const dispatched = dispatchComfyuiModelWorkflow(videoMinimaxH3FrameFp8PdmdProfile, rawWorkflow, {
            prompt: "从破损空间站飞向恒星",
            firstFrameAssetId: "asset_first.png",
            lastFrameAssetId: "asset_last.png",
        });

        expect((dispatched["10"] as any).inputs.image).toBe("asset_first.png");
        expect((dispatched["11"] as any).inputs.image).toBe("asset_last.png");
    });

    it("binds parameters and prunes unassigned slots in Qwen 2.1 image workflow", () => {
        const rawWorkflow = {
            "1": { inputs: { value: "old prompt" }, class_type: "PrimitiveStringMultiline", _meta: { title: "prompt" } },
            "2": { inputs: { value: 1024 }, class_type: "PrimitiveInt", _meta: { title: "width" } },
            "3": { inputs: { value: 1024 }, class_type: "PrimitiveInt", _meta: { title: "height" } },
            "4": { inputs: { value: 0 }, class_type: "PrimitiveInt", _meta: { title: "seed" } },
            "11": { inputs: { image: "old1.png" }, class_type: "LoadImage", _meta: { title: "ref_image_01" } },
            "12": { inputs: { image: "old2.png" }, class_type: "LoadImage", _meta: { title: "ref_image_02" } },
            "13": { inputs: { image: "old3.png" }, class_type: "LoadImage", _meta: { title: "ref_image_03" } },
            "20": {
                inputs: {
                    "images.image_1": ["11", 0],
                    "images.image_2": ["12", 0],
                    "images.image_3": ["13", 0],
                },
                class_type: "TextEncodeQwenImage21",
            },
            "30": { inputs: { width: 1024, height: 1024 }, class_type: "EmptyLatentImage", _meta: { title: "空Latent图像" } },
            "31": { inputs: { switch: true, on_false: ["20", 2], on_true: ["30", 0] }, class_type: "ComfySwitchNode", _meta: { title: "切换" } },
        };

        const dispatched = dispatchComfyuiModelWorkflow(imageQwen21Profile, rawWorkflow, {
            prompt: "赛博朋克雨夜街道",
            width: 768,
            height: 1024,
            seed: 888,
            assetIds: ["new_ref1.png"],
        });

        expect((dispatched["1"] as any).inputs.value).toBe("赛博朋克雨夜街道");
        expect((dispatched["2"] as any).inputs.value).toBe(768);
        expect((dispatched["3"] as any).inputs.value).toBe(1024);
        expect((dispatched["4"] as any).inputs.value).toBe(888);
        expect((dispatched["11"] as any).inputs.image).toBe("new_ref1.png");
        expect(dispatched["12"]).toBeUndefined();
        expect(dispatched["13"]).toBeUndefined();
        expect((dispatched["20"] as any).inputs["images.image_1"]).toEqual(["11", 0]);
        expect((dispatched["20"] as any).inputs["images.image_2"]).toBeUndefined();
        expect((dispatched["20"] as any).inputs["images.image_3"]).toBeUndefined();
        expect((dispatched["31"] as any).inputs.switch).toBe(false);

        // 当无参考图时，自动回退纯文生图 (switch = true 走 EmptyLatentImage)
        const t2iDispatched = dispatchComfyuiModelWorkflow(imageQwen21Profile, rawWorkflow, {
            prompt: "纯文生图测试",
            width: 768,
            height: 1024,
            seed: 888,
            assetIds: [],
        });
        expect((t2iDispatched["31"] as any).inputs.switch).toBe(true);
    });

    it("binds ref_image_01 and ref_mask in Qwen Inpaint workflow", () => {
        const rawWorkflow = {
            "1": { inputs: { value: "old prompt" }, class_type: "PrimitiveStringMultiline", _meta: { title: "prompt" } },
            "2": { inputs: { value: 0 }, class_type: "PrimitiveInt", _meta: { title: "seed" } },
            "10": { inputs: { image: "source.png" }, class_type: "LoadImage", _meta: { title: "ref_image_01" } },
            "11": { inputs: { image: "mask.png" }, class_type: "LoadImage", _meta: { title: "ref_mask" } },
        };

        const dispatched = dispatchComfyuiModelWorkflow(imageQwenInpaintProfile, rawWorkflow, {
            prompt: "戴红色帽子的猫",
            seed: 12345,
            assetIds: ["source_uploaded.png"],
            maskAssetId: "mask_uploaded.png",
        });

        expect((dispatched["1"] as any).inputs.value).toBe("戴红色帽子的猫");
        expect((dispatched["2"] as any).inputs.value).toBe(12345);
        expect((dispatched["10"] as any).inputs.image).toBe("source_uploaded.png");
        expect((dispatched["11"] as any).inputs.image).toBe("mask_uploaded.png");
    });

    it("applies text bindings cleanly and prunes image node for pure text chat", () => {
        const textWorkflow = {
            "1": { inputs: { value: "old prompt" }, class_type: "PrimitiveStringMultiline", _meta: { title: "prompt" } },
            "2": { inputs: { value: 0 }, class_type: "PrimitiveInt", _meta: { title: "seed" } },
            "3": {
                inputs: {
                    prompt: ["1", 0],
                    image: ["12", 0],
                    max_length: 256,
                    thinking: false,
                },
                class_type: "TextGenerate",
                _meta: { title: "TextGenerate" },
            },
            "12": { inputs: { image: "old.png" }, class_type: "LoadImage", _meta: { title: "ref_image_01" } },
        };

        const bound = applyTextBindings(textWorkflow as any, {
            prompt: "扩写一段关于未来城市的生图提示词",
            seed: 8888,
            maxLength: 1024,
            thinking: true,
        });

        expect((bound["1"] as any).inputs.value).toBe("扩写一段关于未来城市的生图提示词");
        expect((bound["2"] as any).inputs.value).toBe(8888);
        expect(bound["12"]).toBeUndefined();
        expect((bound["3"] as any).inputs.image).toBeUndefined();
        expect((bound["3"] as any).inputs.max_length).toBe(1024);
        expect((bound["3"] as any).inputs.thinking).toBe(true);
    });

    it("applies VLM text bindings with reference image and fallback reverse prompt", () => {
        const textWorkflow = {
            "1": { inputs: { value: "old prompt" }, class_type: "PrimitiveStringMultiline", _meta: { title: "prompt" } },
            "2": { inputs: { value: 0 }, class_type: "PrimitiveInt", _meta: { title: "seed" } },
            "3": {
                inputs: {
                    prompt: ["1", 0],
                    image: ["12", 0],
                    max_length: 256,
                    thinking: false,
                },
                class_type: "TextGenerate",
                _meta: { title: "TextGenerate" },
            },
            "12": { inputs: { image: "old.png" }, class_type: "LoadImage", _meta: { title: "ref_image_01" } },
        };

        // 1. With custom prompt & reference image
        const boundCustom = applyTextBindings(textWorkflow as any, {
            prompt: "从参考图中提取赛博朋克光影与主体结构",
            assetId: "uploaded_photo.png",
            seed: 6666,
            maxLength: 512,
            thinking: true,
        });

        expect((boundCustom["1"] as any).inputs.value).toBe("从参考图中提取赛博朋克光影与主体结构");
        expect((boundCustom["2"] as any).inputs.value).toBe(6666);
        expect((boundCustom["12"] as any).inputs.image).toBe("uploaded_photo.png");
        expect((boundCustom["3"] as any).inputs.image).toEqual(["12", 0]);
        expect((boundCustom["3"] as any).inputs.max_length).toBe(512);
        expect((boundCustom["3"] as any).inputs.thinking).toBe(true);

        // 2. With empty prompt: falls back to reverse-engineering default instructions
        const boundFallback = applyTextBindings(textWorkflow as any, {
            prompt: "",
            assetId: "uploaded_photo.png",
            seed: 7777,
        });
        expect((boundFallback["1"] as any).inputs.value).toContain("反推一段适合用于 AI 生图的提示词");
        expect((boundFallback["12"] as any).inputs.image).toBe("uploaded_photo.png");
    });
});
