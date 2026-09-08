import { describe, expect, it } from "vitest";

import { findRetrySourceNode, isGenerationCanceled, restoreGenerationContext, shouldMarkGenerationSourceStatus } from "@/lib/canvas/canvas-generation-helpers";
import { CanvasNodeType } from "@/types/canvas";
import type { CanvasConnection, CanvasNodeData, CanvasNodeMetadata } from "@/types/canvas";

// Small shared factory so each test case can build minimal nodes with one call.
function makeNode(type: CanvasNodeData["type"], metadata: CanvasNodeMetadata = {}, id?: string): CanvasNodeData {
    return {
        id: id || `node-${type}`,
        type,
        title: "test node",
        position: { x: 0, y: 0 },
        width: 100,
        height: 100,
        metadata,
    };
}

function makeConnection(fromNodeId: string, toNodeId: string, kind: CanvasConnection["kind"]): CanvasConnection {
    return { id: `conn-${fromNodeId}->${toNodeId}-${kind}`, fromNodeId, toNodeId, kind };
}

describe("shouldMarkGenerationSourceStatus", () => {
    it("does not mark a successful image source with content", () => {
        const node = makeNode(CanvasNodeType.Image, { status: "success", content: "data:image/png;base64,xx" });
        expect(shouldMarkGenerationSourceStatus(node)).toBe(false);
    });

    it("does not mark a successful video source with content", () => {
        const node = makeNode(CanvasNodeType.Video, { status: "success", content: "https://example.com/video.mp4" });
        expect(shouldMarkGenerationSourceStatus(node)).toBe(false);
    });

    it("does not mark a successful audio source with content", () => {
        const node = makeNode(CanvasNodeType.Audio, { status: "success", content: "https://example.com/audio.mp3" });
        expect(shouldMarkGenerationSourceStatus(node)).toBe(false);
    });

    it("does not mark a successful text source with content", () => {
        const node = makeNode(CanvasNodeType.Text, { status: "success", content: "some prompt text" });
        expect(shouldMarkGenerationSourceStatus(node)).toBe(false);
    });

    it("marks a Config source even when it has success content", () => {
        const node = makeNode(CanvasNodeType.Config, { status: "success", content: "data:image/png;base64,xx" });
        expect(shouldMarkGenerationSourceStatus(node)).toBe(true);
    });

    it("marks a source whose status is error", () => {
        const node = makeNode(CanvasNodeType.Image, { status: "error", content: "data:image/png;base64,xx" });
        expect(shouldMarkGenerationSourceStatus(node)).toBe(true);
    });

    it("marks a source with empty content", () => {
        const node = makeNode(CanvasNodeType.Image, { status: "success", content: "" });
        expect(shouldMarkGenerationSourceStatus(node)).toBe(true);
    });

    it("marks a source that never reported a success status", () => {
        const node = makeNode(CanvasNodeType.Image, { status: "idle", content: "data:image/png;base64,xx" });
        expect(shouldMarkGenerationSourceStatus(node)).toBe(true);
    });

    it("marks a null or undefined source", () => {
        expect(shouldMarkGenerationSourceStatus(null)).toBe(true);
        expect(shouldMarkGenerationSourceStatus(undefined)).toBe(true);
    });
});

describe("findRetrySourceNode", () => {
    it("walks lineage connections back to the Config node", () => {
        const config = makeNode(CanvasNodeType.Config, {}, "cfg");
        const image = makeNode(CanvasNodeType.Image, { status: "success", content: "data:image/png;base64,xx" }, "img");
        const child = makeNode(CanvasNodeType.Image, { status: "error" }, "child");
        const nodes = [config, image, child];
        const connections = [makeConnection(config.id, image.id, "lineage"), makeConnection(image.id, child.id, "lineage")];
        expect(findRetrySourceNode(child.id, nodes, connections)).toBe(config);
    });

    it("does not follow input connections", () => {
        const config = makeNode(CanvasNodeType.Config, {}, "cfg");
        const target = makeNode(CanvasNodeType.Image, {}, "target");
        const nodes = [config, target];
        const connections = [makeConnection(config.id, target.id, "input")];
        expect(findRetrySourceNode(target.id, nodes, connections)).toBeNull();
    });

    it("returns null when the lineage path has no Config node", () => {
        const image = makeNode(CanvasNodeType.Image, {}, "img");
        const target = makeNode(CanvasNodeType.Image, {}, "target");
        const nodes = [image, target];
        const connections = [makeConnection(image.id, target.id, "lineage")];
        expect(findRetrySourceNode(target.id, nodes, connections)).toBeNull();
    });
});

describe("restoreGenerationContext", () => {
    it("replays the saved effective prompt and multimodal references in snapshot order", async () => {
        const context = await restoreGenerationContext({
            effectivePrompt: "历史请求",
            generationReferences: [
                { nodeId: "text-1", kind: "text", text: "正文" },
                { nodeId: "image-1", kind: "image", url: "data:image/png;base64,AA==", mimeType: "image/png" },
                { nodeId: "video-1", kind: "video", url: "blob:video", mimeType: "video/mp4" },
                { nodeId: "audio-1", kind: "audio", url: "blob:audio", mimeType: "audio/mpeg" },
            ],
        });

        expect(context?.prompt).toBe("历史请求");
        expect(context?.generationReferences.map((reference) => reference.nodeId)).toEqual(["text-1", "image-1", "video-1", "audio-1"]);
        expect(context?.referenceImages.map((reference) => reference.id)).toEqual(["image-1"]);
        expect(context?.referenceVideos.map((reference) => reference.id)).toEqual(["video-1"]);
        expect(context?.referenceAudios.map((reference) => reference.id)).toEqual(["audio-1"]);
    });
});

describe("isGenerationCanceled", () => {
    it("detects AbortError by name", () => {
        const error = new Error("The user aborted a request.");
        error.name = "AbortError";
        expect(isGenerationCanceled(error)).toBe(true);
    });

    it("detects ComfyuiAbortedError by name", () => {
        const error = new Error("comfyui aborted");
        error.name = "ComfyuiAbortedError";
        expect(isGenerationCanceled(error)).toBe(true);
    });

    it("returns false for unrelated errors and non-error values", () => {
        expect(isGenerationCanceled(new Error("boom"))).toBe(false);
        expect(isGenerationCanceled("aborted")).toBe(false);
        expect(isGenerationCanceled(null)).toBe(false);
    });
});
