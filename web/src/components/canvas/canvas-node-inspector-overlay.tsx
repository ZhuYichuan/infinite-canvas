import { type ReactNode } from "react";
import type { CanvasNodeData, ViewportTransform } from "@/types/canvas";

type CanvasNodeInspectorOverlayProps = {
    node: CanvasNodeData | null;
    viewport: ViewportTransform;
    visible?: boolean;
    renderPanel: (node: CanvasNodeData) => ReactNode;
};

export function CanvasNodeInspectorOverlay({
    node,
    viewport,
    visible = true,
    renderPanel,
}: CanvasNodeInspectorOverlayProps) {
    if (!node || !visible) return null;

    const screenWidth = typeof window !== "undefined" ? window.innerWidth : 1920;
    const screenHeight = typeof window !== "undefined" ? window.innerHeight : 1080;
    const panelWidth = Math.min(720, screenWidth - 32);

    const nodeTopScreen = viewport.y + node.position.y * viewport.k;
    const nodeBottomScreen = viewport.y + (node.position.y + node.height) * viewport.k;
    const rawLeft = viewport.x + (node.position.x + node.width / 2) * viewport.k;

    // 保证在左右边界内始终完整可见，不被屏幕边缘裁切
    const minLeft = 16 + panelWidth / 2;
    const maxLeft = screenWidth - 16 - panelWidth / 2;
    const left = Math.max(minLeft, Math.min(maxLeft, rawLeft));

    // 边缘避让：默认在节点下方；当底部空间不足 220px 且上方空间充裕时，自动翻折至节点上方
    const titleGap = Math.max(28 * viewport.k, 24) + 8;
    const toolbarHeight = 48;
    const requiredBottomSpace = 220;
    const isBottomOverflow = nodeBottomScreen + requiredBottomSpace > screenHeight;
    const canFlipTop = nodeTopScreen - titleGap - toolbarHeight > 220;
    const placement: "bottom" | "top" = isBottomOverflow && canFlipTop ? "top" : "bottom";

    const top =
        placement === "top"
            ? nodeTopScreen - titleGap - toolbarHeight - 12
            : nodeBottomScreen + 16;

    return (
        <div
            className={`pointer-events-auto absolute z-[70] w-[min(720px,calc(100vw-32px))] -translate-x-1/2 transition-transform duration-150 ${
                placement === "top" ? "-translate-y-full" : "translate-y-0"
            }`}
            style={{ left, top }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            {renderPanel(node)}
        </div>
    );
}
