import { describe, expect, it } from "vitest";

import { applyCanvasAgentOps, type CanvasAgentSnapshot } from "@/lib/canvas/canvas-agent-ops";
import { validateInputConnection } from "@/lib/canvas/canvas-node-geometry";
import {
    CanvasNodeType,
    type CanvasConnection,
    type CanvasNodeData,
    type CanvasNodeTypeId,
} from "@/types/canvas";

/** 最小节点工厂：只填校验用到的字段，其余给合理默认值。 */
function makeNode(id: string, type: CanvasNodeTypeId): CanvasNodeData {
    return {
        id,
        type,
        title: id,
        position: { x: 0, y: 0 },
        width: 100,
        height: 100,
    };
}

/** 构造 applyCanvasAgentOps 所需的最小快照。 */
function makeSnapshot(nodes: CanvasNodeData[], connections: CanvasConnection[] = []): CanvasAgentSnapshot {
    return {
        projectId: "p1",
        title: "t",
        nodes,
        connections,
        selectedNodeIds: [],
        viewport: { x: 0, y: 0, k: 1 },
    };
}

/** 一条已存在的 input 连线。 */
function makeConnection(id: string, fromNodeId: string, toNodeId: string): CanvasConnection {
    return { id, fromNodeId, toNodeId, kind: "input" };
}

describe("validateInputConnection", () => {
    it("合法：资源节点 -> Config", () => {
        const source = makeNode("img-1", CanvasNodeType.Image);
        const target = makeNode("cfg-1", CanvasNodeType.Config);
        const nodes = [source, target];

        const result = validateInputConnection(source.id, target.id, nodes);

        expect(result).toEqual({ fromNodeId: source.id, toNodeId: target.id });
    });

    it("拒绝：来源节点不存在", () => {
        const target = makeNode("cfg-1", CanvasNodeType.Config);
        const nodes = [target];

        expect(validateInputConnection("ghost", target.id, nodes)).toBeNull();
    });

    it("拒绝：目标节点不存在", () => {
        const source = makeNode("img-1", CanvasNodeType.Image);
        const nodes = [source];

        expect(validateInputConnection(source.id, "ghost", nodes)).toBeNull();
    });

    it("拒绝：自连接（from === to）", () => {
        const node = makeNode("img-1", CanvasNodeType.Image);
        const nodes = [node];

        expect(validateInputConnection(node.id, node.id, nodes)).toBeNull();
    });

    it("拒绝：Config 作为来源", () => {
        const config = makeNode("cfg-1", CanvasNodeType.Config);
        const target = makeNode("img-2", CanvasNodeType.Image);
        const nodes = [config, target];

        expect(validateInputConnection(config.id, target.id, nodes)).toBeNull();
    });

    it("拒绝：Group 作为目标", () => {
        const source = makeNode("img-1", CanvasNodeType.Image);
        const group = makeNode("grp-1", CanvasNodeType.Group);
        const nodes = [source, group];

        expect(validateInputConnection(source.id, group.id, nodes)).toBeNull();
    });

    it("拒绝：from/to 重复的既有连线", () => {
        const source = makeNode("img-1", CanvasNodeType.Image);
        const target = makeNode("cfg-1", CanvasNodeType.Config);
        const nodes = [source, target];
        const existing = [makeConnection("c-1", source.id, target.id)];

        expect(validateInputConnection(source.id, target.id, nodes, existing)).toBeNull();
    });
});

describe("applyCanvasAgentOps - connect_nodes", () => {
    it("合法边：新增一条 kind 为 input 的连线", () => {
        const source = makeNode("img-1", CanvasNodeType.Image);
        const target = makeNode("cfg-1", CanvasNodeType.Config);
        const snapshot = makeSnapshot([source, target]);

        const result = applyCanvasAgentOps(snapshot, [
            { type: "connect_nodes", fromNodeId: source.id, toNodeId: target.id },
        ]);

        expect(result.connections).toHaveLength(1);
        const created = result.connections[0];
        expect(created.fromNodeId).toBe(source.id);
        expect(created.toNodeId).toBe(target.id);
        expect(created.kind).toBe("input");
        expect(created.id).toBeTruthy();
    });

    it("拒绝：来源节点不存在，连线数不变", () => {
        const target = makeNode("cfg-1", CanvasNodeType.Config);
        const snapshot = makeSnapshot([target]);

        const result = applyCanvasAgentOps(snapshot, [
            { type: "connect_nodes", fromNodeId: "ghost", toNodeId: target.id },
        ]);

        expect(result.connections).toHaveLength(0);
    });

    it("拒绝：目标节点不存在，连线数不变", () => {
        const source = makeNode("img-1", CanvasNodeType.Image);
        const snapshot = makeSnapshot([source]);

        const result = applyCanvasAgentOps(snapshot, [
            { type: "connect_nodes", fromNodeId: source.id, toNodeId: "ghost" },
        ]);

        expect(result.connections).toHaveLength(0);
    });

    it("拒绝：自连接，连线数不变", () => {
        const node = makeNode("img-1", CanvasNodeType.Image);
        const snapshot = makeSnapshot([node]);

        const result = applyCanvasAgentOps(snapshot, [
            { type: "connect_nodes", fromNodeId: node.id, toNodeId: node.id },
        ]);

        expect(result.connections).toHaveLength(0);
    });

    it("拒绝：Config 作为来源，连线数不变", () => {
        const config = makeNode("cfg-1", CanvasNodeType.Config);
        const target = makeNode("img-2", CanvasNodeType.Image);
        const snapshot = makeSnapshot([config, target]);

        const result = applyCanvasAgentOps(snapshot, [
            { type: "connect_nodes", fromNodeId: config.id, toNodeId: target.id },
        ]);

        expect(result.connections).toHaveLength(0);
    });

    it("拒绝：Group 作为目标，连线数不变", () => {
        const source = makeNode("img-1", CanvasNodeType.Image);
        const group = makeNode("grp-1", CanvasNodeType.Group);
        const snapshot = makeSnapshot([source, group]);

        const result = applyCanvasAgentOps(snapshot, [
            { type: "connect_nodes", fromNodeId: source.id, toNodeId: group.id },
        ]);

        expect(result.connections).toHaveLength(0);
    });

    it("拒绝：from/to 重复的既有连线，连线数不变", () => {
        const source = makeNode("img-1", CanvasNodeType.Image);
        const target = makeNode("cfg-1", CanvasNodeType.Config);
        const existing = [makeConnection("c-1", source.id, target.id)];
        const snapshot = makeSnapshot([source, target], existing);

        const result = applyCanvasAgentOps(snapshot, [
            { type: "connect_nodes", fromNodeId: source.id, toNodeId: target.id },
        ]);

        expect(result.connections).toHaveLength(1);
        expect(result.connections[0].id).toBe("c-1");
    });
});
