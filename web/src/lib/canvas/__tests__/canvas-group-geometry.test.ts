import { describe, expect, it } from "vitest";

import {
    calculateGroupBoundsForNodes,
    captureEnclosedNodesIntoGroup,
    fitGroupToEnclosedChildren,
    isNodeEnclosedInGroup,
    syncGroupMembershipAfterTransform,
    ungroupCanvasGroup,
} from "@/lib/canvas/canvas-node-geometry";
import {
    CanvasNodeType,
    type CanvasNodeData,
    type CanvasNodeMetadata,
    type CanvasNodeTypeId,
} from "@/types/canvas";

function makeNode(
    id: string,
    type: CanvasNodeTypeId,
    x: number,
    y: number,
    w = 200,
    h = 200,
    metadata?: CanvasNodeMetadata,
): CanvasNodeData {
    return {
        id,
        type,
        title: id,
        position: { x, y },
        width: w,
        height: h,
        metadata,
    };
}

describe("canvas-group-geometry", () => {
    it("isNodeEnclosedInGroup 正确识别节点中心是否在组矩形内", () => {
        const group = makeNode("grp", CanvasNodeType.Group, 100, 100, 600, 400);
        const insideNode = makeNode("img-1", CanvasNodeType.Image, 150, 150, 100, 100);
        const outsideNode = makeNode("img-2", CanvasNodeType.Image, 800, 800, 100, 100);

        expect(isNodeEnclosedInGroup(insideNode, group)).toBe(true);
        expect(isNodeEnclosedInGroup(outsideNode, group)).toBe(false);
        expect(isNodeEnclosedInGroup(group, group)).toBe(false);
    });

    it("calculateGroupBoundsForNodes 能够根据多个节点计算包围盒并加上 padding", () => {
        const nodeA = makeNode("a", CanvasNodeType.Image, 100, 100, 200, 200);
        const nodeB = makeNode("b", CanvasNodeType.Video, 400, 300, 200, 200);

        const bounds = calculateGroupBoundsForNodes([nodeA, nodeB], 36, 44, 36);
        expect(bounds.x).toBe(100 - 36);
        expect(bounds.y).toBe(100 - 44);
        expect(bounds.width).toBe(600 - 100 + 72);
        expect(bounds.height).toBe(500 - 100 + 80);
    });

    it("captureEnclosedNodesIntoGroup 一键吸附框内节点", () => {
        const group = makeNode("grp", CanvasNodeType.Group, 100, 100, 500, 400);
        const inside1 = makeNode("img-1", CanvasNodeType.Image, 120, 120, 100, 100);
        const inside2 = makeNode("vid-1", CanvasNodeType.Video, 250, 200, 100, 100);
        const outside = makeNode("aud-1", CanvasNodeType.Audio, 800, 100, 100, 100);

        const { nextNodes, capturedCount } = captureEnclosedNodesIntoGroup("grp", [group, inside1, inside2, outside]);
        expect(capturedCount).toBe(2);

        const capturedIds = nextNodes.filter((n) => n.metadata?.groupId === "grp").map((n) => n.id);
        expect(capturedIds).toEqual(["img-1", "vid-1"]);
    });

    it("ungroupCanvasGroup 解散组并清除所有子节点的 groupId", () => {
        const group = makeNode("grp", CanvasNodeType.Group, 100, 100, 500, 400);
        const child = makeNode("img-1", CanvasNodeType.Image, 120, 120, 100, 100, { groupId: "grp" });
        const other = makeNode("img-2", CanvasNodeType.Image, 600, 600, 100, 100);

        const result = ungroupCanvasGroup("grp", [group, child, other]);
        expect(result.find((n) => n.id === "grp")).toBeUndefined();
        expect(result.find((n) => n.id === "img-1")?.metadata?.groupId).toBeUndefined();
        expect(result.find((n) => n.id === "img-2")?.id).toBe("img-2");
    });

    it("syncGroupMembershipAfterTransform 移动或缩放组后自动同步入组和出组", () => {
        const group = makeNode("grp", CanvasNodeType.Group, 500, 500, 400, 400);
        const formerlyInside = makeNode("img-1", CanvasNodeType.Image, 100, 100, 100, 100, { groupId: "grp" });
        const nowInside = makeNode("img-2", CanvasNodeType.Image, 550, 550, 100, 100);

        const result = syncGroupMembershipAfterTransform("grp", [group, formerlyInside, nowInside]);
        expect(result.find((n) => n.id === "img-1")?.metadata?.groupId).toBeUndefined();
        expect(result.find((n) => n.id === "img-2")?.metadata?.groupId).toBe("grp");
    });

    it("fitGroupToEnclosedChildren 自适应包裹组内子节点", () => {
        const group = makeNode("grp", CanvasNodeType.Group, 0, 0, 1000, 1000);
        const child1 = makeNode("c1", CanvasNodeType.Image, 200, 200, 100, 100, { groupId: "grp" });
        const child2 = makeNode("c2", CanvasNodeType.Image, 400, 300, 100, 100, { groupId: "grp" });

        const result = fitGroupToEnclosedChildren("grp", [group, child1, child2], 30, 40, 30);
        const updatedGroup = result.find((n) => n.id === "grp");
        expect(updatedGroup?.position.x).toBe(200 - 30);
        expect(updatedGroup?.position.y).toBe(200 - 40);
        expect(updatedGroup?.width).toBe(300 + 60);
        expect(updatedGroup?.height).toBe(200 + 70);
    });
});
