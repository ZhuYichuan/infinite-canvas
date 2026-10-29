import type { ModelChannel } from "@/stores/use-config-store";
import {
    cancelJob,
    pollJobRaw,
    queryComfyuiJobStatus,
    type PollJobResult,
} from "../../comfyui";
import { TaskExecutionError } from "../errors";
import type {
    TaskArtifact,
    TaskLifecycleDriver,
    TaskNetworkRetryInfo,
    TaskPhase,
    TaskPollOptions,
    TaskQueryOptions,
    TaskSnapshot,
} from "../types";

/**
 * 将 ComfyUI 的 outputs 转换为统一的多模态产物 TaskArtifact
 */
export function mapComfyOutputsToArtifacts(
    outputs: PollJobResult["outputs"] | undefined,
    baseUrl: string,
): TaskArtifact[] {
    if (!outputs || !Array.isArray(outputs)) return [];
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

    return outputs.map((out): TaskArtifact => {
        if (out.text !== undefined && out.text !== null) {
            return {
                type: "text",
                text: out.text,
            };
        }

        const isVideo =
            out.type === "video" ||
            Boolean(out.content_type?.startsWith("video/")) ||
            /\.(mp4|webm|mov|avi|mkv)$/i.test(out.filename || "");

        const isAudio =
            out.type === "audio" ||
            Boolean(out.content_type?.startsWith("audio/")) ||
            /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(out.filename || "");

        let url = out.url || "";
        if (!url) {
            if (out.id?.startsWith("http://") || out.id?.startsWith("https://")) {
                url = out.id;
            } else if (out.id?.startsWith("/view?") || out.id?.startsWith("/api/view?")) {
                url = `${normalizedBaseUrl}${out.id}`;
            } else if (out.filename) {
                const subfolder = out.subfolder || "";
                const itemType = out.output_type || (out.type === "video" || out.type === "audio" ? "output" : out.type) || "output";
                url = `${normalizedBaseUrl}/view?filename=${encodeURIComponent(out.filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(itemType)}`;
            } else {
                url = out.id || "";
            }
        }

        const assetId = out.filename || out.id;

        if (isVideo) {
            return {
                type: "video",
                url,
                assetId,
            };
        }

        if (isAudio) {
            return {
                type: "audio",
                url,
                assetId,
            };
        }

        return {
            type: "image",
            url,
            assetId,
        };
    });
}

/**
 * 将 ComfyUI 底层异常规范映射为领域异常 TaskExecutionError
 */
export function mapComfyErrorToTaskError(error: unknown, jobId: string): TaskExecutionError {
    if (error instanceof TaskExecutionError) {
        return error;
    }

    const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name?: unknown }).name) : "";
    const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "未知错误";

    if (name === "ComfyuiNetworkError" || name === "ComfyuiMixedContentError") {
        return new TaskExecutionError(msg, "network", { jobId, causeError: error, isRetryable: true });
    }
    if (name === "ComfyuiTimeoutError") {
        return new TaskExecutionError(msg, "timeout", { jobId, causeError: error, isRetryable: true });
    }
    if (name === "ComfyuiJobCancelledError" || name === "ComfyuiAbortedError") {
        return new TaskExecutionError(msg, "cancelled", { jobId, causeError: error, isRetryable: false });
    }
    if (name === "ComfyuiJobLostError" || name === "ComfyuiJobNotFoundError") {
        return new TaskExecutionError(msg, "lost", { jobId, causeError: error, isRetryable: false });
    }
    if (name === "ComfyuiJobError") {
        return new TaskExecutionError(msg, "execution_failed", { jobId, causeError: error, isRetryable: false });
    }

    // 针对字符串信息的兜底推断
    if (msg.includes("已取消") || msg.toLowerCase().includes("cancelled") || msg.includes("execution_interrupted")) {
        return new TaskExecutionError(msg, "cancelled", { jobId, causeError: error, isRetryable: false });
    }
    if (msg.toLowerCase().includes("timeout") || msg.includes("超时")) {
        return new TaskExecutionError(msg, "timeout", { jobId, causeError: error, isRetryable: true });
    }
    if (msg.includes("丢失") || msg.includes("不存在") || msg.toLowerCase().includes("job lost") || msg.toLowerCase().includes("not found")) {
        return new TaskExecutionError(msg, "lost", { jobId, causeError: error, isRetryable: false });
    }
    if (
        msg.includes("无法连接 ComfyUI") ||
        msg.includes("本地网络连接已断开") ||
        msg.includes("Failed to fetch") ||
        msg.includes("Load failed") ||
        msg.includes("NetworkError") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("MixedContent")
    ) {
        return new TaskExecutionError(msg, "network", { jobId, causeError: error, isRetryable: true });
    }

    return new TaskExecutionError(msg, "execution_failed", { jobId, causeError: error, isRetryable: false });
}

export class ComfyuiTaskDriver implements TaskLifecycleDriver {
    readonly protocol = "comfyui";

    async queryStatus(
        jobId: string,
        channel: ModelChannel,
        options?: TaskQueryOptions,
    ): Promise<TaskSnapshot> {
        const baseUrl = channel.baseUrl;
        const token = channel.apiKey;

        try {
            const result = await queryComfyuiJobStatus(jobId, baseUrl, token, options);
            let phase: TaskPhase;
            let artifacts: TaskArtifact[] | undefined;
            let error: string | undefined;

            switch (result.status) {
                case "pending":
                    phase = "pending";
                    break;
                case "running":
                    phase = "running";
                    break;
                case "success":
                    phase = "success";
                    artifacts = mapComfyOutputsToArtifacts(result.outputs, baseUrl);
                    break;
                case "cancelled":
                    phase = "cancelled";
                    break;
                case "error":
                    phase = "error";
                    error = result.error;
                    break;
                case "lost":
                case "not_found":
                default:
                    phase = "lost";
                    break;
            }

            return {
                jobId,
                phase,
                queuePosition: result.queuePosition,
                error,
                artifacts,
                raw: result,
            };
        } catch (err) {
            throw mapComfyErrorToTaskError(err, jobId);
        }
    }

    async poll(
        jobId: string,
        channel: ModelChannel,
        options?: TaskPollOptions,
    ): Promise<TaskSnapshot> {
        const baseUrl = channel.baseUrl;
        const token = channel.apiKey;

        const onProgressBridge = (status: string, detail?: Record<string, unknown>) => {
            if (!options?.onProgress) return;

            if (status === "network_retry") {
                const retryInfo: TaskNetworkRetryInfo = {
                    count: typeof detail?.retryCount === "number" ? detail.retryCount : 1,
                    maxRetries: typeof detail?.maxRetries === "number" ? detail.maxRetries : 5,
                    baseUrl: typeof detail?.baseUrl === "string" ? detail.baseUrl : baseUrl,
                    message: typeof detail?.message === "string" ? detail.message : undefined,
                };
                options.onProgress({
                    jobId,
                    phase: "running",
                    networkRetry: retryInfo,
                    raw: detail,
                });
                return;
            }

            if (status === "pending") {
                const queuePosition = typeof detail?.queuePosition === "number" ? detail.queuePosition : undefined;
                options.onProgress({
                    jobId,
                    phase: "pending",
                    queuePosition,
                    raw: detail,
                });
                return;
            }

            if (status === "running") {
                options.onProgress({
                    jobId,
                    phase: "running",
                    raw: detail,
                });
                return;
            }

            options.onProgress({
                jobId,
                phase: "running",
                raw: detail,
            });
        };

        try {
            if (options?.signal?.aborted) {
                throw new TaskExecutionError("任务已被中断取消", "cancelled", { jobId });
            }

            const res = await pollJobRaw(
                jobId,
                baseUrl,
                token,
                options?.signal,
                options?.deadlineMs,
                options?.onProgress ? onProgressBridge : undefined,
            );

            if (options?.signal?.aborted) {
                throw new TaskExecutionError("任务已被中断取消", "cancelled", { jobId });
            }

            if (!res) {
                throw new TaskExecutionError("任务轮询未返回结果", "execution_failed", { jobId });
            }

            const artifacts = mapComfyOutputsToArtifacts(res.outputs, baseUrl);

            return {
                jobId,
                phase: "success",
                artifacts,
                raw: res.job,
            };
        } catch (err) {
            throw mapComfyErrorToTaskError(err, jobId);
        }
    }

    async cancel(jobId: string, channel: ModelChannel): Promise<void> {
        await cancelJob(jobId, channel.baseUrl, channel.apiKey);
    }
}

export const comfyuiTaskDriver = new ComfyuiTaskDriver();
