import { App, Button } from "antd";
import { Trash2, Upload } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";

import type { ComfyuiWorkflow } from "@/stores/use-config-store";

/**
 * JSON in / JSON out editor for a model's ComfyUI workflow: upload a local
 * .json file, see what is attached, or clear it. No persistence here — the
 * channel editor's draft owns the state and stores it with the config.
 */
export function ComfyuiWorkflowEditor({ value, onChange }: { value?: ComfyuiWorkflow; onChange: (value?: ComfyuiWorkflow) => void }) {
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
            // The file name doubles as the workflow label, e.g. "t2i.json".
            onChange({ name: file.name, json: parsed as Record<string, unknown>, createdAt: Date.now() });
        } catch {
            message.error(t("comfyui.workflowParseFailed"));
        }
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 truncate text-sm text-stone-500" title={value?.name}>
                {value ? `${value.name} · ${formatWorkflowSize(value.json)}` : t("comfyui.noWorkflowAttached")}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <Button icon={<Upload className="size-4" />} onClick={() => fileInputRef.current?.click()}>
                    {t("comfyui.uploadWorkflow")}
                </Button>
                {value ? (
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
