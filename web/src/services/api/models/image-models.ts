import type { WorkflowModelProfile } from "./types";

export type ImageResolutionTier = "1k" | "2k" | "4k";
export type ImageAspectRatio = "1:1" | "4:3" | "3:4" | "3:2" | "2:3" | "16:9" | "9:16";

export interface ImageDimensionPreset {
    width: number;
    height: number;
}

/**
 * 满足 64 像素整除硬件对齐与同档位面积恒定的 1K / 2K / 4K 分辨率映射表
 * 1K：以 512×512 为 1:1 基准 (约 26 万像素，极速出片)
 * 2K：以 1024×1024 为 1:1 基准 (约 104 万像素，高清标准)
 * 4K：以 2048×2048 为 1:1 基准 (约 419 万像素，超高清精修)
 */
export const IMAGE_RESOLUTION_PRESETS: Record<ImageResolutionTier, Record<ImageAspectRatio, ImageDimensionPreset>> = {
    "1k": {
        "1:1": { width: 512, height: 512 },
        "4:3": { width: 576, height: 448 },
        "3:4": { width: 448, height: 576 },
        "3:2": { width: 640, height: 448 },
        "2:3": { width: 448, height: 640 },
        "16:9": { width: 640, height: 384 },
        "9:16": { width: 384, height: 640 },
    },
    "2k": {
        "1:1": { width: 1024, height: 1024 },
        "4:3": { width: 1152, height: 896 },
        "3:4": { width: 896, height: 1152 },
        "3:2": { width: 1216, height: 832 },
        "2:3": { width: 832, height: 1216 },
        "16:9": { width: 1344, height: 768 },
        "9:16": { width: 768, height: 1344 },
    },
    "4k": {
        "1:1": { width: 2048, height: 2048 },
        "4:3": { width: 2304, height: 1728 },
        "3:4": { width: 1728, height: 2304 },
        "3:2": { width: 2496, height: 1664 },
        "2:3": { width: 1664, height: 2496 },
        "16:9": { width: 2688, height: 1536 },
        "9:16": { width: 1536, height: 2688 },
    },
};

/**
 * 通用生图常用比例预设
 */
export const IMAGE_STANDARD_ASPECT_RATIOS: ImageAspectRatio[] = [
    "1:1",
    "4:3",
    "3:4",
    "3:2",
    "2:3",
    "16:9",
    "9:16",
];

export const IMAGE_RESOLUTION_TIERS: ImageResolutionTier[] = ["1k", "2k", "4k"];

/**
 * 根据分辨率档位和比例获取具体的宽高
 */
export function getImageDimensions(ratio: ImageAspectRatio | string, tier: ImageResolutionTier = "1k"): ImageDimensionPreset {
    const tierMap = IMAGE_RESOLUTION_PRESETS[tier] || IMAGE_RESOLUTION_PRESETS["1k"];
    const preset = tierMap[ratio as ImageAspectRatio];
    if (preset) return preset;
    return tierMap["1:1"] || { width: 512, height: 512 };
}

/**
 * 从尺寸字符串（如 "512x512", "1344x768", "16:9-2k", "1:1" 等）解析出当前所处的清晰度档位与比例
 */
export function parseImageSizeTierAndRatio(sizeStr?: string): { tier: ImageResolutionTier; ratio: ImageAspectRatio | null; width: number; height: number } {
    const raw = (sizeStr || "").trim().toLowerCase();
    // 1. 精确像素字符串匹配 "512x512"
    const pixelMatch = raw.match(/^(\d+)\s*[x×]\s*(\d+)$/);
    if (pixelMatch) {
        const width = Number(pixelMatch[1]);
        const height = Number(pixelMatch[2]);
        for (const tier of IMAGE_RESOLUTION_TIERS) {
            for (const ratio of IMAGE_STANDARD_ASPECT_RATIOS) {
                const preset = IMAGE_RESOLUTION_PRESETS[tier][ratio];
                if (preset.width === width && preset.height === height) {
                    return { tier, ratio, width, height };
                }
            }
        }
        // 如果不在预设中，根据像素总面积推测最接近的档位
        const area = width * height;
        const tier: ImageResolutionTier = area > 2000000 ? "4k" : area > 600000 ? "2k" : "1k";
        return { tier, ratio: null, width, height };
    }

    // 2. 比例与档位匹配，如 "16:9-2k", "1:1"
    const ratioMatch = raw.match(/^(\d+:\d+)(?:[-_](1k|2k|4k))?$/i);
    if (ratioMatch) {
        const ratio = ratioMatch[1] as ImageAspectRatio;
        const tier = (ratioMatch[2]?.toLowerCase() || "1k") as ImageResolutionTier;
        const dim = getImageDimensions(ratio, tier);
        return { tier, ratio: IMAGE_STANDARD_ASPECT_RATIOS.includes(ratio) ? ratio : null, width: dim.width, height: dim.height };
    }

    // 默认 1K 1:1
    const def = IMAGE_RESOLUTION_PRESETS["1k"]["1:1"];
    return { tier: "1k", ratio: "1:1", width: def.width, height: def.height };
}

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
            default: "512x512",
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
            values: ["1:1", "4:3", "3:4", "16:9", "9:16"],
            default: "512x512",
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
            default: "512x512",
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
