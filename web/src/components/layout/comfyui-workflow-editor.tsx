import { App, Button } from "antd";
import { RotateCcw, Trash2, Upload } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";

import type { ComfyuiWorkflow } from "@/stores/use-config-store";

/**
 * JSON in / JSON out editor for a model's ComfyUI workflow: upload a local
 * .json file, view attached workflow (built-in or custom), reset to built-in, or clear.
 */
export function ComfyuiWorkflowEditor({
    value,
    defaultWorkflow,
    onChange,
}: {
    value?: ComfyuiWorkflow;
    defaultWorkflow?: ComfyuiWorkflow;
    onChange: (value?: ComfyuiWorkflow) => void;
}) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        try {
            const parsed: unknown = JSON.parse(await file.text());
            if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Workflow JSON must be an object");
            onChange({ name: file.name, json: parsed as Record<string, unknown>, createdAt: Date.now() });
        } catch {
            message.error(t("comfyui.workflowParseFailed"));
        }
    };

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
            <div className="flex shrink-0 items-center gap-2">
                <Button icon={<Upload className="size-4" />} onClick={() => fileInputRef.current?.click()}>
                    {t("comfyui.uploadWorkflow")}
                </Button>
                {isCustom && defaultWorkflow ? (
                    <Button icon={<RotateCcw className="size-4" />} onClick={() => onChange(defaultWorkflow)}>
                        {t("comfyui.resetToDefault")}
                    </Button>
                ) : value ? (
                    <Button danger icon={<Trash2 className="size-4" />} onClick={() => onChange(undefined)}>
                        {t("comfyui.clearWorkflow")}
                    </Button>
                ) : null}
                <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void handleFile(event)} />
            </div>
        </div>
    );
}

function formatWorkflowSize(json: Record<string, unknown>) {
    const bytes = JSON.stringify(json).length;
    return bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`;
}
