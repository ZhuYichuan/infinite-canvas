import type { WorkflowModelProfile } from "./types";

/**
 * MiniMax H3 官方支持的 32 整数倍尺寸对齐档位（上限严格锁死在 0.98 MP）
 */
export const MINIMAX_H3_SIZES: string[] = [
    "608x352", "352x608",     // 0.2 MP
    "736x416", "416x736",     // 0.3 MP
    "864x480", "480x864",     // 0.4 MP
    "960x544", "544x960",     // 0.5 MP
    "1056x608", "608x1056",   // 0.6 MP
    "1152x640", "640x1152",   // 0.7 MP
    "1216x672", "672x1216",   // 0.8 MP
    "1280x736", "736x1280",   // 0.9 MP
    "1344x768", "768x1344",   // 0.98 MP
];

/**
 * 通用全模态参考槽位映射契约（01..09 图，01..03 视频，01..03 音频）
 */
const OMNI_SLOT_MAPPING = {
    prompt: "prompt",
    seed: "seed",
    width: "width",
    height: "height",
    duration: "duration",
    images: "ref_image_01..09",
    videos: "ref_video_01..03",
    audios: "ref_audio_01..03",
    output: "output_video",
};

/**
 * MiniMax H3 全能参考视频 (FP8 4步 PDMD 极速版)
 * 默认主推模型，集成 EasyCache 特征缓存，推荐 8GB/16GB 显存，单次分镜 3~5 秒
 */
export const videoMinimaxH3OmniFp8PdmdProfile: WorkflowModelProfile = {
    id: "omni-video-minimax-h3-fp8-4step-pdmd",
    name: "MiniMax H3 全能 (FP8 4步 PDMD)",
    capability: "video",
    protocol: "comfyui",
    category: "omniVideo",
    steps: 4,
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 20000,
            minImages: 0,
            maxImages: 9,
            maskSupported: false,
            minVideos: 0,
            maxVideos: 3,
            maxAudios: 3,
        },
        size: {
            parameter: "size",
            values: MINIMAX_H3_SIZES,
            default: "1280x736",
            allowCustom: false,
        },
        duration: {
            selection: "range",
            min: 1,
            max: 15,
            step: 1,
            tags: [5, 10, 15],
            default: 5,
        },
    },
    slotMapping: OMNI_SLOT_MAPPING,
    description: "MiniMax H3 全能参考视频极速版 (FP8 4步 PDMD, 集成 EasyCache)，最多支持 9 图 + 3 视频 + 3 音频，极速成片。",
    supportedTools: {
        faceRefine: true,
        depthVideo: true,
    },
};

/**
 * MiniMax H3 全能参考视频 (FP8 20步 标准版)
 * 细节保真度更高，光影演化更平滑，推荐 16GB/24GB 显存，单次分镜 5~8 秒
 */
export const videoMinimaxH3OmniFp8Profile: WorkflowModelProfile = {
    id: "omni-video-minimax-h3-fp8",
    name: "MiniMax H3 全能 (FP8 20步)",
    capability: "video",
    protocol: "comfyui",
    category: "omniVideo",
    steps: 20,
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 20000,
            minImages: 0,
            maxImages: 9,
            maskSupported: false,
            minVideos: 0,
            maxVideos: 3,
            maxAudios: 3,
        },
        size: {
            parameter: "size",
            values: MINIMAX_H3_SIZES,
            default: "1280x736",
            allowCustom: false,
        },
        duration: {
            selection: "range",
            min: 1,
            max: 15,
            step: 1,
            tags: [5, 10, 15],
            default: 5,
        },
    },
    slotMapping: OMNI_SLOT_MAPPING,
    description: "MiniMax H3 全能参考视频标准版 (FP8 Scaled)，细节丰富，光影演化自然，适合高质量成片。",
    supportedTools: {
        faceRefine: true,
        depthVideo: true,
    },
};

/**
 * MiniMax H3 全能参考视频 (INT8 4步 PDMD 极速版)
 * 底模替换为 INT8 旋转量化权重（int8_convrot）以绕开 FP8 硬件加速依赖，
 * 采样机制、参考插槽、尺寸与时长能力与 FP8 4步 PDMD 完全一致
 */
export const videoMinimaxH3OmniInt8PdmdProfile: WorkflowModelProfile = {
    id: "omni-video-minimax-h3-int8-4step-pdmd",
    name: "MiniMax H3 全能 (INT8 4步 PDMD)",
    capability: "video",
    protocol: "comfyui",
    category: "omniVideo",
    steps: 4,
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 20000,
            minImages: 0,
            maxImages: 9,
            maskSupported: false,
            minVideos: 0,
            maxVideos: 3,
            maxAudios: 3,
        },
        size: {
            parameter: "size",
            values: MINIMAX_H3_SIZES,
            default: "1280x736",
            allowCustom: false,
        },
        duration: {
            selection: "range",
            min: 1,
            max: 15,
            step: 1,
            tags: [5, 10, 15],
            default: 5,
        },
    },
    slotMapping: OMNI_SLOT_MAPPING,
    description: "MiniMax H3 全能参考视频 (INT8 旋转量化底模 + 4步 PDMD + EasyCache)，用于不启用 FP8 硬件加速的运行环境，能力与 FP8 4步 PDMD 一致。",
    supportedTools: {
        faceRefine: true,
        depthVideo: true,
    },
};

/**
 * MiniMax H3 全能参考视频 (INT8 6步 Pika 质感版)
 * 底模同 INT8 旋转量化权重，蒸馏 LoRA 换为 Pika Flex（6 步），换取更充分的细节与光影演变
 */
export const videoMinimaxH3OmniInt8PikaProfile: WorkflowModelProfile = {
    id: "omni-video-minimax-h3-int8-6step-pika",
    name: "MiniMax H3 全能 (INT8 6步 Pika)",
    capability: "video",
    protocol: "comfyui",
    category: "omniVideo",
    steps: 6,
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 20000,
            minImages: 0,
            maxImages: 9,
            maskSupported: false,
            minVideos: 0,
            maxVideos: 3,
            maxAudios: 3,
        },
        size: {
            parameter: "size",
            values: MINIMAX_H3_SIZES,
            default: "1280x736",
            allowCustom: false,
        },
        duration: {
            selection: "range",
            min: 1,
            max: 15,
            step: 1,
            tags: [5, 10, 15],
            default: 5,
        },
    },
    slotMapping: OMNI_SLOT_MAPPING,
    description: "MiniMax H3 全能参考视频 (INT8 旋转量化底模 + Pika Flex 6步蒸馏 LoRA + EasyCache)，相对 4 步 PDMD 换取更充分的细节与光影演变。",
    supportedTools: {
        faceRefine: true,
        depthVideo: true,
    },
};

/**
 * 历史别名兼容
 */
export const videoMinimaxH3OmniProfile = videoMinimaxH3OmniFp8PdmdProfile;
