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
    /**
     * 是否硬性阻断模型切换选择（例如超额连线、违规媒体类型、主机离线）
     * 设为 false 表示属于输入前置条件未就绪（如缺图），允许选择但在生成时阻断
     */
    blocking?: boolean;
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
    /** 是否满足所有执行约束（用于节点「生成」按钮的可用性） */
    isAvailable: boolean;
    /** 是否允许在选择器中切换选中（用于下拉菜单的 disabled 状态） */
    isSelectable: boolean;
    /** 全量未满足原因清单（用于生成按钮阻断 Tooltip） */
    reasons: string[];
    /** 硬性阻断切换原因清单（用于选择器 disabled 置灰 Tooltip） */
    blockingReasons: string[];
    /** 前置输入待满足提示清单（用于选择器黄色提醒 Tooltip） */
    warningReasons: string[];
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
            const reason = ctx.targetModel.capability === "text"
                ? `纯文本模型不支持连入参考图片，当前已连接 ${ctx.connectedImages} 张`
                : `该模型不支持参考图，当前已连接 ${ctx.connectedImages} 张图片`;
            return {
                passed: false,
                blocking: true,
                reason,
            };
        }

        if (refs.maskSupported && refs.minImages !== undefined && refs.maxImages !== undefined && refs.minImages === refs.maxImages && ctx.connectedImages !== refs.minImages) {
            const isExcess = ctx.connectedImages > refs.maxImages;
            return {
                passed: false,
                blocking: isExcess,
                reason: `该模型需要两张参考图（一张原图 + 一张蒙版），当前已连接 ${ctx.connectedImages} 张`,
            };
        }

        if (refs.maxImages !== undefined && ctx.connectedImages > refs.maxImages) {
            return {
                passed: false,
                blocking: true,
                reason: `已连接 ${ctx.connectedImages} 张参考图，该模型最多支持 ${refs.maxImages} 张`,
            };
        }

        if (refs.minImages !== undefined && ctx.connectedImages < refs.minImages) {
            const reason = ctx.targetModel.capability === "text"
                ? `该模型为视觉反推模型，需要连入至少 ${refs.minImages} 张参考图片`
                : `该模型至少需要 ${refs.minImages} 张参考图，当前仅连接 ${ctx.connectedImages} 张`;
            return {
                passed: false,
                blocking: false,
                reason,
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
    const blockingReasons: string[] = [];
    const warningReasons: string[] = [];

    for (const rule of rules) {
        const result = rule.check(ctx);
        if (!result.passed && result.reason) {
            reasons.push(result.reason);
            if (result.blocking !== false) {
                blockingReasons.push(result.reason);
            } else {
                warningReasons.push(result.reason);
            }
        }
    }
    return {
        isAvailable: reasons.length === 0,
        isSelectable: blockingReasons.length === 0,
        reasons,
        blockingReasons,
        warningReasons,
    };
}
