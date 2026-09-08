import { describe, expect, it } from "vitest";

import { getGroupResourceNodes } from "@/lib/canvas/canvas-resource-references";
import {
    CanvasNodeType,
    type CanvasNodeData,
    type CanvasNodeMetadata,
    type CanvasNodeTypeId,
} from "@/types/canvas";

/** 最小节点工厂：补齐 CanvasNodeData 必填字段，测试只需传 id / type / metadata。 */
function makeNode(id: string, type: CanvasNodeTypeId, metadata?: CanvasNodeMetadata): CanvasNodeData {
    return {
        id,
        type,
        title: id,
        position: { x: 0, y: 0 },
        width: 0,
        height: 0,
        metadata,
    };
}

describe("getGroupResourceNodes", () => {
    it("递归展开两层嵌套 Group，返回有内容的 image/text/video/audio 资源，忽略空资源", () => {
        const nodes: CanvasNodeData[] = [
            makeNode("root", CanvasNodeType.Group),
            makeNode("image-a", CanvasNodeType.Image, { content: "data:image/png;base64,a", groupId: "root" }),
            makeNode("sub", CanvasNodeType.Group, { groupId: "root" }),
            makeNode("image-b", CanvasNodeType.Image, { content: "data:image/png;base64,b", groupId: "sub" }),
            makeNode("video-b", CanvasNodeType.Video, { content: "video-b", groupId: "sub" }),
            makeNode("audio-b", CanvasNodeType.Audio, { content: "audio-b", groupId: "sub" }),
            makeNode("text-a", CanvasNodeType.Text, { content: "text-a", groupId: "root" }),
            // 空资源：无 content / prompt，应被忽略
            makeNode("image-empty", CanvasNodeType.Image, { groupId: "root" }),
            makeNode("text-empty", CanvasNodeType.Text, { groupId: "sub" }),
        ];

        const result = getGroupResourceNodes("root", nodes);

        expect(result.map((n) => n.id)).toEqual(["image-a", "image-b", "video-b", "audio-b", "text-a"]);

        // image / text / video / audio 四类资源均被返回
        const kinds = new Set(result.map((n) => n.type));
        expect(kinds.has(CanvasNodeType.Image)).toBe(true);
        expect(kinds.has(CanvasNodeType.Text)).toBe(true);
        expect(kinds.has(CanvasNodeType.Video)).toBe(true);
        expect(kinds.has(CanvasNodeType.Audio)).toBe(true);

        // 空资源不在结果中
        const ids = result.map((n) => n.id);
        expect(ids).not.toContain("image-empty");
        expect(ids).not.toContain("text-empty");
    });

    it("groupId 互相包含形成循环时不会无限递归，且资源不重复", () => {
        // group-a 与 group-b 互为对方的子 Group：
        // 节点 "group-a" 属于组 "group-b"，节点 "group-b" 属于组 "group-a"
        const nodes: CanvasNodeData[] = [
            makeNode("group-a", CanvasNodeType.Group, { groupId: "group-b" }),
            makeNode("group-b", CanvasNodeType.Group, { groupId: "group-a" }),
            makeNode("res-a", CanvasNodeType.Image, { content: "data:image/png;base64,ra", groupId: "group-a" }),
            makeNode("res-b", CanvasNodeType.Video, { content: "video-b", groupId: "group-b" }),
        ];

        // 若存在无限递归将抛出 RangeError（调用栈溢出）；能正常返回即说明环已被 visitedGroups 打断
        const result = getGroupResourceNodes("group-a", nodes);

        const ids = result.map((n) => n.id);
        expect(ids).toContain("res-a");
        expect(ids).toContain("res-b");
        expect(result).toHaveLength(2);
        // 无重复：去重后数量不变
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("结果顺序按深度优先，且每层保持 nodes 原始顺序", () => {
        // root 层原始顺序：sub(Group) → a1(Image) → a2(Video)
        // sub 层原始顺序：s1a(Text) → s1b(Audio)
        const nodes: CanvasNodeData[] = [
            makeNode("root", CanvasNodeType.Group),
            makeNode("sub", CanvasNodeType.Group, { groupId: "root" }),
            makeNode("s1a", CanvasNodeType.Text, { content: "s1a", groupId: "sub" }),
            makeNode("s1b", CanvasNodeType.Audio, { content: "audio-s1b", groupId: "sub" }),
            makeNode("a1", CanvasNodeType.Image, { content: "data:image/png;base64,a1", groupId: "root" }),
            makeNode("a2", CanvasNodeType.Video, { content: "video-a2", groupId: "root" }),
        ];

        const result = getGroupResourceNodes("root", nodes);

        // 深度优先：先完整遍历 sub 子树（s1a、s1b 按原始顺序），
        // 再回到 root 层按原始顺序继续（a1、a2）——区别于广度优先或“资源优先”的顺序
        expect(result.map((n) => n.id)).toEqual(["s1a", "s1b", "a1", "a2"]);
    });
});
