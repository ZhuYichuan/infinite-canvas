import type { WorkflowModelProfile } from "./types";

/**
 * 1. Qwen-3.5 纯文本生成与提示词扩写模型
 * 纯文本智能助手，用于生图提示词润色扩写、故事创作与分镜设计。
 * 严禁连入任何媒体资产（minImages: 0, maxImages: 0）。
 */
export const textQwen35ChatProfile: WorkflowModelProfile = {
    id: "text-qwen-35-chat",
    name: "Qwen-3.5 文本生成",
    capability: "text",
    protocol: "comfyui",
    category: "text",
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 4000,
            minImages: 0,
            maxImages: 0,
            maskSupported: false,
            minVideos: 0,
            maxVideos: 0,
            maxAudios: 0,
        },
        textConfig: {
            maxLength: { default: 512, options: [256, 512, 1024] },
            thinkingSupported: true,
        },
    },
    slotMapping: {
        prompt: "prompt",
        seed: "seed",
        textOutput: "output_text",
    },
    description: "纯文本智能助手，用于生图提示词润色扩写、故事创作与分镜设计。",
};

/**
 * 2. Qwen-3.5 视觉反推与提示词提取模型
 * 基于 Qwen-3.5 视觉大模型，深度理解参考图的主体、光影、风格与构图，反推专业生图提示词。
 * 严格需要恰好 1 张参考图作为视觉输入（minImages: 1, maxImages: 1）。
 */
export const textQwen35VlmProfile: WorkflowModelProfile = {
    id: "text-qwen-35-vlm",
    name: "Qwen-3.5 视觉反推",
    capability: "text",
    protocol: "comfyui",
    category: "text",
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 4000,
            minImages: 1,
            maxImages: 1,
            maskSupported: false,
            minVideos: 0,
            maxVideos: 0,
            maxAudios: 0,
        },
        textConfig: {
            maxLength: { default: 512, options: [256, 512, 1024] },
            thinkingSupported: true,
        },
    },
    slotMapping: {
        prompt: "prompt",
        seed: "seed",
        images: "ref_image_01",
        textOutput: "output_text",
    },
    description: "基于 Qwen-3.5 视觉大模型，深度理解参考图的主体、光影、风格与构图，反推专业生图提示词。",
};

export const TEXT_WORKFLOW_MODELS: WorkflowModelProfile[] = [
    textQwen35ChatProfile,
    textQwen35VlmProfile,
];
