import { describe, expect, it } from "vitest";
import { failCanvasGeneration, settleCanvasGeneration } from "@/lib/canvas/canvas-generation-settlement";
import { TaskExecutionError } from "@/services/api/task/errors";
import { CanvasNodeType, type CanvasNodeData, type CanvasNodeImage, type CanvasNodeMetadata, type CanvasNodeText } from "@/types/canvas";

const connectionError = "渠道「本地测试」请求 http://127.0.0.1:8188/prompt 失败：连接被拒绝";

function node(type: CanvasNodeData["type"], metadata: CanvasNodeMetadata = {}, id = "result"): CanvasNodeData {
    return { id, type, title: "test", position: { x: 0, y: 0 }, width: 100, height: 100, metadata };
}

function image(id: string, metadata: Partial<CanvasNodeImage> = {}): CanvasNodeImage {
    return { id, status: "loading", content: "", storageKey: "", naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "image/png", ...metadata };
}

function text(id: string, metadata: Partial<CanvasNodeText> = {}): CanvasNodeText {
    return { id, status: "loading", content: "", ...metadata };
}

describe("failCanvasGeneration", () => {
    it.each([CanvasNodeType.Image, CanvasNodeType.Text, CanvasNodeType.Video, CanvasNodeType.Audio, CanvasNodeType.Config])("settles an unreachable request on %s with the exact channel and endpoint error", (type) => {
        const original = node(type, { status: "loading", queuePosition: 2, networkRetryText: "重连中" });
        const [failed] = failCanvasGeneration([original], { nodeId: original.id, error: new Error(connectionError) });
        expect(failed.metadata).toMatchObject({ status: "error", errorDetails: connectionError });
        expect(failed.metadata?.jobId).toBeUndefined();
        expect(failed.metadata?.queuePosition).toBeUndefined();
        expect(failed.metadata?.networkRetryText).toBeUndefined();
        expect(original.metadata?.status).toBe("loading");
    });

    it("mirrors failure on the distinct Config origin while preserving successful media inputs", () => {
        const result = node(CanvasNodeType.Video, { status: "loading", generationOriginNodeId: "config" });
        const source = node(CanvasNodeType.Config, { status: "loading", jobId: "stale" }, "config");
        const input = node(CanvasNodeType.Image, { status: "success", content: "old.png" }, "input");
        const failed = failCanvasGeneration([result, source, input], { nodeId: result.id, sourceNodeId: source.id, error: new Error(connectionError) });
        expect(failed[1].metadata).toMatchObject({ status: "error", errorDetails: connectionError });
        expect(failed[1].metadata?.jobId).toBeUndefined();
        expect(failed[2]).toBe(input);
        const withMediaOrigin = failCanvasGeneration([result, input], { nodeId: result.id, sourceNodeId: input.id, error: new Error(connectionError) });
        expect(withMediaOrigin[1]).toBe(input);
    });

    it.each(["images", "texts"] as const)("settles the sole %s slot and carries only its accepted timeout job to the root", (key) => {
        const slots = key === "images" ? { images: [image("slot", { jobId: "accepted", queuePosition: 3, networkRetryText: "重连中" })] } : { texts: [text("slot", { jobId: "accepted", queuePosition: 3, networkRetryText: "重连中" })] };
        const result = node(key === "images" ? CanvasNodeType.Image : CanvasNodeType.Text, { status: "loading", jobId: "unrelated", ...slots });
        const [failed] = failCanvasGeneration([result], { nodeId: result.id, slotId: "slot", error: new TaskExecutionError(connectionError, "timeout") });
        expect(failed.metadata).toMatchObject({ status: "error", errorDetails: connectionError, jobId: "accepted", isTimeout: true });
        expect(failed.metadata?.[key]?.[0]).toMatchObject({ status: "error", errorDetails: connectionError, jobId: "accepted", isTimeout: true });
        expect(failed.metadata?.[key]?.[0].queuePosition).toBeUndefined();
        expect(failed.metadata?.[key]?.[0].networkRetryText).toBeUndefined();
    });

    it("does not borrow another image slot's job when an unaccepted retry fails", () => {
        const result = node(CanvasNodeType.Image, { status: "loading", jobId: "other-job", images: [image("other", { status: "error", jobId: "other-job", errorDetails: "先前失败" }), image("retry")] });
        const [failed] = failCanvasGeneration([result], { nodeId: result.id, slotId: "retry", intent: "retry", error: new TaskExecutionError(connectionError, "network") });
        expect(failed.metadata?.images?.[1].jobId).toBeUndefined();
        expect(failed.metadata?.jobId).toBeUndefined();
        expect(failed.metadata?.images?.[0]).toBe(result.metadata?.images?.[0]);
    });

    it("keeps a current accepted job from the error when the request callback has not materialized it", () => {
        const result = node(CanvasNodeType.Video, { status: "loading" });
        const [failed] = failCanvasGeneration([result], { nodeId: result.id, error: new TaskExecutionError(connectionError, "network", { jobId: "accepted" }) });
        expect(failed.metadata?.jobId).toBe("accepted");
    });

    it.each(["lost", "cancelled", "execution_failed"] as const)("clears accepted IDs on terminal %s errors even when the message mentions network or timeout", (category) => {
        const result = node(CanvasNodeType.Video, { status: "loading", jobId: "accepted" });
        const [failed] = failCanvasGeneration([result], { nodeId: result.id, intent: "resume", error: new TaskExecutionError("Failed to fetch / timeout", category, { jobId: "accepted" }) });
        expect(failed.metadata).toMatchObject({ status: "error", errorDetails: "Failed to fetch / timeout" });
        expect(failed.metadata?.jobId).toBeUndefined();
        expect(failed.metadata?.isTimeout).toBeUndefined();
    });

    it("retains a resumed job for a nonterminal untyped interruption", () => {
        const result = node(CanvasNodeType.Audio, { status: "loading", jobId: "accepted" });
        const [failed] = failCanvasGeneration([result], { nodeId: result.id, intent: "resume", error: new Error("状态查询暂时不可用") });
        expect(failed.metadata?.jobId).toBe("accepted");
    });

    it.each(["ComfyuiJobLostError", "ComfyuiJobCancelledError", "ComfyuiJobError"])("keeps terminal error names authoritative over incidental timeout text: %s", (name) => {
        const error = Object.assign(new Error("后端执行 timeout 节点失败"), { name, jobId: "accepted" });
        const result = node(CanvasNodeType.Video, { status: "loading", jobId: "accepted" });
        const [failed] = failCanvasGeneration([result], { nodeId: result.id, intent: "resume", error });
        expect(failed.metadata?.jobId).toBeUndefined();
        expect(failed.metadata?.isTimeout).toBeUndefined();
    });

    it("preserves partial streamed text and completed media when storing a failure", () => {
        const result = node(CanvasNodeType.Text, { status: "loading", content: "已经返回的部分文本", texts: [text("stream", { content: "已经返回的部分文本" })] });
        const [failed] = failCanvasGeneration([result], { nodeId: result.id, slotId: "stream", error: new Error(connectionError) });
        expect(failed.metadata).toMatchObject({ status: "error", content: "已经返回的部分文本", errorDetails: connectionError });
        expect(failed.metadata?.texts?.[0].content).toBe("已经返回的部分文本");
        const completed = node(CanvasNodeType.Image, { status: "loading", content: "old.png", images: [image("done", { status: "success", content: "old.png" })] });
        const [retryFailed] = failCanvasGeneration([completed], { nodeId: completed.id, error: new Error(connectionError) });
        expect(retryFailed.metadata).toMatchObject({ status: "error", content: "old.png", errorDetails: connectionError });
        expect(retryFailed.metadata?.images?.[0]).toBe(completed.metadata?.images?.[0]);
    });

    it("does not resurrect a previous attempt after retry has cleared the accepted ID", () => {
        const saved = node(CanvasNodeType.Video, { status: "error", jobId: "previous" });
        const retry = { ...saved, metadata: { ...saved.metadata, status: "loading" as const, jobId: undefined } };
        const [failed] = failCanvasGeneration([retry], { nodeId: saved.id, intent: "retry", error: new TaskExecutionError(connectionError, "network") });
        expect(failed.metadata?.jobId).toBeUndefined();
        expect(saved.metadata?.jobId).toBe("previous");
    });

    it("fails all pending or failed slots on a whole-root failure and preserves completed content", () => {
        const completed = image("done", { status: "success", content: "done.png", storageKey: "done" });
        const result = node(CanvasNodeType.Image, { status: "loading", images: [completed, image("pending", { jobId: "accepted" }), image("old-failure", { status: "error", errorDetails: "旧原因" })], primaryImageId: "done", content: "done.png" });
        const [failed] = failCanvasGeneration([result], { nodeId: result.id, error: new TaskExecutionError(connectionError, "network") });
        expect(failed.metadata?.images?.[0]).toBe(completed);
        expect(failed.metadata?.images?.slice(1).map((slot) => slot.status)).toEqual(["error", "error"]);
        expect(failed.metadata?.images?.[1].jobId).toBe("accepted");
        expect(failed.metadata?.images?.[2].jobId).toBeUndefined();
        expect(failed.metadata).toMatchObject({ status: "success", content: "done.png" });
        expect(failed.metadata?.errorDetails).toContain("2");
        expect(failed.metadata?.errorDetails).toContain(connectionError);
        expect(failed.metadata?.jobId).toBeUndefined();
    });

    it("does not hang all failed slots on a whole-root failure", () => {
        const result = node(CanvasNodeType.Text, { status: "loading", texts: [text("one"), text("two")] });
        const [failed] = failCanvasGeneration([result], { nodeId: result.id, error: new Error(connectionError) });
        expect(failed.metadata).toMatchObject({ status: "error", errorDetails: connectionError });
        expect(failed.metadata?.texts?.every((slot) => slot.status === "error")).toBe(true);
    });

    it("leaves a missing result or slot unchanged", () => {
        const nodes = [node(CanvasNodeType.Image, { images: [image("slot")] })];
        expect(failCanvasGeneration(nodes, { nodeId: "missing", error: new Error(connectionError) })).toBe(nodes);
        expect(failCanvasGeneration(nodes, { nodeId: "result", slotId: "missing", error: new Error(connectionError) })).toBe(nodes);
    });
});

describe("settleCanvasGeneration", () => {
    it("keeps a batch loading while another slot is active and records the first failure", () => {
        const result = node(CanvasNodeType.Image, { status: "loading", images: [image("failed", { status: "error", errorDetails: connectionError }), image("pending", { jobId: "pending-job" })] });
        const [settled] = settleCanvasGeneration([result], { nodeId: result.id });
        expect(settled.metadata?.status).toBe("loading");
        expect(settled.metadata?.errorDetails).toContain(connectionError);
        expect(settled.metadata?.jobId).toBeUndefined();
        expect(settled.metadata?.images?.[1]).toBe(result.metadata?.images?.[1]);
    });

    it.each(["images", "texts"] as const)("keeps successful %s content with a persistent partial-failure count and specific reason", (key) => {
        const slots = key === "images" ? { images: [image("failed", { status: "error", errorDetails: connectionError }), image("ok", { status: "success", content: "result", storageKey: "stored" })] } : { texts: [text("failed", { status: "error", errorDetails: connectionError }), text("ok", { status: "success", content: "result" })] };
        const result = node(key === "images" ? CanvasNodeType.Image : CanvasNodeType.Text, { status: "loading", jobId: "old", ...slots });
        const config = node(CanvasNodeType.Config, { status: "loading" }, "config");
        const settled = settleCanvasGeneration([result, config], { nodeId: result.id, sourceNodeId: config.id });
        expect(settled[0].metadata).toMatchObject({ status: "success", content: "result" });
        expect(settled[0].metadata?.errorDetails).toContain("1");
        expect(settled[0].metadata?.errorDetails).toContain(connectionError);
        expect(settled[0].metadata?.jobId).toBeUndefined();
        expect(settled[1].metadata?.status).toBe("success");
        expect(settled[1].metadata?.errorDetails).toBe(settled[0].metadata?.errorDetails);
    });

    it("uses the first exact failure when every slot failed and never exposes one batch member as the root job", () => {
        const result = node(CanvasNodeType.Text, { status: "loading", jobId: "old", texts: [text("one", { status: "error", errorDetails: connectionError, jobId: "one" }), text("two", { status: "error", errorDetails: "第二条", jobId: "two", isTimeout: true })] });
        const [settled] = settleCanvasGeneration([result], { nodeId: result.id });
        expect(settled.metadata).toMatchObject({ status: "error", errorDetails: connectionError });
        expect(settled.metadata?.jobId).toBeUndefined();
        expect(settled.metadata?.isTimeout).toBeUndefined();
    });

    it("clears a previous failure after all slots succeeded", () => {
        const result = node(CanvasNodeType.Image, { status: "error", errorDetails: connectionError, isTimeout: true, queuePosition: 2, images: [image("ok", { status: "success", content: "done.png" })] });
        const [settled] = settleCanvasGeneration([result], { nodeId: result.id });
        expect(settled.metadata).toMatchObject({ status: "success", content: "done.png", primaryImageId: "ok" });
        expect(settled.metadata?.errorDetails).toBeUndefined();
        expect(settled.metadata?.jobId).toBeUndefined();
        expect(settled.metadata?.isTimeout).toBeUndefined();
        expect(settled.metadata?.queuePosition).toBeUndefined();
    });

    it("preserves an existing successful primary image", () => {
        const result = node(CanvasNodeType.Image, { status: "loading", content: "second.png", primaryImageId: "second", images: [image("first", { status: "success", content: "first.png" }), image("second", { status: "success", content: "second.png" })] });
        const [settled] = settleCanvasGeneration([result], { nodeId: result.id });
        expect(settled.metadata).toMatchObject({ content: "second.png", primaryImageId: "second" });
    });

    it("leaves a root without batch slots unchanged", () => {
        const nodes = [node(CanvasNodeType.Video, { status: "success", content: "done.mp4" })];
        expect(settleCanvasGeneration(nodes, { nodeId: nodes[0].id })[0]).toBe(nodes[0]);
    });

    it.each([CanvasNodeType.Video, CanvasNodeType.Audio])("mirrors a successful %s result to its Config origin without moving the media content", (type) => {
        const result = node(type, { status: "success", content: "done-media" });
        const config = node(CanvasNodeType.Config, { status: "error", errorDetails: connectionError, jobId: "old-job" }, "config");
        const [settled, source] = settleCanvasGeneration([result, config], { nodeId: result.id, sourceNodeId: config.id });
        expect(settled).toBe(result);
        expect(source.metadata?.status).toBe("success");
        expect(source.metadata?.content).toBeUndefined();
        expect(source.metadata?.errorDetails).toBeUndefined();
        expect(source.metadata?.jobId).toBeUndefined();
    });
});
