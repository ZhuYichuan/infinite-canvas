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
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 20000,
            minImages: 0,
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
    },
    slotMapping: FRAME_SLOT_MAPPING,
    description: "MiniMax H3 首尾帧插值视频极速版 (FP8 4步 PDMD)，支持 0~2 张参考图（首尾插值或纯提示词生成），4 步瞬间成片。",
    supportedTools: {
        faceRefine: true,
        depthVideo: true,
    },
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
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 20000,
            minImages: 0,
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
    },
    slotMapping: FRAME_SLOT_MAPPING,
    description: "MiniMax H3 首尾帧插值视频标准版 (FP8 Scaled)，支持 0~2 张参考图，平滑细腻过渡，适合高质量关键帧演化。",
    supportedTools: {
        faceRefine: true,
        depthVideo: true,
    },
};

/**
 * MiniMax H3 首尾帧插值视频 (INT8 4步 PDMD 极速版)
 * 底模替换为 INT8 旋转量化权重（int8_convrot），绕开 FP8 硬件加速依赖，
 * 首尾帧插槽、尺寸与时长能力与 FP8 4步 PDMD 完全一致
 */
export const videoMinimaxH3FrameInt8PdmdProfile: WorkflowModelProfile = {
    id: "frame-video-minimax-h3-int8-4step-pdmd",
    name: "MiniMax H3 首尾帧 (INT8 4步 PDMD)",
    capability: "video",
    protocol: "comfyui",
    category: "frameVideo",
    steps: 4,
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 20000,
            minImages: 0,
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
    },
    slotMapping: FRAME_SLOT_MAPPING,
    description: "MiniMax H3 首尾帧插值视频 (INT8 旋转量化底模 + 4步 PDMD)，支持 0~2 张参考图，用于不启用 FP8 硬件加速的运行环境。",
    supportedTools: {
        faceRefine: true,
        depthVideo: true,
    },
};

/**
 * 历史别名兼容
 */
export const videoMinimaxH3FrameProfile = videoMinimaxH3FrameFp8PdmdProfile;
