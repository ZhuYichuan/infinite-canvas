import { describe, expect, it } from "vitest";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import { generateDuplicateNodeTitle, generateNextNodeTitle } from "@/lib/canvas/canvas-node-naming";

function makeNode(type: CanvasNodeType, title: string, id = title): CanvasNodeData {
    return {
        id,
        type,
        title,
        position: { x: 0, y: 0 },
        width: 100,
        height: 100,
    };
}

describe("canvas-node-naming", () => {
    describe("generateNextNodeTitle", () => {
        it("starts with -01 when no matching nodes exist", () => {
            expect(generateNextNodeTitle(CanvasNodeType.Video, [])).toBe("video-01");
            expect(generateNextNodeTitle(CanvasNodeType.Image, [])).toBe("image-01");
            expect(generateNextNodeTitle(CanvasNodeType.Text, [])).toBe("text-01");
            expect(generateNextNodeTitle(CanvasNodeType.Audio, [])).toBe("audio-01");
            expect(generateNextNodeTitle(CanvasNodeType.Config, [])).toBe("config-01");
            expect(generateNextNodeTitle(CanvasNodeType.Group, [])).toBe("group-01");
        });

        it("increments based on the highest existing matching index", () => {
            const nodes = [
                makeNode(CanvasNodeType.Video, "video-01"),
                makeNode(CanvasNodeType.Video, "video-02"),
                makeNode(CanvasNodeType.Image, "image-01"),
            ];
            expect(generateNextNodeTitle(CanvasNodeType.Video, nodes)).toBe("video-03");
            expect(generateNextNodeTitle(CanvasNodeType.Image, nodes)).toBe("image-02");
        });

        it("does not reuse deleted lower indexes, strictly taking max + 1", () => {
            const nodes = [
                makeNode(CanvasNodeType.Video, "video-01"),
                makeNode(CanvasNodeType.Video, "video-05"),
            ];
            expect(generateNextNodeTitle(CanvasNodeType.Video, nodes)).toBe("video-06");
        });

        it("ignores custom named nodes when calculating next index", () => {
            const nodes = [
                makeNode(CanvasNodeType.Image, "主角特写"),
                makeNode(CanvasNodeType.Image, "image-01"),
                makeNode(CanvasNodeType.Image, "图片"),
            ];
            expect(generateNextNodeTitle(CanvasNodeType.Image, nodes)).toBe("image-02");
        });

        it("handles indexes above 99 without truncation", () => {
            const nodes = [makeNode(CanvasNodeType.Image, "image-99")];
            expect(generateNextNodeTitle(CanvasNodeType.Image, nodes)).toBe("image-100");
        });
    });

    describe("generateDuplicateNodeTitle", () => {
        it("allocates the next sequential index when duplicating a default numbered node", () => {
            const node1 = makeNode(CanvasNodeType.Image, "image-01");
            const nodes = [node1];
            expect(generateDuplicateNodeTitle(node1, nodes)).toBe("image-02");
        });

        it("creates -副本 when duplicating a custom-named node", () => {
            const node = makeNode(CanvasNodeType.Image, "主角");
            const nodes = [node];
            expect(generateDuplicateNodeTitle(node, nodes)).toBe("主角-副本");
        });

        it("increments duplicate copy count when -副本 already exists", () => {
            const node1 = makeNode(CanvasNodeType.Image, "主角");
            const nodeCopy1 = makeNode(CanvasNodeType.Image, "主角-副本");
            const nodes = [node1, nodeCopy1];
            expect(generateDuplicateNodeTitle(nodeCopy1, nodes)).toBe("主角-副本 2");
            expect(generateDuplicateNodeTitle(node1, nodes)).toBe("主角-副本 2");
        });
    });
});
