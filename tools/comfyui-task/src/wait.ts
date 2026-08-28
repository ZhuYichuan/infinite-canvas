// Polling-based job waiter. The comfy-api-proxy also supports SSE, but for a CLI
// (short-running process, no UI progress bar), polling is simpler and reliable.

export interface JobStatusResponse {
    id: string;
    status: "queued" | "running" | "succeeded" | "failed" | "canceling" | "canceled" | "expired";
    outputs?: OutputDescriptor[];
    error?: { message?: string; type?: string };
}

export interface OutputDescriptor {
    id: string;          // asset UUID
    node_id: string;
    name: string;        // proxy-suggested file name, e.g. "ComfyUI_00001_.png"
    type: "image" | "video" | "audio" | "text" | "file" | "latent";
    content_type: string;
    size_bytes?: number;
}

/** Default timeouts per capability (image=30 min, video=6 hours). */
export const DEFAULT_TIMEOUT_MS: Record<"image" | "video", number> = {
    image: 30 * 60 * 1000,
    video: 6 * 60 * 60 * 1000,
};

/** Poll the job until terminal or timeout. Returns the final job response. */
export async function pollUntilDone(
    baseUrl: string,
    token: string | undefined,
    jobId: string,
    cap: "image" | "video",
    options: { timeoutMs?: number; signal?: AbortSignal; onProgress?: (status: string) => void; pollIntervalMs?: number } = {},
): Promise<JobStatusResponse> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS[cap];
    const pollIntervalMs = options.pollIntervalMs ?? 1500;
    const deadline = Date.now() + timeoutMs;

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let lastStatus = "queued";
    while (Date.now() < deadline) {
        if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        let res: Response;
        try {
            res = await fetch(`${baseUrl}/api/v2/jobs/${jobId}`, { headers, signal: options.signal });
        } catch (err) {
            // Transient network — keep polling.
            if (err instanceof DOMException && err.name === "AbortError") throw err;
            await sleep(pollIntervalMs, options.signal);
            continue;
        }
        if (!res.ok) {
            await sleep(pollIntervalMs, options.signal);
            continue;
        }
        const job = (await res.json()) as JobStatusResponse;
        lastStatus = job.status;
        options.onProgress?.(job.status);
        if (job.status === "succeeded" || job.status === "failed" || job.status === "canceled" || job.status === "expired") {
            return job;
        }
        await sleep(pollIntervalMs, options.signal);
    }
    throw new Error(`Polling timeout after ${timeoutMs}ms; last status: ${lastStatus}`);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        if (signal) {
            const onAbort = () => {
                clearTimeout(t);
                reject(new DOMException("Aborted", "AbortError"));
            };
            signal.addEventListener("abort", onAbort, { once: true });
        }
    });
}