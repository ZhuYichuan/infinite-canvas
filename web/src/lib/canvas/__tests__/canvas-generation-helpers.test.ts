import { describe, expect, it } from "vitest";
import { TaskExecutionError } from "@/services/api/task";

import {
    buildGeneratedNodeConnections,
    buildPastedNodeConnections,
    countInterruptedTasks,
    duplicateIncomingConnections,
    findRetrySourceNode,
    formatCompactErrorMessage,
    formatNodeLoadingText,
    generateNextSeed,
    hasInterruptedGeneration,
    isCancelledGenerationError,
    isGenerationCanceled,
    isInterruptedGenerationError,
    isJobExecutionError,
    isLostOrNotFoundGenerationError,
    isNetworkGenerationError,
    isTimeoutGenerationError,
    resetInterruptedGeneration,
    restoreGenerationContext,
    shouldMarkGenerationSourceStatus,
    updateNodeGenerationProgress,
} from "@/lib/canvas/canvas-generation-helpers";
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

describe("generateNextSeed", () => {
    it("returns a valid non-negative integer within range", () => {
        const seed = generateNextSeed();
        expect(typeof seed).toBe("number");
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThan(9007199254740991);
    });

    it("ensures next seed differs from previous seed", () => {
        const fixedRandom = vi.spyOn(Math, "random").mockReturnValue(0);
        expect(generateNextSeed(0, 10)).not.toBe(0);
        fixedRandom.mockRestore();
    });
});

describe("buildGeneratedNodeConnections", () => {
    it("connects directly from source node when intent is 'new'", () => {
        const source = makeNode(CanvasNodeType.Text, {}, "src");
        const targetId = "tgt";
        const connections = [makeConnection("parent", source.id, "lineage")];
        const result = buildGeneratedNodeConnections(source.id, targetId, "new", connections, [source]);

        expect(result).toHaveLength(1);
        expect(result[0].fromNodeId).toBe("src");
        expect(result[0].toNodeId).toBe("tgt");
        expect(result[0].kind).toBe("lineage");
    });

    it("connects to parent node(s) when intent is 'repeat'", () => {
        const parent = makeNode(CanvasNodeType.Text, {}, "parent-1");
        const current = makeNode(CanvasNodeType.Image, {}, "current-img");
        const targetId = "new-img";
        const connections = [makeConnection(parent.id, current.id, "lineage")];
        const result = buildGeneratedNodeConnections(current.id, targetId, "repeat", connections, [parent, current]);

        expect(result).toHaveLength(1);
        expect(result[0].fromNodeId).toBe("parent-1");
        expect(result[0].toNodeId).toBe("new-img");
        expect(result[0].kind).toBe("lineage");
    });

    it("connects to multiple parent nodes with their respective kinds on 'repeat'", () => {
        const promptParent = makeNode(CanvasNodeType.Text, {}, "prompt-parent");
        const imageParent = makeNode(CanvasNodeType.Image, {}, "ref-parent");
        const current = makeNode(CanvasNodeType.Image, {}, "current-img");
        const targetId = "new-img";
        const connections = [
            makeConnection(promptParent.id, current.id, "lineage"),
            makeConnection(imageParent.id, current.id, "input"),
        ];
        const result = buildGeneratedNodeConnections(current.id, targetId, "repeat", connections, [promptParent, imageParent, current]);

        expect(result).toHaveLength(2);
        expect(result.find((c) => c.fromNodeId === "prompt-parent")?.kind).toBe("lineage");
        expect(result.find((c) => c.fromNodeId === "ref-parent")?.kind).toBe("input");
        expect(result.every((c) => c.toNodeId === "new-img")).toBe(true);
        expect(result.some((c) => c.fromNodeId === current.id)).toBe(false);
    });

    it("returns empty connections if current node has no parent connections on 'repeat' (never connects to current node)", () => {
        const current = makeNode(CanvasNodeType.Text, {}, "standalone-text");
        const targetId = "new-text";
        const result = buildGeneratedNodeConnections(current.id, targetId, "repeat", [], [current]);

        expect(result).toHaveLength(0);
        expect(result.some((c) => c.fromNodeId === current.id)).toBe(false);
    });

    it("returns empty connections if all parent nodes have been deleted from canvas on 'repeat'", () => {
        const current = makeNode(CanvasNodeType.Text, {}, "current-text");
        const targetId = "new-text";
        const connections = [makeConnection("deleted-parent", current.id, "lineage")];
        const result = buildGeneratedNodeConnections(current.id, targetId, "repeat", connections, [current]);

        expect(result).toHaveLength(0);
        expect(result.some((c) => c.fromNodeId === current.id)).toBe(false);
    });

    it("connects text node to parent node(s) on 'repeat', identical to image nodes", () => {
        const imageParent = makeNode(CanvasNodeType.Image, {}, "image-parent");
        const currentText = makeNode(CanvasNodeType.Text, {}, "current-text");
        const targetId = "new-text";
        const connections = [makeConnection(imageParent.id, currentText.id, "input")];
        const result = buildGeneratedNodeConnections(currentText.id, targetId, "repeat", connections, [imageParent, currentText]);

        expect(result).toHaveLength(1);
        expect(result[0].fromNodeId).toBe("image-parent");
        expect(result[0].toNodeId).toBe("new-text");
        expect(result[0].kind).toBe("input");
        expect(result.some((c) => c.fromNodeId === currentText.id)).toBe(false);
    });

    it("deduplicates connections if multiple edges exist from the same parent", () => {
        const parent = makeNode(CanvasNodeType.Text, {}, "parent-1");
        const current = makeNode(CanvasNodeType.Image, {}, "current-img");
        const targetId = "new-img";
        const connections = [
            { id: "c1", fromNodeId: parent.id, toNodeId: current.id, kind: "input" as const },
            { id: "c2", fromNodeId: parent.id, toNodeId: current.id, kind: "input" as const },
        ];
        const result = buildGeneratedNodeConnections(current.id, targetId, "repeat", connections, [parent, current]);

        expect(result).toHaveLength(1);
        expect(result[0].fromNodeId).toBe("parent-1");
    });
});

describe("duplicateIncomingConnections", () => {
    it("duplicates incoming connections to the target node", () => {
        const parent1 = makeNode(CanvasNodeType.Text, {}, "text-1");
        const parent2 = makeNode(CanvasNodeType.Image, {}, "ref-1");
        const target = makeNode(CanvasNodeType.Image, {}, "img-1");
        const connections = [
            makeConnection(parent1.id, target.id, "input"),
            makeConnection(parent2.id, target.id, "lineage"),
        ];

        const result = duplicateIncomingConnections(target.id, "img-copy", connections, [parent1, parent2, target]);
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ fromNodeId: "text-1", toNodeId: "img-copy", kind: "input" });
        expect(result[1]).toMatchObject({ fromNodeId: "ref-1", toNodeId: "img-copy", kind: "lineage" });
    });

    it("returns empty array if source node has no incoming connections", () => {
        const standalone = makeNode(CanvasNodeType.Text, {}, "text-1");
        const result = duplicateIncomingConnections(standalone.id, "text-copy", [], [standalone]);
        expect(result).toEqual([]);
    });

    it("filters out incoming connections whose parent nodes are not on canvas", () => {
        const target = makeNode(CanvasNodeType.Image, {}, "img-1");
        const connections = [makeConnection("missing-parent", target.id, "input")];
        const result = duplicateIncomingConnections(target.id, "img-copy", connections, [target]);
        expect(result).toEqual([]);
    });

    it("deduplicates connections from the same parent node", () => {
        const parent = makeNode(CanvasNodeType.Text, {}, "text-1");
        const target = makeNode(CanvasNodeType.Image, {}, "img-1");
        const connections = [
            { id: "c1", fromNodeId: parent.id, toNodeId: target.id, kind: "input" as const },
            { id: "c2", fromNodeId: parent.id, toNodeId: target.id, kind: "input" as const },
        ];
        const result = duplicateIncomingConnections(target.id, "img-copy", connections, [parent, target]);
        expect(result).toHaveLength(1);
        expect(result[0].fromNodeId).toBe("text-1");
        expect(result[0].toNodeId).toBe("img-copy");
    });
});

describe("buildPastedNodeConnections", () => {
    it("preserves internal connections between copied nodes and external connections from existing canvas parents", () => {
        const externalParent = makeNode(CanvasNodeType.Text, {}, "ext-parent");
        const childA = makeNode(CanvasNodeType.Image, {}, "orig-a");
        const childB = makeNode(CanvasNodeType.Video, {}, "orig-b");

        const idMap = new Map<string, string>([
            ["orig-a", "pasted-a"],
            ["orig-b", "pasted-b"],
        ]);

        const sourceConnections: CanvasConnection[] = [
            makeConnection(externalParent.id, childA.id, "input"),
            makeConnection(childA.id, childB.id, "lineage"),
        ];

        const result = buildPastedNodeConnections(sourceConnections, idMap, [externalParent, childA, childB]);
        expect(result).toHaveLength(2);
        // External parent connects to pasted child A
        expect(result[0]).toMatchObject({ fromNodeId: "ext-parent", toNodeId: "pasted-a", kind: "input" });
        // Internal connection connects pasted child A to pasted child B
        expect(result[1]).toMatchObject({ fromNodeId: "pasted-a", toNodeId: "pasted-b", kind: "lineage" });
    });

    it("ignores connections if target node is not part of pasted mapping", () => {
        const idMap = new Map<string, string>([["orig-a", "pasted-a"]]);
        const sourceConnections: CanvasConnection[] = [
            makeConnection("orig-a", "unmapped-b", "lineage"),
        ];
        const result = buildPastedNodeConnections(sourceConnections, idMap, []);
        expect(result).toHaveLength(0);
    });

    it("ignores external connections if parent node was deleted from canvas", () => {
        const idMap = new Map<string, string>([["orig-a", "pasted-a"]]);
        const sourceConnections: CanvasConnection[] = [
            makeConnection("deleted-parent", "orig-a", "input"),
        ];
        const result = buildPastedNodeConnections(sourceConnections, idMap, []);
        expect(result).toHaveLength(0);
    });
});

describe("hasInterruptedGeneration and countInterruptedTasks", () => {
    it("detects node-level interrupted generation", () => {
        const interruptedNode = makeNode(CanvasNodeType.Image, {
            status: "error",
            errorDetails: "页面刷新后生成已中断，请重新生成。",
        });
        const normalNode = makeNode(CanvasNodeType.Image, {
            status: "success",
            content: "data:image/png;base64,xx",
        });
        const otherErrorNode = makeNode(CanvasNodeType.Image, {
            status: "error",
            errorDetails: "Server error 500",
        });

        expect(hasInterruptedGeneration(interruptedNode)).toBe(true);
        expect(hasInterruptedGeneration(normalNode)).toBe(false);
        expect(hasInterruptedGeneration(otherErrorNode)).toBe(false);
    });

    it("detects batch image slot interrupted generation", () => {
        const batchNode = makeNode(CanvasNodeType.Image, {
            status: "error",
            images: [
                { id: "img-1", status: "success", content: "data:1" },
                { id: "img-2", status: "error", errorDetails: "页面刷新后生成已中断，请重新生成。" },
            ],
        });
        expect(hasInterruptedGeneration(batchNode)).toBe(true);
    });

    it("counts interrupted tasks correctly including batch slots", () => {
        const node1 = makeNode(CanvasNodeType.Image, {
            status: "error",
            errorDetails: "页面刷新后生成已中断，请重新生成。",
        });
        const node2 = makeNode(CanvasNodeType.Image, {
            status: "error",
            images: [
                { id: "img-1", status: "success", content: "data:1" },
                { id: "img-2", status: "error", errorDetails: "页面刷新后生成已中断，请重新生成。" },
                { id: "img-3", status: "error", errorDetails: "页面刷新后生成已中断，请重新生成。" },
            ],
        });
        const node3 = makeNode(CanvasNodeType.Video, {
            status: "error",
            errorDetails: "Generation was interrupted by a page refresh. Generate again.",
        });
        const nodeNormal = makeNode(CanvasNodeType.Text, { status: "success", content: "hi" });

        expect(countInterruptedTasks([node1, node2, node3, nodeNormal])).toBe(4);
    });

    it("resets loading and interrupted sub-items properly", () => {
        const loadingNode = makeNode(CanvasNodeType.Image, {
            status: "loading",
            images: [
                { id: "img-1", status: "loading" },
                { id: "img-2", status: "success", content: "data:2" },
            ],
        });
        const [reset] = resetInterruptedGeneration([loadingNode]);
        expect(reset.metadata?.status).toBe("error");
        expect(isInterruptedGenerationError(reset.metadata?.errorDetails)).toBe(true);
        expect(reset.metadata?.images?.[0].status).toBe("error");
        expect(isInterruptedGenerationError(reset.metadata?.images?.[0].errorDetails)).toBe(true);
        expect(reset.metadata?.images?.[1].status).toBe("success");
    });
});

describe("error classification helpers", () => {
    it("correctly identifies network errors", () => {
        expect(isNetworkGenerationError(new TaskExecutionError("network err", "network"))).toBe(true);
        expect(isNetworkGenerationError(new Error("Failed to fetch"))).toBe(true);
        expect(isNetworkGenerationError(new Error("无法连接 ComfyUI 服务（http://192.168.31.188:8188）"))).toBe(true);
        expect(isNetworkGenerationError(new Error("本地网络连接已断开，请检查网络设置"))).toBe(true);
        expect(isNetworkGenerationError({ name: "ComfyuiNetworkError", message: "foo" })).toBe(true);
        expect(isNetworkGenerationError(new Error("CUDA out of memory"))).toBe(false);
    });

    it("correctly identifies lost or not found errors", () => {
        expect(isLostOrNotFoundGenerationError(new TaskExecutionError("task lost", "lost"))).toBe(true);
        expect(isLostOrNotFoundGenerationError({ name: "ComfyuiJobLostError", message: "lost" })).toBe(true);
        expect(isLostOrNotFoundGenerationError({ name: "ComfyuiJobNotFoundError", message: "not found" })).toBe(true);
        expect(isLostOrNotFoundGenerationError(new Error("ComfyUI 任务已丢失"))).toBe(true);
        expect(isLostOrNotFoundGenerationError(new Error("ComfyUI 任务不存在"))).toBe(true);
        expect(isLostOrNotFoundGenerationError(new Error("other error"))).toBe(false);
    });

    it("correctly identifies cancelled errors without confusing with page refresh", () => {
        expect(isCancelledGenerationError(new TaskExecutionError("user cancel", "cancelled"))).toBe(true);
        expect(isCancelledGenerationError({ name: "ComfyuiJobCancelledError", message: "cancelled" })).toBe(true);
        expect(isCancelledGenerationError({ name: "ComfyuiAbortedError", message: "aborted" })).toBe(true);
        expect(isCancelledGenerationError(new Error("任务已取消"))).toBe(true);
        expect(isInterruptedGenerationError("任务已取消")).toBe(false);
        expect(isInterruptedGenerationError("页面刷新后生成已中断，请重新生成。")).toBe(true);
    });

    it("correctly identifies timeout and job errors", () => {
        expect(isTimeoutGenerationError(new TaskExecutionError("timeout", "timeout"))).toBe(true);
        expect(isTimeoutGenerationError({ name: "ComfyuiTimeoutError", message: "timeout" })).toBe(true);
        expect(isTimeoutGenerationError(new Error("排队超时"))).toBe(true);
        expect(isJobExecutionError(new TaskExecutionError("failed", "execution_failed"))).toBe(true);
        expect(isJobExecutionError({ name: "ComfyuiJobError", message: "job err" })).toBe(true);
        expect(isJobExecutionError(new Error("other"))).toBe(false);
    });
});

describe("formatCompactErrorMessage", () => {
    it("extracts host and port from full ComfyUI connection error", () => {
        const full = "无法连接 ComfyUI 服务（http://192.168.31.188:8188）。服务可能已崩溃或未启动，请检查服务状态与端口";
        expect(formatCompactErrorMessage(full)).toBe("无法连接 ComfyUI (192.168.31.188:8188)");
    });

    it("formats offline message concisely", () => {
        const full = "本地网络连接已断开，请检查网络设置";
        expect(formatCompactErrorMessage(full)).toBe("本地网络已断开");
    });

    it("translates raw Failed to fetch into Chinese", () => {
        expect(formatCompactErrorMessage("Failed to fetch")).toBe("无法连接 ComfyUI 服务");
    });
});

describe("formatNodeLoadingText", () => {
    it("prioritizes network retry text when present", () => {
        expect(formatNodeLoadingText({ networkRetryText: "服务重连中 (2/5)...", queuePosition: 3 })).toBe("服务重连中 (2/5)...");
    });

    it("formats queue position when in queue", () => {
        expect(formatNodeLoadingText({ queuePosition: 4 })).toBe("排队中 (第 4 位)");
    });
});

describe("updateNodeGenerationProgress", () => {
    it("updates target node progress status and transient fields", () => {
        const node = makeNode(CanvasNodeType.Image, { status: "loading" }, "node-1");
        const updated1 = updateNodeGenerationProgress([node], "node-1", "pending", { queuePosition: 2 });
        expect(updated1[0].metadata?.queuePosition).toBe(2);

        const updated2 = updateNodeGenerationProgress(updated1, "node-1", "network_retry", { message: "重连中 (1/5)..." });
        expect(updated2[0].metadata?.networkRetryText).toBe("重连中 (1/5)...");

        const updated3 = updateNodeGenerationProgress(updated2, "node-1", "running");
        expect(updated3[0].metadata?.queuePosition).toBeUndefined();
        expect(updated3[0].metadata?.networkRetryText).toBeUndefined();
    });

    it("updates target slot image within batch node", () => {
        const node = makeNode(CanvasNodeType.Image, {
            status: "loading",
            images: [
                { id: "img-1", status: "loading", content: "", storageKey: "", naturalWidth: 100, naturalHeight: 100, bytes: 0, mimeType: "image/png" },
            ],
        }, "node-batch");

        const updated = updateNodeGenerationProgress([node], "node-batch", "network_retry", { message: "重连 (1/5)..." }, "img-1");
        expect(updated[0].metadata?.images?.[0].networkRetryText).toBe("重连 (1/5)...");
    });

    it("syncs jobId across node metadata and images when imageId is not specified", () => {
        const node = makeNode(CanvasNodeType.Image, {
            status: "loading",
            images: [
                { id: "img-1", status: "loading", content: "", storageKey: "", naturalWidth: 100, naturalHeight: 100, bytes: 0, mimeType: "image/png" },
            ],
        }, "node-single");

        const updated = updateNodeGenerationProgress([node], "node-single", "submitted", { jobId: "job-123" });
        expect(updated[0].metadata?.jobId).toBe("job-123");
        expect(updated[0].metadata?.images?.[0].jobId).toBe("job-123");
    });
});

describe("resetInterruptedGeneration with jobId persistence", () => {
    it("inherits root jobId to interrupted images if image jobId was missing", () => {
        const node = makeNode(CanvasNodeType.Image, {
            status: "loading",
            jobId: "job-456",
            images: [
                { id: "img-1", status: "loading", content: "", storageKey: "", naturalWidth: 100, naturalHeight: 100, bytes: 0, mimeType: "image/png" },
            ],
        }, "node-interrupted");

        const [reset] = resetInterruptedGeneration([node]);
        expect(reset.metadata?.status).toBe("error");
        expect(reset.metadata?.jobId).toBe("job-456");
        expect(reset.metadata?.images?.[0].jobId).toBe("job-456");
    });
});



