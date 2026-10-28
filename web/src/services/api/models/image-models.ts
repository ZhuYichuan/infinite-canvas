import type { WorkflowModelProfile } from "./types";

/**
 * 通用生图常用比例预设
 */
export const IMAGE_STANDARD_ASPECT_RATIOS = [
    "1:1",
    "3:4",
    "4:3",
    "9:16",
    "16:9",
    "2:3",
    "3:2",
];

/**
 * 1. Qwen-Image-2.1 全能生图 (默认主推模型)
 * 原生支持文生图及最多 10 张多参考图协同构图与风格融合
 */
export const imageQwen21Profile: WorkflowModelProfile = {
    id: "image-qwen-2.1",
    name: "Qwen-Image 2.1 全能",
    capability: "image",
    protocol: "comfyui",
    category: "t2i",
    precision: "bf16",
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 20000,
            minImages: 0,
            maxImages: 10,
            maskSupported: false,
            minVideos: 0,
            maxVideos: 0,
            maxAudios: 0,
        },
        size: {
            parameter: "aspect_ratio",
            values: IMAGE_STANDARD_ASPECT_RATIOS,
            default: "9:16",
            allowCustom: true,
        },
    },
    slotMapping: {
        prompt: "prompt",
        seed: "seed",
        width: "width",
        height: "height",
        images: "ref_image_01..10",
        output: "out_image",
    },
    description: "Qwen-Image 2.1 全能生图，原生支持文生图及最多 10 张多参考图构图与风格融合。",
};

/**
 * 2. Z-Image-Turbo 极速文生图
 * SVD / Lumina2 架构，极速出片，纯文生图，不支持外部参考图
 */
export const imageZTurboProfile: WorkflowModelProfile = {
    id: "image-z-turbo",
    name: "Z-Image Turbo 极速",
    capability: "image",
    protocol: "comfyui",
    category: "t2i",
    steps: 8,
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 20000,
            minImages: 0,
            maxImages: 0,
            maskSupported: false,
            minVideos: 0,
            maxVideos: 0,
            maxAudios: 0,
        },
        size: {
            parameter: "aspect_ratio",
            values: ["1:1", "3:4", "4:3", "9:16", "16:9"],
            default: "9:16",
            allowCustom: true,
        },
    },
    slotMapping: {
        prompt: "prompt",
        seed: "seed",
        width: "width",
        height: "height",
        output: "output_image",
    },
    description: "Z-Image-Turbo 极速文生图，仅需数步即可成片，纯文生图，不支持参考图输入。",
};

/**
 * 3. Flux2.Dev 图生图与双图融合
 * 深度图生图与双图融合，最多支持 2 张参考图（单图垫图或双图融合）
 */
export const imageFlux2DevProfile: WorkflowModelProfile = {
    id: "image-flux2-dev",
    name: "Flux2.Dev 垫图与双图融合",
    capability: "image",
    protocol: "comfyui",
    category: "i2i",
    steps: 20,
    precision: "bf16",
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 20000,
            minImages: 0,
            maxImages: 2,
            maskSupported: false,
            minVideos: 0,
            maxVideos: 0,
            maxAudios: 0,
        },
        size: {
            parameter: "aspect_ratio",
            values: IMAGE_STANDARD_ASPECT_RATIOS,
            default: "9:16",
            allowCustom: true,
        },
    },
    slotMapping: {
        prompt: "prompt",
        seed: "seed",
        width: "width",
        height: "height",
        images: "ref_image_01..02",
        output: "output_image",
    },
    description: "Flux2.Dev 深度图生图与双图融合，支持 1~2 张参考图的角色/风格融合与图像重绘。",
};

/**
 * 4. Qwen-Image 局部编辑重绘
 * 专用于蒙版涂抹局部重绘，严格需要 1 底图 + 1 蒙版
 * 遵循工作流驱动原则：工作流中没有独立的 width/height 槽位（底图尺寸自适应），UI 不暴露尺寸调整
 */
export const imageQwenInpaintProfile: WorkflowModelProfile = {
    id: "image-qwen-inpaint",
    name: "Qwen-Image 局部编辑",
    capability: "image",
    protocol: "comfyui",
    category: "inpaint",
    steps: 20,
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 20000,
            minImages: 1,
            maxImages: 1,
            maskSupported: true,
            minVideos: 0,
            maxVideos: 0,
            maxAudios: 0,
        },
        // 尺寸自适应原图，工作流无独立尺寸节点，不配置 size，驱动 UI 彻底隐藏尺寸面板
    },
    slotMapping: {
        prompt: "prompt",
        seed: "seed",
        images: "ref_image_01",
        mask: "ref_mask",
        output: "output_image",
    },
    description: "Qwen-Image 局部涂抹重绘，精准修改蒙版选区，底图尺寸自适应，界面无需尺寸调节。",
};

/**
 * 系统内置图片模型清单
 */
export const IMAGE_WORKFLOW_MODELS: WorkflowModelProfile[] = [
    imageQwen21Profile,
    imageZTurboProfile,
    imageFlux2DevProfile,
    imageQwenInpaintProfile,
];
