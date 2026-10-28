import React, { useRef } from "react";
import { Plus } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasNodeData, Position } from "@/types/canvas";

interface CanvasMultiSelectionOverlayProps {
    selectedNodes: CanvasNodeData[];
    mouseWorldY: number | null;
    scale: number;
    isConnecting?: boolean;
    onConnectStart: (event: React.MouseEvent | React.PointerEvent, primaryNodeId: string, handleType: "source") => void;
    onClickPlus: (position: Position, primaryNodeId: string, selectedNodeIds: string[]) => void;
}

export function CanvasMultiSelectionOverlay({
    selectedNodes,
    mouseWorldY,
    scale,
    isConnecting = false,
    onConnectStart,
    onClickPlus,
}: CanvasMultiSelectionOverlayProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
    const frozenYRef = useRef<number | null>(null);

    if (selectedNodes.length <= 1) return null;

    const minX = Math.min(...selectedNodes.map((n) => n.position.x));
    const minY = Math.min(...selectedNodes.map((n) => n.position.y));
    const maxX = Math.max(...selectedNodes.map((n) => n.position.x + n.width));
    const maxY = Math.max(...selectedNodes.map((n) => n.position.y + n.height));

    const padding = 6;
    const boxLeft = minX - padding;
    const boxTop = minY - padding;
    const boxWidth = maxX - minX + padding * 2;
    const boxHeight = maxY - minY + padding * 2;

    const defaultCenterY = boxTop + boxHeight / 2;
    const currentDynamicY = mouseWorldY !== null ? Math.max(boxTop + 24, Math.min(boxTop + boxHeight - 24, mouseWorldY)) : defaultCenterY;

    // When actively connecting/dragging, freeze the plus button position so it stays anchored
    const targetY = isConnecting ? (frozenYRef.current ?? defaultCenterY) : currentDynamicY;
    if (!isConnecting) {
        frozenYRef.current = currentDynamicY;
    }

    const plusX = boxLeft + boxWidth;
    const plusY = targetY;

    // The primary node represents the batch root for handle connection
    const primaryNode = selectedNodes[0];

    const handlePointerDown = (event: React.PointerEvent) => {
        event.stopPropagation();
        dragStartPosRef.current = { x: event.clientX, y: event.clientY };
        frozenYRef.current = targetY;
        onConnectStart(event, primaryNode.id, "source");
    };

    const handleMouseDown = (event: React.MouseEvent) => {
        event.stopPropagation();
        dragStartPosRef.current = { x: event.clientX, y: event.clientY };
        frozenYRef.current = targetY;
        onConnectStart(event, primaryNode.id, "source");
    };

    const handleClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (dragStartPosRef.current) {
            const dx = Math.abs(event.clientX - dragStartPosRef.current.x);
            const dy = Math.abs(event.clientY - dragStartPosRef.current.y);
            if (dx > 4 || dy > 4) return;
        }
        onClickPlus(
            { x: plusX + 24, y: plusY - 20 },
            primaryNode.id,
            selectedNodes.map((n) => n.id),
        );
    };

    return (
        <div data-selection-overlay className="pointer-events-none absolute z-30" style={{ left: 0, top: 0 }}>
            {/* Dashed outer bounding box */}
            <div
                className="absolute rounded-2xl border border-dashed transition-all duration-100"
                style={{
                    left: boxLeft,
                    top: boxTop,
                    width: boxWidth,
                    height: boxHeight,
                    borderColor: theme.node.activeStroke,
                    borderWidth: Math.max(1, 1.5 / scale),
                    opacity: 0.75,
                }}
            />

            {/* Sticky floating plus button on right border */}
            <div
                className="pointer-events-auto absolute flex items-center justify-center transition-transform duration-75"
                style={{
                    left: plusX,
                    top: plusY,
                    transform: `translate(-50%, -50%) scale(${1 / (scale > 0 ? scale : 1)})`,
                    transformOrigin: "center center",
                }}
            >
                <button
                    data-connection-handle
                    type="button"
                    className="group/plus relative flex size-8 cursor-crosshair items-center justify-center rounded-full border shadow-xl transition-all duration-150 hover:scale-125 hover:shadow-2xl active:scale-95"
                    style={{
                        background: theme.node.panel,
                        borderColor: theme.node.activeStroke,
                        color: theme.node.text,
                    }}
                    onPointerDown={handlePointerDown}
                    onMouseDown={handleMouseDown}
                    onClick={handleClick}
                    title="点击快捷创建 / 拖拽批量连线"
                    aria-label="批量连接触点"
                >
                    <Plus className="size-4.5 stroke-[2.5] transition-transform duration-150 group-hover/plus:rotate-90" />
                </button>
            </div>
        </div>
    );
}
