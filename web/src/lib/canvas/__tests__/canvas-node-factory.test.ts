import { describe, expect, it } from "vitest";
import { cloneNodeMetadata } from "@/lib/canvas/canvas-node-factory";
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
