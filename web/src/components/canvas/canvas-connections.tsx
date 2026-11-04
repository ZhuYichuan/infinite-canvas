import { useMemo } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasConnection, CanvasNodeData, ConnectionHandle, Position } from "@/types/canvas";
import { CANVAS_HANDLE_OFFSET } from "@/lib/canvas/canvas-node-geometry";

function getCubicBezierPoint(
    p0: Position,
    p1: Position,
    p2: Position,
    p3: Position,
    t: number,
): Position {
    const oneMinusT = 1 - t;
    const oneMinusT2 = oneMinusT * oneMinusT;
    const oneMinusT3 = oneMinusT2 * oneMinusT;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
        x: oneMinusT3 * p0.x + 3 * oneMinusT2 * t * p1.x + 3 * oneMinusT * t2 * p2.x + t3 * p3.x,
        y: oneMinusT3 * p0.y + 3 * oneMinusT2 * t * p1.y + 3 * oneMinusT * t2 * p2.y + t3 * p3.y,
    };
}

function findClosestPointOnCubicBezier(
    p0: Position,
    p1: Position,
    p2: Position,
    p3: Position,
    point: Position,
    samples = 36,
): Position {
    let minD2 = Infinity;
    let bestT = 0.5;

    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const pt = getCubicBezierPoint(p0, p1, p2, p3, t);
        const d2 = (pt.x - point.x) ** 2 + (pt.y - point.y) ** 2;
        if (d2 < minD2) {
            minD2 = d2;
            bestT = t;
        }
    }

    let left = Math.max(0, bestT - 1 / samples);
    let right = Math.min(1, bestT + 1 / samples);
    for (let iter = 0; iter < 5; iter++) {
        const mid1 = left + (right - left) / 3;
        const mid2 = right - (right - left) / 3;
        const pt1 = getCubicBezierPoint(p0, p1, p2, p3, mid1);
        const pt2 = getCubicBezierPoint(p0, p1, p2, p3, mid2);
        const d1 = (pt1.x - point.x) ** 2 + (pt1.y - point.y) ** 2;
        const d2 = (pt2.x - point.x) ** 2 + (pt2.y - point.y) ** 2;
        if (d1 < d2) {
            right = mid2;
        } else {
            left = mid1;
        }
    }

    return getCubicBezierPoint(p0, p1, p2, p3, (left + right) / 2);
}

export function ConnectionPath({
    connection,
    from,
    to,
    active,
    isSelected = false,
    invalid = false,
    mouseWorld,
    onSelect,
    onDisconnect,
    onContextMenu,
}: {
    connection: CanvasConnection;
    from: CanvasNodeData;
    to: CanvasNodeData;
    active: boolean;
    isSelected?: boolean;
    invalid?: boolean;
    mouseWorld?: Position;
    onSelect: (event?: ReactMouseEvent) => void;
    onDisconnect?: () => void;
    onContextMenu?: (event: ReactMouseEvent<SVGPathElement>) => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const startX = from.position.x + from.width + CANVAS_HANDLE_OFFSET;
    const startY = from.position.y + from.height / 2;
    const endX = to.position.x - CANVAS_HANDLE_OFFSET;
    const endY = to.position.y + to.height / 2;
    const dx = Math.abs(endX - startX);
    const curvature = Math.max(dx * 0.5, 50);

    const p0 = useMemo(() => ({ x: startX, y: startY }), [startX, startY]);
    const p1 = useMemo(() => ({ x: startX + curvature, y: startY }), [startX, curvature, startY]);
    const p2 = useMemo(() => ({ x: endX - curvature, y: endY }), [endX, curvature, endY]);
    const p3 = useMemo(() => ({ x: endX, y: endY }), [endX, endY]);

    const pathD = `M ${startX} ${startY} C ${startX + curvature} ${startY}, ${endX - curvature} ${endY}, ${endX} ${endY}`;

    const isGlowActive = isSelected;
    const strokeColor = invalid ? "#ef4444" : isGlowActive ? "#00d2ff" : active ? theme.node.activeStroke : theme.node.muted;
    const strokeWidth = invalid ? 2.5 : isGlowActive ? 3 : active ? 3 : 2;

    const scissorsPos = useMemo(() => {
        if (!isGlowActive) return null;
        if (!mouseWorld || (mouseWorld.x === 0 && mouseWorld.y === 0)) {
            return getCubicBezierPoint(p0, p1, p2, p3, 0.5);
        }
        return findClosestPointOnCubicBezier(p0, p1, p2, p3, mouseWorld);
    }, [isGlowActive, mouseWorld, p0, p1, p2, p3]);

    return (
        <g>
            <path
                data-connection-id={connection.id}
                d={pathD}
                stroke="transparent"
                strokeWidth="20"
                fill="none"
                style={{ cursor: "pointer", pointerEvents: "stroke" }}
                onClick={(event) => {
                    event.stopPropagation();
                    if (isGlowActive) {
                        onDisconnect?.();
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
            <path
                d={pathD}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={invalid ? "6,4" : undefined}
                strokeOpacity={invalid ? 1 : isGlowActive ? 1 : active ? 1 : 0.82}
                fill="none"
                style={{
                    filter: invalid
                        ? "drop-shadow(0 0 6px rgba(239, 68, 68, 0.6))"
                        : isGlowActive
                          ? "drop-shadow(0 0 6px #00d2ff) drop-shadow(0 0 12px rgba(0, 210, 255, 0.65))"
                          : active
                            ? `drop-shadow(0 0 8px ${theme.node.activeStroke}66)`
                            : undefined,
                    pointerEvents: "none",
                }}
            />

            {isGlowActive && scissorsPos ? (
                <g
                    className="cursor-pointer group"
                    transform={`translate(${scissorsPos.x}, ${scissorsPos.y})`}
                    onClick={(event) => {
                        event.stopPropagation();
                        onDisconnect?.();
                    }}
                    style={{ pointerEvents: "all" }}
                    title="点击断开连接"
                >
                    <circle r="18" fill="transparent" />
                    <circle
                        r="12"
                        fill="rgba(15, 23, 42, 0.85)"
                        stroke="#00d2ff"
                        strokeWidth="1.2"
                        className="transition-transform duration-100 group-hover:scale-110"
                        style={{ filter: "drop-shadow(0 0 6px rgba(0, 210, 255, 0.7))" }}
                    />
                    <g
                        transform="translate(-7, -7) scale(0.583)"
                        className="pointer-events-none transition-transform duration-100 group-hover:scale-110"
                    >
                        <circle cx="6" cy="6" r="3" fill="none" stroke="#ffffff" strokeWidth="2.5" />
                        <path d="M8.12 8.12 12 12" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M20 4 8.12 15.88" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="6" cy="18" r="3" fill="none" stroke="#ffffff" strokeWidth="2.5" />
                        <path d="M14.8 14.8 20 20" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                    </g>
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

                return <path key={activeNode.id} d={pathD} stroke={theme.node.activeStroke} strokeWidth="2" fill="none" strokeDasharray="5,5" />;
            })}
        </g>
    );
}
