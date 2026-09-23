import { useTranslation } from "react-i18next";

import type { ComfyuiWorkflow, ComfyWorkflowItem } from "@/stores/use-config-store";

const BUILTIN_WORKFLOW_IDENTIFIERS = new Set([
    "t2i_z_image_turbo_api.json",
    "Z-Image-Turbo 文生图",
    "i2i_flux2_dev_api.json",
    "Flux2.Dev 图生图",
    "inpaint_qwen_image_api.json",
    "Qwen-Image 局部编辑",
    "text_qwen3_5_api.json",
    "Qwen-3.5 文本生成/反推",
    "video_minimax_h3_omni_fp8_20step_api.json",
    "MiniMax H3 全能参考 (FP8 20步)",
    "video_minimax_h3_omni_bf16_8step_turbo_api.json",
    "MiniMax H3 全能参考 (BF16 8步极速)",
    "video_minimax_h3_frame_fp8_20step_api.json",
    "MiniMax H3 首尾帧 (FP8 20步)",
    "video_minimax_h3_frame_bf16_8step_turbo_api.json",
    "MiniMax H3 首尾帧 (BF16 8步极速)",
]);

/**
 * Displays attached ComfyUI workflow information (built-in or custom).
 */
export function ComfyuiWorkflowEditor({
    value,
    defaultWorkflow,
    isBuiltin,
}: {
    value?: ComfyuiWorkflow | ComfyWorkflowItem;
    defaultWorkflow?: ComfyuiWorkflow | ComfyWorkflowItem;
    isBuiltin?: boolean;
    onChange?: (value?: ComfyuiWorkflow) => void;
}) {
    const { t } = useTranslation();

    const isCustom = (() => {
        if (typeof isBuiltin === "boolean") {
            return !isBuiltin;
        }
        if (value && "isBuiltin" in value && typeof value.isBuiltin === "boolean") {
            return !value.isBuiltin;
        }
        if (!value || value === defaultWorkflow) {
            return false;
        }
        if (value.name && BUILTIN_WORKFLOW_IDENTIFIERS.has(value.name)) {
            return false;
        }
        if (defaultWorkflow && value.name === defaultWorkflow.name) {
            return false;
        }
        return true;
    })();
    const activeWorkflow = value || defaultWorkflow;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 truncate text-sm text-stone-500" title={activeWorkflow?.name}>
                {activeWorkflow ? (
                    <span className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${isCustom ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" : "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"}`}>
                            {isCustom ? t("comfyui.customWorkflow") : t("comfyui.defaultBuiltin")}
                        </span>
                        <span className="truncate">{activeWorkflow.name} · {formatWorkflowSize(activeWorkflow.json)}</span>
                    </span>
                ) : (
                    t("comfyui.noWorkflowAttached")
                )}
            </div>
        </div>
    );
}

function formatWorkflowSize(json: Record<string, unknown>) {
    const bytes = JSON.stringify(json).length;
    return bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`;
}
