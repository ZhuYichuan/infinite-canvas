import { describe, expect, it } from "vitest";
import { TaskExecutionError, isTaskRetryable } from "../errors";
import type { TaskSnapshot, TaskArtifact } from "../types";

describe("Task Types and Domain Errors", () => {
    it("creates TaskExecutionError with correct properties and default retryability", () => {
        const netErr = new TaskExecutionError("连接中断", "network", { jobId: "job-1" });
        expect(netErr.category).toBe("network");
        expect(netErr.isRetryable).toBe(true);
        expect(netErr.jobId).toBe("job-1");
        expect(isTaskRetryable(netErr)).toBe(true);

        const timeoutErr = new TaskExecutionError("任务超时", "timeout");
        expect(timeoutErr.isRetryable).toBe(true);
        expect(isTaskRetryable(timeoutErr)).toBe(true);

        const cancelErr = new TaskExecutionError("已取消", "cancelled");
        expect(cancelErr.isRetryable).toBe(false);
        expect(isTaskRetryable(cancelErr)).toBe(false);

        const lostErr = new TaskExecutionError("任务丢失", "lost");
        expect(lostErr.isRetryable).toBe(false);
        expect(isTaskRetryable(lostErr)).toBe(false);

        const failedErr = new TaskExecutionError("执行失败", "execution_failed");
        expect(failedErr.isRetryable).toBe(false);
        expect(isTaskRetryable(failedErr)).toBe(false);

        // Custom override isRetryable
        const customRetry = new TaskExecutionError("失败可重试", "execution_failed", { isRetryable: true });
        expect(customRetry.isRetryable).toBe(true);
        expect(isTaskRetryable(customRetry)).toBe(true);
    });

    it("evaluates isTaskRetryable returns false for non-TaskExecutionError", () => {
        expect(isTaskRetryable(new Error("Generic"))).toBe(false);
        expect(isTaskRetryable(null)).toBe(false);
        expect(isTaskRetryable(undefined)).toBe(false);
        expect(isTaskRetryable("error")).toBe(false);
    });

    it("constructs type-safe TaskSnapshot and TaskArtifact structures", () => {
        const artifacts: TaskArtifact[] = [
            { type: "image", url: "http://127.0.0.1:8188/view?filename=test.png", assetId: "test.png", width: 1024, height: 1024 },
            { type: "video", url: "http://127.0.0.1:8188/view?filename=vid.mp4", duration: 5 },
            { type: "text", text: "生成的提示词文本" },
        ];

        const snapshot: TaskSnapshot = {
            jobId: "job-100",
            phase: "success",
            artifacts,
        };

        expect(snapshot.jobId).toBe("job-100");
        expect(snapshot.phase).toBe("success");
        expect(snapshot.artifacts).toHaveLength(3);
        expect(snapshot.artifacts?.[0].type).toBe("image");
        expect(snapshot.artifacts?.[2].type).toBe("text");
    });
});
