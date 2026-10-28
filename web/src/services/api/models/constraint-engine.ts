import type { ModelChannel } from "@/types/config";
import type { WorkflowModelProfile } from "./types";
import { isModelSupportedByHost } from "@/stores/use-config-store";

/**
 * 约束检查评估上下文
 */
export interface ConstraintContext {
    targetModel: WorkflowModelProfile;
    connectedImages: number;
    connectedVideos: number;
    connectedAudios: number;
    promptText: string;
    activeChannel?: ModelChannel;
}

/**
 * 单条规则评估结果
 */
export interface ConstraintCheckResult {
    passed: boolean;
    reason?: string;
}

/**
 * 规范模式 (Specification Pattern) 规则接口
 */
export interface ModelConstraintRule {
    readonly id: string;
    check(ctx: ConstraintContext): ConstraintCheckResult;
}

/**
 * 模型可用性诊断汇总结果
 */
export interface ModelAvailability {
    isAvailable: boolean;
    reasons: string[];
}

/**
 * 规则 1：主机支持度规则
 */
export class HostSupportRule implements ModelConstraintRule {
    readonly id = "host-support";

    check(ctx: ConstraintContext): ConstraintCheckResult {
        if (!ctx.activeChannel) return { passed: true };
        const supported = isModelSupportedByHost(ctx.activeChannel, ctx.targetModel.id);
        if (!supported) {
            return {
                passed: false,
                reason: `当前主机「${ctx.activeChannel.name || "ComfyUI"}」未启用该模型支持`,
            };
        }
        return { passed: true };
    }
}

/**
 * 规则 2：参考图片配额规则
 */
export class ImageQuotaRule implements ModelConstraintRule {
    readonly id = "image-quota";

    check(ctx: ConstraintContext): ConstraintCheckResult {
        const refs = ctx.targetModel.capabilityConfig.references;
        if (!refs) return { passed: true };

        if ((refs.maxImages ?? 0) === 0 && ctx.connectedImages > 0) {
            return {
                passed: false,
                reason: `该模型不支持参考图，当前已连接 ${ctx.connectedImages} 张图片`,
            };
        }

        if (refs.maxImages !== undefined && ctx.connectedImages > refs.maxImages) {
            return {
                passed: false,
                reason: `已连接 ${ctx.connectedImages} 张参考图，该模型最多支持 ${refs.maxImages} 张`,
            };
        }

        if (refs.minImages !== undefined && ctx.connectedImages < refs.minImages) {
            return {
                passed: false,
                reason: `该模型至少需要 ${refs.minImages} 张参考图，当前仅连接 ${ctx.connectedImages} 张`,
            };
        }

        return { passed: true };
    }
}

/**
 * 规则 3：参考视频配额与禁连规则
 */
export class VideoQuotaRule implements ModelConstraintRule {
    readonly id = "video-quota";

    check(ctx: ConstraintContext): ConstraintCheckResult {
        const refs = ctx.targetModel.capabilityConfig.references;
        if (!refs) return { passed: true };

        if ((refs.maxVideos ?? 0) === 0 && ctx.connectedVideos > 0) {
            return {
                passed: false,
                reason: `该模型不支持参考视频，当前已连接 ${ctx.connectedVideos} 个视频`,
            };
        }

        if (refs.maxVideos !== undefined && ctx.connectedVideos > refs.maxVideos) {
            return {
                passed: false,
                reason: `已连接 ${ctx.connectedVideos} 个参考视频，该模型最多支持 ${refs.maxVideos} 个`,
            };
        }

        return { passed: true };
    }
}

/**
 * 规则 4：参考音频配额与禁连规则
 */
export class AudioQuotaRule implements ModelConstraintRule {
    readonly id = "audio-quota";

    check(ctx: ConstraintContext): ConstraintCheckResult {
        const refs = ctx.targetModel.capabilityConfig.references;
        if (!refs) return { passed: true };

        if ((refs.maxAudios ?? 0) === 0 && ctx.connectedAudios > 0) {
            return {
                passed: false,
                reason: `该模型不支持参考音频，当前已连接 ${ctx.connectedAudios} 个音频`,
            };
        }

        if (refs.maxAudios !== undefined && ctx.connectedAudios > refs.maxAudios) {
            return {
                passed: false,
                reason: `已连接 ${ctx.connectedAudios} 个参考音频，该模型最多支持 ${refs.maxAudios} 个`,
            };
        }

        return { passed: true };
    }
}

/**
 * 规则 5：提示词最大字数规则
 */
export class PromptLengthRule implements ModelConstraintRule {
    readonly id = "prompt-length";

    check(ctx: ConstraintContext): ConstraintCheckResult {
        const maxChars = ctx.targetModel.capabilityConfig.references?.promptMaxChars || 2000;
        if (ctx.promptText && ctx.promptText.length > maxChars) {
            return {
                passed: false,
                reason: `提示词字数 (${ctx.promptText.length}) 超出该模型上限 (${maxChars} 字符)`,
            };
        }
        return { passed: true };
    }
}

/**
 * 默认视频模型约束规则集
 */
export const DEFAULT_MODEL_CONSTRAINT_RULES: ModelConstraintRule[] = [
    new HostSupportRule(),
    new ImageQuotaRule(),
    new VideoQuotaRule(),
    new AudioQuotaRule(),
    new PromptLengthRule(),
];

/**
 * 组合约束评估器
 * 依据规范模式遍历执行各规则，收集全量未通过的原因清单
 */
export function evaluateModelAvailability(
    ctx: ConstraintContext,
    rules: ModelConstraintRule[] = DEFAULT_MODEL_CONSTRAINT_RULES,
): ModelAvailability {
    const reasons: string[] = [];
    for (const rule of rules) {
        const result = rule.check(ctx);
        if (!result.passed && result.reason) {
            reasons.push(result.reason);
        }
    }
    return {
        isAvailable: reasons.length === 0,
        reasons,
    };
}
