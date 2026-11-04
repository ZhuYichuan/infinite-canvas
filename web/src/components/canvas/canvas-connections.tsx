import { useMemo, useState } from "react";
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

    const handleCut = (event: ReactMouseEvent | ReactPointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        onDisconnect?.();
    };

    return (
        <g data-connection-id={connection.id}>
            {/* Expanded hover & click detection hit area */}
            <path
                data-connection-id={connection.id}
                d={pathD}
                stroke="transparent"
                strokeWidth="24"
                fill="none"
                style={{ cursor: "pointer", pointerEvents: "stroke" }}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                onPointerDown={(event) => {
                    if (scissorsPos) {
                        handleCut(event);
                    }
                }}
                onClick={(event) => {
                    event.stopPropagation();
                    if (scissorsPos) {
                        handleCut(event);
                    } else {
                        onSelect(event);
                    }
                }}
                onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onContextMenu?.(event);
                }}
            />
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
                    className="cursor-pointer group"
                    transform={`translate(${scissorsPos.x}, ${scissorsPos.y}) scale(${1 / safeScale})`}
                    onPointerDown={handleCut}
                    onClick={handleCut}
                    style={{ pointerEvents: "all" }}
                    title="点击断开连接"
                >
                    <circle
                        data-connection-id={connection.id}
                        data-connection-scissors="true"
                        r="18"
                        fill="transparent"
                    />
                    <circle
                        data-connection-id={connection.id}
                        data-connection-scissors="true"
                        r="12"
                        fill={theme.node.panel}
                        stroke="#0ea5e9"
                        strokeWidth="1.2"
                        className="transition-transform duration-100 group-hover:scale-110 shadow-sm"
                        style={{ filter: "drop-shadow(0 0 6px rgba(14, 165, 233, 0.7))" }}
                    />
                    <Scissors
                        x={-7}
                        y={-7}
                        size={14}
                        strokeWidth={2.5}
                        className="pointer-events-none text-white transition-transform duration-100 group-hover:scale-110"
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
