import type { MouseEvent as ReactMouseEvent } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasConnection, CanvasNodeData, ConnectionHandle, Position } from "@/types/canvas";

export function ConnectionPath({
    connection,
    from,
    to,
    active,
    invalid = false,
    onSelect,
    onContextMenu,
}: {
    connection: CanvasConnection;
    from: CanvasNodeData;
    to: CanvasNodeData;
    active: boolean;
    invalid?: boolean;
    onSelect: () => void;
    onContextMenu?: (event: ReactMouseEvent<SVGPathElement>) => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const startX = from.position.x + from.width;
    const startY = from.position.y + from.height / 2;
    const endX = to.position.x;
    const endY = to.position.y + to.height / 2;
    const dx = Math.abs(endX - startX);
    const curvature = Math.max(dx * 0.5, 50);
    const pathD = `M ${startX} ${startY} C ${startX + curvature} ${startY}, ${endX - curvature} ${endY}, ${endX} ${endY}`;

    const strokeColor = invalid ? "#ef4444" : active ? theme.node.activeStroke : theme.node.muted;
    const strokeWidth = invalid ? 2.5 : active ? 3 : 2;

    return (
        <g>
            <path
                data-connection-id={connection.id}
                d={pathD}
                stroke="transparent"
                strokeWidth="16"
                fill="none"
                style={{ cursor: "pointer", pointerEvents: "stroke" }}
                onClick={(event) => {
                    event.stopPropagation();
                    onSelect();
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
                strokeOpacity={invalid ? 1 : active ? 1 : 0.82}
                fill="none"
                style={{
                    filter: invalid
                        ? "drop-shadow(0 0 6px rgba(239, 68, 68, 0.6))"
                        : active
                          ? `drop-shadow(0 0 8px ${theme.node.activeStroke}66)`
                          : undefined,
                    pointerEvents: "none",
                }}
            />
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
                const startX = handle.handleType === "source" ? activeNode.position.x + activeNode.width : mouseWorld.x;
                const startY = handle.handleType === "source" ? activeNode.position.y + activeNode.height / 2 : mouseWorld.y;
                const endX = handle.handleType === "source" ? mouseWorld.x : activeNode.position.x;
                const endY = handle.handleType === "source" ? mouseWorld.y : activeNode.position.y + activeNode.height / 2;
                const snappedStartX = handle.handleType === "target" && target ? target.position.x + target.width : startX;
                const snappedStartY = handle.handleType === "target" && target ? target.position.y + target.height / 2 : startY;
                const snappedEndX = handle.handleType === "source" && target ? target.position.x : endX;
                const snappedEndY = handle.handleType === "source" && target ? target.position.y + target.height / 2 : endY;
                const distance = Math.abs(snappedEndX - snappedStartX);
                const pathD = `M ${snappedStartX} ${snappedStartY} C ${snappedStartX + distance * 0.5} ${snappedStartY}, ${snappedEndX - distance * 0.5} ${snappedEndY}, ${snappedEndX} ${snappedEndY}`;

                return <path key={activeNode.id} d={pathD} stroke={theme.node.activeStroke} strokeWidth="2" fill="none" strokeDasharray="5,5" />;
            })}
        </g>
    );
}
