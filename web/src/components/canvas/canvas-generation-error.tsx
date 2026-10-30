import { AlertCircle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { localizeErrorDetails } from "@/lib/canvas/canvas-generation-helpers";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

export function CanvasGenerationError({ node, errorDetails, onRetry }: { node?: CanvasNodeData; errorDetails?: string; onRetry?: (node: CanvasNodeData) => void }) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const slots = (node?.type === CanvasNodeType.Image ? node.metadata?.images : node?.type === CanvasNodeType.Text ? node.metadata?.texts : undefined) || [];
    const failures = slots.filter((slot) => slot.status === "error");
    const details = localizeErrorDetails(failures.find((slot) => slot.errorDetails)?.errorDetails || node?.metadata?.errorDetails || errorDetails) || t("canvas.node.failed");
    const canResume = Boolean(failures[0] ? failures[0].jobId : node?.metadata?.jobId);

    return (
        <section
            role="alert"
            className="flex h-full max-h-full w-full min-h-0 min-w-0 flex-col gap-1.5 overflow-hidden p-2.5 text-left text-xs"
            style={{ color: theme.node.text, background: theme.node.panel }}
            onDoubleClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            <div className="flex shrink-0 items-center gap-1.5 font-medium">
                <AlertCircle className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">{slots.length > 1 && failures.length ? `${failures.length}/${slots.length} 项失败` : t("canvas.node.failed")}</span>
                {node && onRetry ? (
                <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1 rounded px-1 text-xs font-normal transition hover:bg-black/5 dark:hover:bg-white/10"
                    onClick={(event) => {
                        event.stopPropagation();
                        onRetry(node);
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <RefreshCw className="size-3.5" />
                    {canResume ? t("canvas.node.resumePolling") : t("canvas.node.retry")}
                </button>
                ) : null}
            </div>
            <div className="thin-scrollbar min-h-0 max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-5 select-text" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>{details}</div>
        </section>
    );
}
