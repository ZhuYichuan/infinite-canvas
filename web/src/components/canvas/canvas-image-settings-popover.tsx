import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { Button } from "antd";
import { useTranslation } from "react-i18next";

import { ImageSettingsPanel, imageSizeLabel } from "@/components/image-settings-panel";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { getModelProfile, imageQwen21Profile } from "@/services/api/models";
import type { AiConfig } from "@/stores/use-config-store";

type CanvasImageSettingsPopoverProps = {
    modelId?: string;
    config: AiConfig;
    onConfigChange: (key: keyof AiConfig, value: string) => void;
    onMissingConfig?: () => void;
    onOpenChange?: (open: boolean) => void;
    buttonClassName?: string;
    getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
    placement?: "topLeft" | "top" | "topRight" | "bottomLeft" | "bottom" | "bottomRight";
    autoAdjustOverflow?: boolean;
};

export function CanvasImageSettingsPopover({ modelId, config, onConfigChange, onOpenChange, buttonClassName, placement = "topLeft" }: CanvasImageSettingsPopoverProps) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const buttonRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    const count = Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1)));
    const profile = getModelProfile(modelId) || imageQwen21Profile;
    const hasSizeConfig = Boolean(profile.capabilityConfig.size);
    const activeSize = config.size || profile.capabilityConfig.size?.default || "auto";
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
            if (document.activeElement instanceof HTMLElement && panelRef.current?.contains(document.activeElement)) document.activeElement.blur();
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
    }, [onOpenChange, open]);

    const panel = open && buttonRect ? (
        <ImageSettingsPortal
            buttonRect={buttonRect}
            panelRef={panelRef}
            placement={placement}
            theme={theme}
            modelId={modelId}
            config={config}
            onConfigChange={onConfigChange}
        />
    ) : null;

    return (
        <>
            <span ref={buttonRef} className="inline-flex min-w-0" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                <Button size="small" type="text" className={buttonClassName || "!h-8 !max-w-[180px] !justify-start !rounded-full !px-2.5"} style={{ background: theme.node.fill, color: theme.node.text }} icon={<Settings2 className="size-3.5" />} onClick={() => updateOpen(!open)}>
                    <span className="truncate">
                        {hasSizeConfig ? `${imageSizeLabel(activeSize)} · ` : ""}
                        {t("canvas.controls.images", { count })}
                    </span>
                </Button>
            </span>
            {panel}
        </>
    );
}

function ImageSettingsPortal({
    buttonRect,
    panelRef,
    placement,
    theme,
    modelId,
    config,
    onConfigChange,
}: {
    buttonRect: DOMRect;
    panelRef: RefObject<HTMLDivElement | null>;
    placement: CanvasImageSettingsPopoverProps["placement"];
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    modelId?: string;
    config: AiConfig;
    onConfigChange: (key: keyof AiConfig, value: string) => void;
}) {
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
            <ImageSettingsPanel modelId={modelId} config={config} onConfigChange={(key, value) => onConfigChange(key, value)} theme={theme} className="space-y-4" />
        </div>,
        document.body,
    );
}
