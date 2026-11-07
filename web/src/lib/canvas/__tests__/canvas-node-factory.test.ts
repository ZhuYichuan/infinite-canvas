import { describe, expect, it } from "vitest";
import { applyNodeConfigPatch, cloneNodeMetadata, createCanvasNode, createDefaultNodeMetadata } from "@/lib/canvas/canvas-node-factory";
import { CanvasNodeType } from "@/types/canvas";
import type { CanvasNodeMetadata } from "@/types/canvas";

describe("cloneNodeMetadata", () => {
    it("promotes active composerContent draft to prompt and clears composerContent to avoid ghost shadow", () => {
        const metadata: CanvasNodeMetadata = {
            prompt: "original prompt",
            composerContent: "edited prompt draft",
            model: "test-model",
            generationMode: "image",
            content: "data:image/png;base64,xxx",
            status: "success",
        };

        const cloned = cloneNodeMetadata(metadata, CanvasNodeType.Image);
        expect(cloned).toBeDefined();
        // The active draft becomes the official prompt of the cloned node
        expect(cloned?.prompt).toBe("edited prompt draft");
        // composerContent is purged so it never shadows the prompt
        expect(cloned?.composerContent).toBeUndefined();
        // AI media content is cleared and status is reset to idle
        expect(cloned?.content).toBe("");
        expect(cloned?.status).toBe("idle");
    });

    it("does not carry a running task's progress into the clone", () => {
        const cloned = cloneNodeMetadata({ status: "loading", progressPct: 62, progressNodeClassType: "KSampler" }, CanvasNodeType.Image);
        expect(cloned?.progressPct).toBeUndefined();
        expect(cloned?.progressNodeClassType).toBeUndefined();
    });

    it("clears composerContent even when only prompt is present", () => {
        const metadata: CanvasNodeMetadata = {
            prompt: "clean prompt",
            model: "test-model",
            generationMode: "video",
            status: "success",
            content: "https://example.com/video.mp4",
        };

        const cloned = cloneNodeMetadata(metadata, CanvasNodeType.Video);
        expect(cloned?.prompt).toBe("clean prompt");
        expect(cloned?.composerContent).toBeUndefined();
        expect(cloned?.content).toBe("");
        expect(cloned?.status).toBe("idle");
    });

    it("purges transient runtime fields like jobId, queuePosition, errorDetails, and isTimeout", () => {
        const metadata: CanvasNodeMetadata = {
            prompt: "some prompt",
            jobId: "job-123",
            queuePosition: 2,
            networkRetryText: "Retrying...",
            errorDetails: "timeout occurred",
            isTimeout: true,
            generationMode: "image",
            status: "error",
        };

        const cloned = cloneNodeMetadata(metadata, CanvasNodeType.Image);
        expect(cloned?.jobId).toBeUndefined();
        expect(cloned?.queuePosition).toBeUndefined();
        expect(cloned?.networkRetryText).toBeUndefined();
        expect(cloned?.errorDetails).toBeUndefined();
        expect(cloned?.isTimeout).toBeUndefined();
        expect(cloned?.status).toBe("idle");
    });

    it("resets AI video, audio, and text nodes correctly while preserving parameters", () => {
        const videoMeta: CanvasNodeMetadata = {
            prompt: "cyberpunk city",
            composerContent: "cyberpunk city night",
            modelId: "omni-video-minimax-h3",
            generationMode: "video",
            videoMode: "omni",
            seconds: "5",
            content: "https://example.com/video.mp4",
            status: "success",
        };
        const clonedVideo = cloneNodeMetadata(videoMeta, CanvasNodeType.Video);
        expect(clonedVideo?.prompt).toBe("cyberpunk city night");
        expect(clonedVideo?.composerContent).toBeUndefined();
        expect(clonedVideo?.content).toBe("");
        expect(clonedVideo?.status).toBe("idle");
        expect(clonedVideo?.modelId).toBe("omni-video-minimax-h3");
        expect(clonedVideo?.seconds).toBe("5");

        const textMeta: CanvasNodeMetadata = {
            prompt: "write a story",
            composerContent: "write a sci-fi story",
            generationMode: "text",
            texts: [{ id: "t1", content: "generated story", status: "success" }],
            content: "generated story",
            status: "success",
        };
        const clonedText = cloneNodeMetadata(textMeta, CanvasNodeType.Text);
        expect(clonedText?.prompt).toBe("write a sci-fi story");
        expect(clonedText?.composerContent).toBeUndefined();
        expect(clonedText?.content).toBe("");
        expect(clonedText?.texts).toBeUndefined();
        expect(clonedText?.status).toBe("idle");
    });

    it("preserves manual assets without clearing content", () => {
        const manualUploadMeta: CanvasNodeMetadata = {
            content: "https://example.com/uploaded.png",
            mimeType: "image/png",
            bytes: 12345,
            naturalWidth: 800,
            naturalHeight: 600,
        };
        const cloned = cloneNodeMetadata(manualUploadMeta, CanvasNodeType.Image);
        expect(cloned?.content).toBe("https://example.com/uploaded.png");
        expect(cloned?.status).toBe("success");
    });
});

describe("applyNodeConfigPatch", () => {
    it("clears video workflow binding when patched with an explicit undefined", () => {
        const node = {
            id: "video-1",
            type: CanvasNodeType.Video,
            title: "video",
            position: { x: 0, y: 0 },
            width: 320,
            height: 240,
            metadata: {
                modelId: "omni-video-minimax-h3-int8-6step-pika",
                workflowId: "builtin-omni-video-minimax-h3-fp8-4step-pdmd",
                videoMode: "omni",
            },
        } as unknown as Parameters<typeof applyNodeConfigPatch>[0];

        const next = applyNodeConfigPatch(node, { modelId: "omni-video-minimax-h3-int8-4step-pdmd", workflowId: undefined });
        expect(next.metadata?.modelId).toBe("omni-video-minimax-h3-int8-4step-pdmd");
        // workflowId 必须被真正清除，否则执行侧会优先采用它并跳过 modelId 对应的内置工作流
        expect(next.metadata?.workflowId).toBeUndefined();
        expect(Object.prototype.hasOwnProperty.call(next.metadata, "workflowId")).toBe(true);
    });

    it("resizes node around geometric center anchor when aspect ratio changes", () => {
        const node = {
            id: "img-1",
            type: CanvasNodeType.Image,
            title: "img",
            position: { x: 100, y: 100 },
            width: 420,
            height: 420,
            metadata: { size: "1:1" },
        } as unknown as Parameters<typeof applyNodeConfigPatch>[0];

        // Old center: x: 100 + 420/2 = 310, y: 100 + 420/2 = 310
        const patched = applyNodeConfigPatch(node, { size: "16:9" });
        expect(patched.width).toBe(420);
        expect(patched.height).toBe(236);
        // New center must remain (310, 310) -> x: 310 - 420/2 = 100, y: 310 - 236/2 = 192
        expect(patched.position.x).toBe(100);
        expect(patched.position.y).toBe(192);
        expect(patched.position.x + patched.width / 2).toBe(310);
        expect(patched.position.y + patched.height / 2).toBe(310);
    });

    it("preserves user manually enlarged dimensions when switching ratio", () => {
        const enlarged = {
            id: "img-2",
            type: CanvasNodeType.Image,
            title: "img",
            position: { x: 0, y: 0 },
            width: 600,
            height: 600,
            metadata: { size: "1:1" },
        } as unknown as Parameters<typeof applyNodeConfigPatch>[0];

        const patched = applyNodeConfigPatch(enlarged, { size: "16:9" });
        expect(patched.width).toBe(600);
        expect(patched.height).toBe(338);
        expect(patched.position.x + patched.width / 2).toBe(300);
        expect(patched.position.y + patched.height / 2).toBe(300);
    });
});

describe("createCanvasNode with pre-fitted dimensions", () => {
    it("spawns image node with preferred 16:9 aspect ratio directly centered at target position", () => {
        const center = { x: 500, y: 500 };
        const node = createCanvasNode(CanvasNodeType.Image, center, { size: "16:9" });

        expect(node.width).toBe(420);
        expect(node.height).toBe(236);
        // Center of the node must be exactly (500, 500)
        expect(node.position.x + node.width / 2).toBe(500);
        expect(node.position.y + node.height / 2).toBe(500);
    });

    it("spawns image node with default 1:1 square centered at target position", () => {
        const center = { x: 500, y: 500 };
        const node = createCanvasNode(CanvasNodeType.Image, center);

        expect(node.width).toBe(420);
        expect(node.height).toBe(420);
        expect(node.position.x + node.width / 2).toBe(500);
        expect(node.position.y + node.height / 2).toBe(500);
    });
});
