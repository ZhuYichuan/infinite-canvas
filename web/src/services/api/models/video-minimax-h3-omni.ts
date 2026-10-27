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

export const videoMinimaxH3OmniProfile: WorkflowModelProfile = {
    id: "video_minimax_h3_omni",
    name: "MiniMax H3 全能参考视频",
    capability: "video",
    protocol: "comfyui",
    category: "omniVideo",
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 2000,
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
    slotMapping: {
        prompt: "prompt",
        seed: "seed",
        width: "width",
        height: "height",
        duration: "duration",
        images: "ref_image_01..09",
        videos: "ref_video_01..03",
        audios: "ref_audio_01..03",
        output: "output_video",
    },
    description: "基于 MiniMax H3 扩散模型的全模态多参考长视频生成，支持最多 9 图、3 视频、3 音频协同输入。",
};
