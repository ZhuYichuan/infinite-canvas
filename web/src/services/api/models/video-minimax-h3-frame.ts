import type { WorkflowModelProfile } from "./types";
import { MINIMAX_H3_SIZES } from "./video-minimax-h3-omni";

/**
 * 通用首尾帧插值槽位映射契约（first_frame + last_frame 两图插值）
 */
const FRAME_SLOT_MAPPING = {
    prompt: "prompt",
    seed: "seed",
    width: "width",
    height: "height",
    duration: "duration",
    firstFrame: "first_frame",
    lastFrame: "last_frame",
    output: "output_video",
};

/**
 * MiniMax H3 首尾帧插值视频 (FP8 4步 PDMD 极速版)
 * 默认首尾插值模型，4 步瞬间成片，推荐 8GB/16GB 显存，单次分镜 3~5 秒
 */
export const videoMinimaxH3FrameFp8PdmdProfile: WorkflowModelProfile = {
    id: "frame-video-minimax-h3-fp8-4step-pdmd",
    name: "MiniMax H3 首尾帧 (FP8 4步 PDMD)",
    capability: "video",
    protocol: "comfyui",
    category: "frameVideo",
    steps: 4,
    precision: "fp8",
    vramTier: "8GB",
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 2000,
            minImages: 2,
            maxImages: 2,
            maskSupported: false,
            minVideos: 0,
            maxVideos: 0,
            minAudios: 0,
            maxAudios: 0,
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
                description: "推荐 8G/16G 显存，极速插值 3~5 秒",
            },
        },
    },
    slotMapping: FRAME_SLOT_MAPPING,
    description: "MiniMax H3 首尾帧插值视频极速版 (FP8 4步 PDMD)，严格首尾两帧两张参考图，4 步瞬间成片。",
};

/**
 * MiniMax H3 首尾帧插值视频 (FP8 20步 标准版)
 * 边缘与光影过渡更细腻，推荐 16GB/24GB 显存，单次分镜 5~8 秒
 */
export const videoMinimaxH3FrameFp8Profile: WorkflowModelProfile = {
    id: "frame-video-minimax-h3-fp8",
    name: "MiniMax H3 首尾帧 (FP8 20步)",
    capability: "video",
    protocol: "comfyui",
    category: "frameVideo",
    steps: 20,
    precision: "fp8",
    vramTier: "16GB",
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 2000,
            minImages: 2,
            maxImages: 2,
            maskSupported: false,
            minVideos: 0,
            maxVideos: 0,
            minAudios: 0,
            maxAudios: 0,
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
                description: "推荐 16G/24G 显存，标准平滑插值 5~8 秒",
            },
        },
    },
    slotMapping: FRAME_SLOT_MAPPING,
    description: "MiniMax H3 首尾帧插值视频标准版 (FP8 Scaled)，平滑细腻过度，适合高质量关键帧演化。",
};

/**
 * 历史别名兼容
 */
export const videoMinimaxH3FrameProfile = videoMinimaxH3FrameFp8PdmdProfile;
