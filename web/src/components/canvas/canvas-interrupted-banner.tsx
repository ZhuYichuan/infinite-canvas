import { AlertCircle, RotateCw, X } from "lucide-react";
import { Button, Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

interface CanvasInterruptedBannerProps {
    count: number;
    resuming?: boolean;
    failed?: boolean;
    onResumeAll: () => void;
    onDismiss: () => void;
}

export function CanvasInterruptedBanner({
    count,
    resuming = false,
    failed = false,
    onResumeAll,
    onDismiss,
}: CanvasInterruptedBannerProps) {
    const { t } = useTranslation();
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];

    if (count <= 0) return null;

    return (
        <div
            className="pointer-events-auto absolute left-1/2 top-16 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border px-3.5 py-1.5 shadow-lg backdrop-blur transition-all"
            style={{
                background: theme.toolbar.panel,
                borderColor: failed ? "rgba(239, 68, 68, 0.4)" : theme.toolbar.border,
                color: theme.node.text,
            }}
        >
            <div className="flex items-center gap-2 text-xs font-medium">
                {resuming ? (
                    <RotateCw className="size-4 shrink-0 animate-spin text-blue-500" />
                ) : (
                    <AlertCircle className={`size-4 shrink-0 ${failed ? "text-rose-500" : "text-amber-500"}`} />
                )}
                <span>
                    {resuming
                        ? t("canvas.interruptedBanner.resuming", { count })
                        : failed
                        ? t("canvas.interruptedBanner.failedTitle", { count })
                        : t("canvas.interruptedBanner.title", { count })}
                </span>
            </div>

            <span className="h-3.5 w-px opacity-30" style={{ background: theme.toolbar.border }} />

            <div className="flex items-center gap-1.5">
                {!resuming ? (
                    <Button
                        type="primary"
                        size="small"
                        danger={failed}
                        icon={<RotateCw className="size-3.5" />}
                        onClick={onResumeAll}
                        className="!h-6 !rounded-full !px-2.5 !text-xs !font-medium"
                    >
                        {failed ? t("canvas.interruptedBanner.manualRetry") : t("canvas.interruptedBanner.resumeAll")}
                    </Button>
                ) : null}

                <Tooltip title={t("canvas.interruptedBanner.ignore")}>
                    <button
                        type="button"
                        onClick={onDismiss}
                        aria-label={t("canvas.interruptedBanner.ignore")}
                        className="grid size-6 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: theme.node.text }}
                    >
                        <X className="size-3.5 opacity-60 hover:opacity-100" />
                    </button>
                </Tooltip>
            </div>
        </div>
    );
}
