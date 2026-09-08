import { describe, expect, it } from "vitest";

import i18n from "@/i18n";
import {
    CanvasNodeType,
    type CanvasConnection,
    type CanvasNodeData,
    type CanvasNodeMetadata,
    type CanvasNodeTypeId,
} from "@/types/canvas";

import { buildNodeGenerationContext } from "../canvas-node-generation";

const DATA_IMG = "data:image/png;base64,AA==";

function makeNode(
    id: string,
    type: CanvasNodeTypeId,
    metadata: CanvasNodeMetadata = {},
    title = id,
): CanvasNodeData {
    return {
        id,
        type,
        title,
        position: { x: 0, y: 0 },
        width: 100,
        height: 100,
        metadata,
    };
}

function input(from: string, to: string): CanvasConnection {
    return { id: `${from}->${to}`, fromNodeId: from, toNodeId: to, kind: "input" };
}

describe("buildNodeGenerationContext", () => {
    it("replaces only @[node:<id>] tokens, leaving plain node titles and Chinese label text untouched", () => {
        const textNode = makeNode("t1", CanvasNodeType.Text, { content: "这是中文说明" }, "节点标题");
        const imageNode = makeNode("img1", CanvasNodeType.Image, {
            content: DATA_IMG,
            mimeType: "image/png",
        }, "参考图片");
        const source = makeNode("out", CanvasNodeType.Image);
        const nodes = [textNode, imageNode, source];
        const connections = [input("t1", "out"), input("img1", "out")];
        const imageLabel = i18n.t("imageReferences.label", { index: 1 });

        const ctx = buildNodeGenerationContext(
            "out",
            nodes,
            connections,
            "保留 节点标题 与 这是中文说明 原文，替换 @[node:img1] 与 @[node:t1]",
        );

        expect(ctx.prompt).toBe(`保留 节点标题 与 这是中文说明 原文，替换 ${imageLabel} 与 这是中文说明`);
        expect(ctx.prompt).not.toContain("@[node:");
        expect(ctx.textCount).toBe(1);
        expect(ctx.imageCount).toBe(1);
        expect(ctx.referenceImages).toHaveLength(1);
        expect(ctx.referenceImages[0]?.dataUrl).toBe(DATA_IMG);
        expect(ctx.generationReferences.map((ref) => ref.nodeId)).toEqual(["t1", "img1"]);
    });

    it("throws the resourceMissing error synchronously when a token points to a nonexistent node", () => {
        const source = makeNode("out", CanvasNodeType.Image);
        const missingId = "ghost";

        expect(() =>
            buildNodeGenerationContext("out", [source], [], `引用 @[node:${missingId}]`),
        ).toThrow(i18n.t("agent.composer.mentions.resourceMissing", { title: missingId }));
    });

    it("throws the resourceMissing error synchronously when a token points to an existing but unconnected node", () => {
        const unconnected = makeNode(
            "t1",
            CanvasNodeType.Text,
            { content: "未被连接的文本" },
            "未连接文本",
        );
        const source = makeNode("out", CanvasNodeType.Image);

        expect(() =>
            buildNodeGenerationContext("out", [unconnected, source], [], "引用 @[node:t1]"),
        ).toThrow(i18n.t("agent.composer.mentions.resourceMissing", { title: "未连接文本" }));
    });

    it("with composerContent: submits only explicitly token-selected media and dedupes repeated references while keeping the label at every occurrence", () => {
        const img1 = makeNode("img1", CanvasNodeType.Image, {
            content: DATA_IMG,
            mimeType: "image/png",
        });
        const img2 = makeNode("img2", CanvasNodeType.Image, {
            content: DATA_IMG,
            mimeType: "image/png",
        });
        // Connected but never referenced by a token: must not be submitted.
        const unselected = makeNode("img3", CanvasNodeType.Image, {
            content: DATA_IMG,
            mimeType: "image/png",
        });
        const composerContent = "用 @[node:img1] 和 @[node:img2] 以及再次 @[node:img1] 生成";
        const config = makeNode("cfg", CanvasNodeType.Config, { composerContent });
        const nodes = [img1, img2, unselected, config];
        const connections = [input("img1", "cfg"), input("img2", "cfg"), input("img3", "cfg")];

        const ctx = buildNodeGenerationContext("cfg", nodes, connections, composerContent);

        const label1 = i18n.t("imageReferences.label", { index: 1 });
        const label2 = i18n.t("imageReferences.label", { index: 2 });
        expect(ctx.prompt).toBe(`用 ${label1} 和 ${label2} 以及再次 ${label1} 生成`);
        // img1 is referenced twice in the prompt but appears only once as a reference.
        expect(ctx.referenceImages).toHaveLength(2);
        expect(ctx.referenceImages.map((image) => image.id)).toEqual(["img1", "img2"]);
        expect(ctx.referenceImages[0]?.dataUrl).toBe(DATA_IMG);
        expect(ctx.imageCount).toBe(2);
        expect(ctx.generationReferences.map((ref) => ref.nodeId)).toEqual(["img1", "img2"]);
    });

    it("expands a repeated text token once per occurrence in the prompt", () => {
        const text = makeNode("t1", CanvasNodeType.Text, { content: "第一段文本" });
        const source = makeNode("out", CanvasNodeType.Image);

        const ctx = buildNodeGenerationContext(
            "out",
            [text, source],
            [input("t1", "out")],
            "引用 @[node:t1] 再次 @[node:t1]",
        );

        expect(ctx.prompt).toBe("引用 第一段文本 再次 第一段文本");
        expect(ctx.prompt.match(/第一段文本/g)).toHaveLength(2);
        expect(ctx.textCount).toBe(1);
        expect(ctx.generationReferences.filter((ref) => ref.kind === "text")).toHaveLength(1);
        expect(ctx.referenceImages).toHaveLength(0);
    });
});
