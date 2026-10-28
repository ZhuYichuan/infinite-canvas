import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { Button, InputNumber } from "antd";
import { useTranslation } from "react-i18next";

import { TextSettingsPanel } from "@/components/text-settings-panel";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { AiConfig, ReasoningEffort } from "@/stores/use-config-store";
import { getModelProfile } from "@/services/api/models";

type CanvasTextSettingsPopoverProps = {
    modelId?: string;
    maxLength?: number;
    thinking?: boolean;
    onParamChange?: (patch: { maxLength?: number; thinking?: boolean }) => void;
    config: AiConfig;
    onConfigChange?: (key: "reasoningEffort", value: ReasoningEffort) => void;
    onOpenChange?: (open: boolean) => void;
    count?: number;
    onCountChange?: (count: number) => void;
    buttonClassName?: string;
    placement?: "topLeft" | "top" | "topRight" | "bottomLeft" | "bottom" | "bottomRight";
};

export function CanvasTextSettingsPopover({
    modelId,
    maxLength,
    thinking,
    onParamChange,
    config,
    onConfigChange,
    onOpenChange,
    count,
    onCountChange,
    buttonClassName,
    placement = "topLeft",
}: CanvasTextSettingsPopoverProps) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const buttonRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

    const profile = getModelProfile(modelId || "text-qwen-35-chat");
    const currentMaxLength = maxLength ?? profile?.capabilityConfig?.textConfig?.maxLength?.default ?? 512;
    const currentThinking = thinking ?? true;

    const updateOpen = (nextOpen: boolean) => {
        setOpen(nextOpen);
        onOpenChange?.(nextOpen);
    };

    useEffect(() => {
        if (!open) return;
        const syncPosition = () => setButtonRect(buttonRef.current?.getBoundingClientRect() || null);
        const closeOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (
                buttonRef.current?.contains(target) ||
                panelRef.current?.contains(target) ||
                (target instanceof Element && Boolean(target.closest(".ant-tooltip, .ant-popover, .ant-dropdown, .ant-select-dropdown, .ant-picker-dropdown")))
            ) return;
            if (document.activeElement instanceof HTMLElement && panelRef.current?.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            updateOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                updateOpen(false);
            }
        };

        syncPosition();
        window.addEventListener("resize", syncPosition);
        window.addEventListener("scroll", syncPosition, true);
        window.addEventListener("pointerdown", closeOnOutsidePointer, true);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("resize", syncPosition);
            window.removeEventListener("scroll", syncPosition, true);
            window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const panel = open && buttonRect ? (
        <TextSettingsPortal
            buttonRect={buttonRect}
            panelRef={panelRef}
            placement={placement}
            theme={theme}
            modelId={modelId}
            maxLength={currentMaxLength}
            thinking={currentThinking}
            onParamChange={onParamChange}
            config={config}
            count={count}
            onConfigChange={onConfigChange}
            onCountChange={onCountChange}
        />
    ) : null;

    return (
        <>
            <span ref={buttonRef} className="inline-flex min-w-0" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                <Button size="small" type="text" className={buttonClassName || "!h-8 !max-w-[170px] !justify-start !rounded-full !px-2.5"} style={{ background: theme.node.fill, color: theme.node.text }} icon={<Settings2 className="size-3.5" />} onClick={() => updateOpen(!open)}>
                    <span className="truncate">{currentMaxLength} 词{currentThinking ? " · 思考" : ""}{onCountChange ? ` · ${t("canvas.controls.generations", { count })}` : ""}</span>
                </Button>
            </span>
            {panel}
        </>
    );
}

function TextSettingsPortal({
    buttonRect,
    panelRef,
    placement,
    theme,
    modelId,
    maxLength,
    thinking,
    onParamChange,
    config,
    count,
    onConfigChange,
    onCountChange,
}: {
    buttonRect: DOMRect;
    panelRef: RefObject<HTMLDivElement | null>;
    placement: CanvasTextSettingsPopoverProps["placement"];
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    modelId?: string;
    maxLength?: number;
    thinking?: boolean;
    onParamChange?: (patch: { maxLength?: number; thinking?: boolean }) => void;
    config: AiConfig;
    count?: number;
    onConfigChange?: CanvasTextSettingsPopoverProps["onConfigChange"];
    onCountChange?: (count: number) => void;
}) {
    const { t } = useTranslation();
    const width = 356;
    const gap = 8;
    const margin = 12;
    const spaceAbove = buttonRect.top - gap - margin;
    const spaceBelow = window.innerHeight - buttonRect.bottom - gap - margin;
    const preferTop = placement?.startsWith("top");
    const isTop = preferTop ? (spaceAbove >= 260 || spaceAbove >= spaceBelow) : (spaceBelow < 260 && spaceAbove > spaceBelow);
    const alignRight = placement?.endsWith("Right");
    const alignCenter = placement === "top" || placement === "bottom";
    const left = alignCenter ? buttonRect.left + buttonRect.width / 2 - width / 2 : alignRight ? buttonRect.right - width : buttonRect.left;
    const style = {
        position: "fixed",
        zIndex: 1200,
        width,
        left: Math.max(margin, Math.min(window.innerWidth - width - margin, left)),
        ...(isTop
            ? { bottom: window.innerHeight - buttonRect.top + gap, maxHeight: Math.max(200, Math.min(window.innerHeight - margin * 2, spaceAbove)) }
            : { top: buttonRect.bottom + gap, maxHeight: Math.max(200, Math.min(window.innerHeight - margin * 2, spaceBelow)) }),
        background: theme.toolbar.panel,
        borderRadius: 18,
        boxShadow: "0 18px 54px rgba(28, 25, 23, 0.16)",
        padding: 18,
        overflowY: "auto",
        color: theme.node.text,
    } as const;

    return createPortal(
        <div
            ref={panelRef}
            data-canvas-no-zoom
            className="canvas-image-settings-popover thin-scrollbar"
            style={style}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            <TextSettingsPanel
                modelId={modelId}
                maxLength={maxLength}
                thinking={thinking}
                onParamChange={onParamChange}
                config={config}
                onConfigChange={onConfigChange}
                theme={theme}
            />
            {onCountChange ? (
                <div className="mt-4 space-y-2.5">
                    <div className="text-sm font-medium" style={{ color: theme.node.muted }}>{t("settingsPanels.text.count")}</div>
                    <InputNumber className="w-full" min={1} max={15} precision={0} value={count} onChange={(value) => onCountChange(value || 1)} />
                </div>
            ) : null}
        </div>,
        document.body,
    );
}
