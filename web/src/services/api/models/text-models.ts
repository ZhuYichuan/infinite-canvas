import type { WorkflowModelProfile } from "./types";

/**
 * Qwen-3.5 统一多模态大模型
 * 原生支持多模态输入（0~1 张图）：
 * - 无图连入时：充当纯文本生成、润色与提示词扩写助手；
 * - 连入 1 张图时：充当多模态视觉反推与看图提问模型。
 * 注：底层 ComfyUI 工作流参数锁死，不支持深度思考开关与生成长度配置。
 */
export const textQwen35Profile: WorkflowModelProfile = {
    id: "text-qwen-35",
    name: "Qwen-3.5",
    capability: "text",
    protocol: "comfyui",
    category: "text",
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 4000,
            minImages: 0,
            maxImages: 1,
            maskSupported: false,
            minVideos: 0,
            maxVideos: 0,
            maxAudios: 0,
        },
    },
    slotMapping: {
        prompt: "prompt",
        seed: "seed",
        images: "ref_image_01",
        textOutput: "output_text",
    },
    description: "Qwen-3.5 统一多模态大模型，支持纯文本生成/扩写及单图视觉反推与看图提问。",
};

// 兼容别名导出
export const textQwen35ChatProfile = textQwen35Profile;
export const textQwen35VlmProfile = textQwen35Profile;

export const TEXT_WORKFLOW_MODELS: WorkflowModelProfile[] = [
    textQwen35Profile,
];
