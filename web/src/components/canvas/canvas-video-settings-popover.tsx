import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { Button } from "antd";

import {
    VideoSettingsPanel,
    videoSecondsLabel,
    videoSizeLabel,
} from "@/components/video-settings-panel";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { AiConfig } from "@/stores/use-config-store";
import {
    getModelProfile,
    videoMinimaxH3OmniProfile,
} from "@/services/api/models";

export type CanvasVideoSettingsPopoverProps = {
    modelId?: string;
    size?: string;
    duration?: number | string;
    videoMode?: "omni" | "frame";
    onParamChange?: (patch: {
        modelId?: string;
        videoMode?: "omni" | "frame";
        size?: string;
        seconds?: string;
        duration?: number;
    }) => void;
    config?: AiConfig;
    onConfigChange?: (key: keyof AiConfig, value: string) => void;
    onOpenChange?: (open: boolean) => void;
    buttonClassName?: string;
    placement?: "topLeft" | "top" | "topRight" | "bottomLeft" | "bottom" | "bottomRight";
};

export function CanvasVideoSettingsPopover({
    modelId,
    size,
    duration,
    videoMode,
    onParamChange,
    config,
    onConfigChange,
    onOpenChange,
    buttonClassName,
    placement = "topLeft",
}: CanvasVideoSettingsPopoverProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const buttonRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

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

    const effectiveModelId = modelId || (videoMode === "frame" ? "video_minimax_h3_frame" : videoMode === "omni" ? "video_minimax_h3_omni" : undefined) || config?.videoModel || config?.model;
    const profile = getModelProfile(effectiveModelId) || videoMinimaxH3OmniProfile;
    const currentMode = videoMode || (profile.category === "frameVideo" ? "frame" : (config?.videoMode === "frame" ? "frame" : "omni"));
    const currentSize = size || config?.size;
    const currentDuration = duration !== undefined ? duration : config?.videoSeconds;

    const panel = open && buttonRect ? (
        <VideoSettingsPortal
            buttonRect={buttonRect}
            panelRef={panelRef}
            placement={placement}
            theme={theme}
            modelId={effectiveModelId}
            size={currentSize}
            duration={currentDuration}
            videoMode={currentMode}
            onParamChange={onParamChange}
            config={config}
            onConfigChange={onConfigChange}
        />
    ) : null;

    return (
        <>
            <span ref={buttonRef} className="inline-flex min-w-0" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                <Button size="small" type="text" className={buttonClassName || "!h-8 !max-w-[230px] !justify-start !rounded-full !px-2.5"} style={{ background: theme.node.fill, color: theme.node.text }} icon={<Settings2 className="size-3.5" />} onClick={() => updateOpen(!open)}>
                    <span className="truncate">
                        {currentMode === "frame" ? "首尾帧" : "全能参考"} · {videoSizeLabel(currentSize, profile)} · {videoSecondsLabel(currentDuration, profile)}
                    </span>
                </Button>
            </span>
            {panel}
        </>
    );
}

function VideoSettingsPortal({
    buttonRect,
    panelRef,
    placement,
    theme,
    modelId,
    size,
    duration,
    videoMode,
    onParamChange,
    config,
    onConfigChange,
}: {
    buttonRect: DOMRect;
    panelRef: RefObject<HTMLDivElement | null>;
    placement: CanvasVideoSettingsPopoverProps["placement"];
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    modelId?: string;
    size?: string;
    duration?: number | string;
    videoMode?: "omni" | "frame";
    onParamChange?: CanvasVideoSettingsPopoverProps["onParamChange"];
    config?: AiConfig;
    onConfigChange?: (key: keyof AiConfig, value: string) => void;
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
            <VideoSettingsPanel
                modelId={modelId}
                size={size}
                duration={duration}
                videoMode={videoMode}
                onParamChange={onParamChange}
                config={config}
                onConfigChange={onConfigChange as any}
                theme={theme}
                className="space-y-4"
            />
        </div>,
        document.body,
    );
}
