import { describe, expect, it } from "vitest";

import { applyCanvasAgentOps, type CanvasAgentSnapshot } from "@/lib/canvas/canvas-agent-ops";
import {
    findInvalidNodeConnections,
    getAllInvalidConnectionIds,
    validateInputConnection,
} from "@/lib/canvas/canvas-node-geometry";
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

describe("Model-Driven Multimodal Connection Guards (Issue #8)", () => {
    it("Frame Video: 允许最多连接 2 张图片，拒绝第 3 张图片", () => {
        const frameNode: CanvasNodeData = {
            ...makeNode("frame-node", CanvasNodeType.Video),
            metadata: { modelId: "video_minimax_h3_frame", videoMode: "frame" },
        };
        const img1 = makeNode("img-1", CanvasNodeType.Image);
        const img2 = makeNode("img-2", CanvasNodeType.Image);
        const img3 = makeNode("img-3", CanvasNodeType.Image);
        const nodes = [frameNode, img1, img2, img3];

        // 1. 第 1 张图合法
        expect(validateInputConnection(img1.id, frameNode.id, nodes, [])).toEqual({
            fromNodeId: img1.id,
            toNodeId: frameNode.id,
        });

        // 2. 第 2 张图合法
        const conn1 = makeConnection("c-1", img1.id, frameNode.id);
        expect(validateInputConnection(img2.id, frameNode.id, nodes, [conn1])).toEqual({
            fromNodeId: img2.id,
            toNodeId: frameNode.id,
        });

        // 3. 第 3 张图必须拒绝 (quota 为 2)
        const conn2 = makeConnection("c-2", img2.id, frameNode.id);
        expect(validateInputConnection(img3.id, frameNode.id, nodes, [conn1, conn2])).toBeNull();
    });

    it("Frame Video: 严格拒绝视频与音频资源连接", () => {
        const frameNode: CanvasNodeData = {
            ...makeNode("frame-node", CanvasNodeType.Video),
            metadata: { modelId: "video_minimax_h3_frame", videoMode: "frame" },
        };
        const vid1 = makeNode("vid-1", CanvasNodeType.Video);
        const aud1 = makeNode("aud-1", CanvasNodeType.Audio);
        const nodes = [frameNode, vid1, aud1];

        // 视频连接被拒绝 (maxVideos: 0)
        expect(validateInputConnection(vid1.id, frameNode.id, nodes, [])).toBeNull();
        // 音频连接被拒绝 (maxAudios: 0)
        expect(validateInputConnection(aud1.id, frameNode.id, nodes, [])).toBeNull();
    });

    it("Omni Video: 允许最多 9 张图片、3 个视频、3 个音频，超出立即拒绝", () => {
        const omniNode: CanvasNodeData = {
            ...makeNode("omni-node", CanvasNodeType.Video),
            metadata: { modelId: "video_minimax_h3_omni", videoMode: "omni" },
        };

        // 构造 9 张已连图片
        const imgNodes = Array.from({ length: 10 }, (_, i) => makeNode(`img-${i + 1}`, CanvasNodeType.Image));
        const imgConns = imgNodes.slice(0, 9).map((n, i) => makeConnection(`c-img-${i + 1}`, n.id, omniNode.id));
        const allNodes = [omniNode, ...imgNodes];

        // 已经有 9 张图时，第 10 张图被拒绝
        expect(validateInputConnection(imgNodes[9].id, omniNode.id, allNodes, imgConns)).toBeNull();

        // 构造 3 个已连视频
        const vidNodes = Array.from({ length: 4 }, (_, i) => makeNode(`vid-${i + 1}`, CanvasNodeType.Video));
        const vidConns = vidNodes.slice(0, 3).map((n, i) => makeConnection(`c-vid-${i + 1}`, n.id, omniNode.id));
        const allNodesWithVids = [omniNode, ...vidNodes];

        // 已经有 3 个视频时，第 4 个视频被拒绝
        expect(validateInputConnection(vidNodes[3].id, omniNode.id, allNodesWithVids, vidConns)).toBeNull();
    });

    it("模型切换降低配额时，实时标识超额的既有连线 (findInvalidNodeConnections)", () => {
        const node: CanvasNodeData = {
            ...makeNode("target-node", CanvasNodeType.Video),
            metadata: { modelId: "video_minimax_h3_frame", videoMode: "frame" },
        };
        const img1 = makeNode("img-1", CanvasNodeType.Image);
        const img2 = makeNode("img-2", CanvasNodeType.Image);
        const img3 = makeNode("img-3", CanvasNodeType.Image);
        const img4 = makeNode("img-4", CanvasNodeType.Image);
        const vid1 = makeNode("vid-1", CanvasNodeType.Video);

        const nodes = [node, img1, img2, img3, img4, vid1];
        const connections = [
            makeConnection("c-1", img1.id, node.id),
            makeConnection("c-2", img2.id, node.id),
            makeConnection("c-3", img3.id, node.id),
            makeConnection("c-4", img4.id, node.id),
            makeConnection("c-5", vid1.id, node.id),
        ];

        // 在 Frame 模式下：前 2 张图合法，第 3、4 张图超额，视频不被支持
        const invalid = findInvalidNodeConnections(node.id, nodes, connections);
        expect(invalid.has("c-1")).toBe(false);
        expect(invalid.has("c-2")).toBe(false);
        expect(invalid.has("c-3")).toBe(true);
        expect(invalid.has("c-4")).toBe(true);
        expect(invalid.has("c-5")).toBe(true);

        // 当切换回 Omni 模式 (支持 9 图 3 视频) 时，全部连线恢复合法
        node.metadata = { modelId: "video_minimax_h3_omni", videoMode: "omni" };
        const invalidAfterOmni = findInvalidNodeConnections(node.id, nodes, connections);
        expect(invalidAfterOmni.size).toBe(0);

        // 全画布聚合探测验证
        const allInvalid = getAllInvalidConnectionIds(nodes, connections);
        expect(allInvalid.size).toBe(0);
    });
});
