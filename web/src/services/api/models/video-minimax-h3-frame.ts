import type { WorkflowModelProfile } from "./types";
import { MINIMAX_H3_SIZES, getDslMiddleSize } from "./video-minimax-h3-omni";

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
            default: getDslMiddleSize(MINIMAX_H3_SIZES, "16:9"),
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
            default: getDslMiddleSize(MINIMAX_H3_SIZES, "16:9"),
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
            default: getDslMiddleSize(MINIMAX_H3_SIZES, "16:9"),
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
 * MiniMax H3 首尾帧插值视频 (INT8 6步 Pika 质感版)
 * 底模同 INT8 旋转量化权重，蒸馏 LoRA 换为 Pika Flex（6 步，由 `step` 节点提供）
 */
export const videoMinimaxH3FrameInt8PikaProfile: WorkflowModelProfile = {
    id: "frame-video-minimax-h3-int8-6step-pika",
    name: "MiniMax H3 首尾帧 (INT8 6步 Pika)",
    capability: "video",
    protocol: "comfyui",
    category: "frameVideo",
    steps: 6,
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
            default: getDslMiddleSize(MINIMAX_H3_SIZES, "16:9"),
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
    description: "MiniMax H3 首尾帧插值视频 (INT8 旋转量化底模 + Pika Flex 6步蒸馏 LoRA)，支持 0~2 张参考图，换更充分的细节与平滑过渡。",
    supportedTools: {
        faceRefine: true,
        depthVideo: true,
    },
};

/**
 * MiniMax H3 首尾帧插值视频 (INT8 6步 SelfLift 渐进超分版)
 * Singularity INT8 底模 + SelfLift 渐进超分采样器 + Pika Flex / H3-Licon 双 LoRA + EasyCache，
 * 6 步采样（由 step 节点控制），支持 0~2 张参考图，低显存输出高清关键帧过渡
 */
export const videoMinimaxH3FrameInt8SelfLiftProfile: WorkflowModelProfile = {
    id: "frame-video-minimax-h3-int8-6step-selflift",
    name: "MiniMax H3 首尾帧 (INT8 6步 SelfLift)",
    capability: "video",
    protocol: "comfyui",
    category: "frameVideo",
    steps: 6,
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
            default: getDslMiddleSize(MINIMAX_H3_SIZES, "16:9"),
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
    description: "MiniMax H3 首尾帧插值视频 (INT8 Singularity 底模 + SelfLift 渐进超分采样 + 双 LoRA + EasyCache)，支持 0~2 张参考图，兼顾速度与画质。",
    supportedTools: {
        faceRefine: true,
        depthVideo: true,
    },
};

/**
 * 历史别名兼容
 */
export const videoMinimaxH3FrameProfile = videoMinimaxH3FrameFp8PdmdProfile;
