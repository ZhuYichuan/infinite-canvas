import { type ReactNode } from "react";
import type { CanvasNodeData, ViewportTransform } from "@/types/canvas";
import { CANVAS_NODE_TOOLBAR_HEIGHT, getCanvasNodeToolbarPlacement } from "@/lib/canvas/canvas-node-toolbar-placement";

type CanvasNodeInspectorOverlayProps = {
    node: CanvasNodeData | null;
    viewport: ViewportTransform;
    toolbarNode: CanvasNodeData | null;
    canvasSize: { width: number; height: number };
    visible?: boolean;
    renderPanel: (node: CanvasNodeData) => ReactNode;
};

export function CanvasNodeInspectorOverlay({
    node,
    viewport,
    toolbarNode,
    canvasSize,
    visible = true,
    renderPanel,
}: CanvasNodeInspectorOverlayProps) {
    if (!node || !visible) return null;

    const screenWidth = canvasSize.width;
    const screenHeight = canvasSize.height;
    const panelWidth = Math.min(720, screenWidth - 32);

    const nodeTopScreen = viewport.y + node.position.y * viewport.k;
    const nodeBottomScreen = viewport.y + (node.position.y + node.height) * viewport.k;
    const rawLeft = viewport.x + (node.position.x + node.width / 2) * viewport.k;

    // 保证在左右边界内始终完整可见，不被屏幕边缘裁切
    const minLeft = 16 + panelWidth / 2;
    const maxLeft = screenWidth - 16 - panelWidth / 2;
    const left = Math.max(minLeft, Math.min(maxLeft, rawLeft));

    // 同一节点的工具栏位于底部时，输入框始终排在工具栏下面；其它情况沿用原来的翻折规则。
    const titleGap = Math.max(28 * viewport.k, 24) + 8;
    const toolbar = toolbarNode?.id === node.id ? getCanvasNodeToolbarPlacement(toolbarNode, viewport) : null;
    const toolbarBelow = toolbar?.placement === "bottom";
    const requiredBottomSpace = 220;
    const isBottomOverflow = nodeBottomScreen + requiredBottomSpace > screenHeight;
    const canFlipTop = nodeTopScreen - titleGap - CANVAS_NODE_TOOLBAR_HEIGHT > 220;
    const placement: "bottom" | "top" = !toolbarBelow && isBottomOverflow && canFlipTop ? "top" : "bottom";

    const top =
        placement === "top"
            ? nodeTopScreen - titleGap - CANVAS_NODE_TOOLBAR_HEIGHT - 12
            : toolbarBelow ? toolbar.top + CANVAS_NODE_TOOLBAR_HEIGHT + 12 : nodeBottomScreen + 16;
    // 底部画布操作区：距底部 20px + 高度 56px + 面板间隔 16px。
    const maxHeight = Math.max(0, placement === "top" ? top - 60 : screenHeight - 92 - top);

    return (
        <div
            className={`thin-scrollbar pointer-events-auto absolute z-[70] overflow-y-auto overscroll-contain -translate-x-1/2 transition-transform duration-150 ${
                placement === "top" ? "-translate-y-full" : "translate-y-0"
            }`}
            style={{ left, top, width: panelWidth, maxHeight }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            {renderPanel(node)}
        </div>
    );
}
