import type { CanvasNodeData, ViewportTransform } from "@/types/canvas";

export const CANVAS_NODE_TOOLBAR_HEIGHT = 48;

export function getCanvasNodeToolbarPlacement(node: CanvasNodeData, viewport: ViewportTransform) {
    const nodeTop = viewport.y + node.position.y * viewport.k;
    const nodeBottom = viewport.y + (node.position.y + node.height) * viewport.k;
    const titleGap = Math.max(28 * viewport.k, 24) + 8;
    const placement = nodeTop - titleGap - CANVAS_NODE_TOOLBAR_HEIGHT < 60 ? "bottom" : "top";
    return {
        placement,
        left: viewport.x + (node.position.x + node.width / 2) * viewport.k,
        top: placement === "bottom" ? nodeBottom + 16 : nodeTop - titleGap,
    } as const;
}
