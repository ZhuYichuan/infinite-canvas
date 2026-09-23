import { useTranslation } from "react-i18next";

import type { ComfyuiWorkflow } from "@/stores/use-config-store";

/**
 * Displays attached ComfyUI workflow information (built-in or custom).
 */
export function ComfyuiWorkflowEditor({
    value,
    defaultWorkflow,
}: {
    value?: ComfyuiWorkflow;
    defaultWorkflow?: ComfyuiWorkflow;
    onChange?: (value?: ComfyuiWorkflow) => void;
}) {
    const { t } = useTranslation();

    const isCustom = Boolean(value && defaultWorkflow && value !== defaultWorkflow && value.name !== defaultWorkflow.name);
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
