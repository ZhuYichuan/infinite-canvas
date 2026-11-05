import { useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { Scissors } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasConnection, CanvasNodeData, ConnectionHandle, Position, ViewportTransform } from "@/types/canvas";
import {
    CANVAS_HANDLE_OFFSET,
    findClosestPointOnCubicBezier,
    type CubicBezierCurve,
} from "@/lib/canvas/canvas-node-geometry";

export function ConnectionPath({
    connection,
    from,
    to,
    viewport,
    active,
    isSelected = false,
    invalid = false,
    onSelect,
    onDisconnect,
    onContextMenu,
}: {
    connection: CanvasConnection;
    from: CanvasNodeData;
    to: CanvasNodeData;
    viewport?: ViewportTransform;
    active: boolean;
    isSelected?: boolean;
    invalid?: boolean;
    onSelect: (event?: ReactMouseEvent) => void;
    onDisconnect?: () => void;
    onContextMenu?: (event: ReactMouseEvent<SVGPathElement>) => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [hoverPoint, setHoverPoint] = useState<Position | null>(null);
    const cutFiredRef = useRef(false);

    const startX = from.position.x + from.width + CANVAS_HANDLE_OFFSET;
    const startY = from.position.y + from.height / 2;
    const endX = to.position.x - CANVAS_HANDLE_OFFSET;
    const endY = to.position.y + to.height / 2;
    const dx = Math.abs(endX - startX);
    const curvature = Math.max(dx * 0.5, 50);

    const curve = useMemo<CubicBezierCurve>(
        () => [
            { x: startX, y: startY },
            { x: startX + curvature, y: startY },
            { x: endX - curvature, y: endY },
            { x: endX, y: endY },
        ],
        [startX, startY, curvature, endX, endY],
    );

    const pathD = `M ${startX} ${startY} C ${startX + curvature} ${startY}, ${endX - curvature} ${endY}, ${endX} ${endY}`;

    const safeScale = viewport?.k && viewport.k > 0 ? viewport.k : 1;
    const isHovered = Boolean(hoverPoint);
    const isGlowActive = isSelected || isHovered;
    const highlightBlue = "#0ea5e9";
    const strokeColor = invalid
        ? "#ef4444"
        : isGlowActive || active
          ? highlightBlue
          : theme.mode === "dark"
            ? "#3f3f46"
            : theme.node.muted;
    const strokeWidth = invalid ? 2.5 : isGlowActive ? 2.5 : active ? 2.2 : 1.8;

    const handlePointerMove = (event: ReactPointerEvent<SVGElement>) => {
        const svg = event.currentTarget.ownerSVGElement;
        if (svg && svg.getScreenCTM) {
            const ctm = svg.getScreenCTM();
            if (ctm) {
                const pt = svg.createSVGPoint();
                pt.x = event.clientX;
                pt.y = event.clientY;
                const worldPt = pt.matrixTransform(ctm.inverse());
                setHoverPoint({ x: worldPt.x, y: worldPt.y });
                return;
            }
        }
        if (!viewport) return;
        const worldX = (event.clientX - viewport.x) / safeScale;
        const worldY = (event.clientY - viewport.y) / safeScale;
        setHoverPoint({ x: worldX, y: worldY });
    };

    const handlePointerLeave = () => {
        setHoverPoint(null);
    };

    const scissorsPos = useMemo(() => {
        if (!hoverPoint) return null;
        return findClosestPointOnCubicBezier(curve, hoverPoint);
    }, [hoverPoint, curve]);

    const handleCut = (event: ReactMouseEvent) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        if (cutFiredRef.current) return;
        cutFiredRef.current = true;
        onDisconnect?.();
        setTimeout(() => {
            cutFiredRef.current = false;
        }, 300);
    };

    const handleClick = (event: ReactMouseEvent<SVGPathElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        // 双击兜底：快速双击时 event.detail === 2 直接剪断
        if (event.detail === 2) {
            handleCut(event);
            return;
        }
        if (event.detail === 1) {
            onSelect?.(event);
        }
    };

    const handleDoubleClick = (event: ReactMouseEvent<SVGPathElement>) => {
        handleCut(event);
    };

    return (
        <g data-connection-id={connection.id}>
            {/* Expanded hover & click detection hit area */}
            <path
                data-connection-id={connection.id}
                data-connection-scissors="true"
                d={pathD}
                stroke="transparent"
                strokeWidth={Math.max(32, 32 / safeScale)}
                fill="none"
                style={{ cursor: "pointer", pointerEvents: "stroke" }}
                onPointerEnter={handlePointerMove}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                onPointerDown={(event) => {
                    if (event.button === 0) {
                        event.stopPropagation();
                    }
                }}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onContextMenu?.(event);
                }}
            >
                <title>双击断开连线</title>
            </path>
            {/* Visual rendered path */}
            <path
                d={pathD}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={invalid ? "6,4" : undefined}
                strokeOpacity={invalid ? 1 : isGlowActive ? 1 : active ? 0.95 : 0.45}
                fill="none"
                style={{
                    filter: invalid
                        ? "drop-shadow(0 0 6px rgba(239, 68, 68, 0.6))"
                        : isGlowActive
                          ? "drop-shadow(0 0 4px rgba(14, 165, 233, 0.85)) drop-shadow(0 0 8px rgba(14, 165, 233, 0.45))"
                          : active
                            ? "drop-shadow(0 0 4px rgba(14, 165, 233, 0.5))"
                            : undefined,
                    pointerEvents: "none",
                }}
            />

            {/* Scissors appears only on hover, with fixed scale regardless of canvas zoom */}
            {scissorsPos ? (
                <g
                    data-connection-id={connection.id}
                    data-connection-scissors="true"
                    transform={`translate(${scissorsPos.x}, ${scissorsPos.y}) scale(${1 / safeScale})`}
                    style={{ pointerEvents: "none" }}
                >
                    <Scissors
                        x={-9}
                        y={-9}
                        size={18}
                        strokeWidth={2.2}
                        className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] filter"
                    />
                </g>
            ) : null}
        </g>
    );
}

export function ActiveConnectionPath({
    node,
    nodes,
    handle,
    mouseWorld,
    target,
}: {
    node?: CanvasNodeData;
    nodes?: CanvasNodeData[];
    handle: ConnectionHandle;
    mouseWorld: Position;
    target?: CanvasNodeData;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const activeNodes = (nodes && nodes.length > 0 ? nodes : node ? [node] : []).filter(Boolean);
    if (activeNodes.length === 0) return null;

    return (
        <g>
            {activeNodes.map((activeNode) => {
                const startX = handle.handleType === "source" ? activeNode.position.x + activeNode.width + CANVAS_HANDLE_OFFSET : mouseWorld.x;
                const startY = handle.handleType === "source" ? activeNode.position.y + activeNode.height / 2 : mouseWorld.y;
                const endX = handle.handleType === "source" ? mouseWorld.x : activeNode.position.x - CANVAS_HANDLE_OFFSET;
                const endY = handle.handleType === "source" ? mouseWorld.y : activeNode.position.y + activeNode.height / 2;
                const snappedStartX = handle.handleType === "target" && target ? target.position.x + target.width + CANVAS_HANDLE_OFFSET : startX;
                const snappedStartY = handle.handleType === "target" && target ? target.position.y + target.height / 2 : startY;
                const snappedEndX = handle.handleType === "source" && target ? target.position.x - CANVAS_HANDLE_OFFSET : endX;
                const snappedEndY = handle.handleType === "source" && target ? target.position.y + target.height / 2 : endY;
                const distance = Math.abs(snappedEndX - snappedStartX);
                const pathD = `M ${snappedStartX} ${snappedStartY} C ${snappedStartX + distance * 0.5} ${snappedStartY}, ${snappedEndX - distance * 0.5} ${snappedEndY}, ${snappedEndX} ${snappedEndY}`;

                return (
                    <path
                        key={activeNode.id}
                        d={pathD}
                        stroke="#0ea5e9"
                        strokeWidth="2.2"
                        fill="none"
                        strokeDasharray="5,5"
                        style={{
                            filter: "drop-shadow(0 0 6px rgba(14, 165, 233, 0.6))",
                            pointerEvents: "none",
                        }}
                    />
                );
            })}
        </g>
    );
}
