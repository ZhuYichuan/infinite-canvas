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
    precision: "fp8",
    vramTier: "8GB",
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
        vram: {
            tier: "8GB",
            recommendedDuration: {
                min: 3,
                max: 5,
                description: "推荐 8G/16G 显存，极速分镜 3~5 秒",
            },
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
    precision: "fp8",
    vramTier: "16GB",
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
        vram: {
            tier: "16GB",
            recommendedDuration: {
                min: 5,
                max: 8,
                description: "推荐 16G/24G 显存，标准分镜 5~8 秒",
            },
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
 * 历史别名兼容
 */
export const videoMinimaxH3OmniProfile = videoMinimaxH3OmniFp8PdmdProfile;
