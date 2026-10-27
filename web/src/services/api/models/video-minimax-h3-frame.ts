import type { WorkflowModelProfile } from "./types";
import { MINIMAX_H3_SIZES } from "./video-minimax-h3-omni";

export const videoMinimaxH3FrameProfile: WorkflowModelProfile = {
    id: "video_minimax_h3_frame",
    name: "MiniMax H3 首尾帧视频",
    capability: "video",
    protocol: "comfyui",
    category: "frameVideo",
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
    },
    slotMapping: {
        prompt: "prompt",
        seed: "seed",
        width: "width",
        height: "height",
        duration: "duration",
        firstFrame: "first_frame",
        lastFrame: "last_frame",
        output: "output_video",
    },
    description: "基于 MiniMax H3 扩散模型的关键帧驱动视频生成，严格接收首帧 (first_frame) 与尾帧 (last_frame) 两张参考图像。",
};
