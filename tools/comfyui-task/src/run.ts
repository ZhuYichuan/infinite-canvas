// runWorkflow: the public entry point. Glues parsing → binding → upload → submit → poll → download.

import type { RunOptions, RunResult, RunOutput, Workflow } from "./types.ts";
import { applyBindings, checkRequired, findNodes, type Binding } from "./binding.ts";
import { resolveReference, uploadAsset, type UploadedAsset } from "./upload.ts";
import { pollUntilDone, DEFAULT_TIMEOUT_MS, type JobStatusResponse, type OutputDescriptor } from "./wait.ts";
import { downloadAsset } from "./download.ts";

export type { RunOptions, RunResult, RunOutput, Workflow };

const DEFAULT_BASE_URL = "http://127.0.0.1:8189";

/** Main entry: submit workflow, wait for completion, download outputs. */
export async function runWorkflow(input: Workflow, options: RunOptions): Promise<RunResult> {
    const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    const token = options.token ?? process.env.COMFY_PROXY_TOKEN;
    const cap = options.outputCap ?? "image";
    const refCount = options.refImages?.length ?? 0;

    // 1. Validate required title nodes are present (and reachable by class).
    const needs = {
        prompt: !!options.prompt,
        width: typeof options.width === "number",
        height: typeof options.height === "number",
        refImages: refCount,
    };
    const error = checkRequired(input, needs);
    if (error) throw new Error(error);

    // 2. Collect bindings: prompt, width, height, ref_image_*
    const bindings: Binding[] = [];

    const promptNodes = findNodes(input, "prompt").filter((n) => !n.ignored);
    if (options.prompt && promptNodes[0]) {
        bindings.push({ id: promptNodes[0].id, inputSlot: promptNodes[0].inputSlot!, value: options.prompt });
    }

    const widthNodes = findNodes(input, "width").filter((n) => !n.ignored);
    if (typeof options.width === "number" && widthNodes[0]) {
        bindings.push({ id: widthNodes[0].id, inputSlot: widthNodes[0].inputSlot!, value: options.width });
    }

    const heightNodes = findNodes(input, "height").filter((n) => !n.ignored);
    if (typeof options.height === "number" && heightNodes[0]) {
        bindings.push({ id: heightNodes[0].id, inputSlot: heightNodes[0].inputSlot!, value: options.height });
    }

    // 3. Upload ref_images, fill bindings with AssetReference objects
    const refImageNodes = findNodes(input, "ref_image").filter((n) => !n.ignored);
    if (refImageNodes.length > 0) {
        if (!options.refImages) throw new Error("Workflow expects reference images, but none provided");
        for (let i = 0; i < refImageNodes.length; i++) {
            const node = refImageNodes[i]!;
            const ref = options.refImages[i];
            if (!ref) break;
            const resolved = await resolveReference(ref);
            options.onProgress?.("uploading", { kind: "ref_image", index: i + 1, name: resolved.file_path });
            const uploaded: UploadedAsset = await uploadAsset(baseUrl, token, resolved, options.signal);
            bindings.push({
                id: node.id,
                inputSlot: node.inputSlot!,
                value: { __type: "core/ASSET", info: { id: uploaded.id } },
            });
        }
    }

    // 4. Apply bindings
    const submitted = applyBindings(input, bindings);

    // 5. Submit job
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    options.onProgress?.("submitting");
    const submitRes = await fetch(`${baseUrl}/api/v2/jobs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ workflow: submitted }),
        signal: options.signal,
    });
    if (!submitRes.ok) {
        const detail = await submitRes.text().catch(() => "");
        throw new Error(`Job submission failed (${submitRes.status}): ${detail || submitRes.statusText}`);
    }
    const submitData = (await submitRes.json()) as { id: string };
    const jobId = submitData.id;
    options.onProgress?.("submitted", { jobId });

    // 6. Cancel handler (fire-and-forget on abort)
    if (options.signal) {
        options.signal.addEventListener(
            "abort",
            () => {
                void fetch(`${baseUrl}/api/v2/jobs/${jobId}/cancel`, {
                    method: "POST",
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                }).catch(() => undefined);
            },
            { once: true },
        );
    }

    // 7. Poll until terminal
    const finalJob = await pollUntilDone(baseUrl, token, jobId, cap, {
        timeoutMs: options.timeoutMs,
        signal: options.signal,
        onProgress: (status) => options.onProgress?.(status, { jobId }),
    });

    // 8. Handle non-success
    if (finalJob.status !== "succeeded") {
        const msg = finalJob.error?.message ?? finalJob.status;
        throw new Error(`Job ${jobId} ended in status "${finalJob.status}": ${msg}`);
    }

    // 9. Filter outputs by cap and download
    const outputs = (finalJob.outputs ?? []).filter((o) => matchesCap(o, cap));
    if (outputs.length === 0) {
        const list = (finalJob.outputs ?? []).map((o) => `${o.node_id}:${o.name}(${o.type})`).join(", ");
        throw new Error(`Job succeeded but no ${cap} outputs found. Actual: ${list}`);
    }

    const results: RunOutput[] = [];
    for (const o of outputs) {
        const dl = await downloadAsset(baseUrl, token, o.id, options.signal);
        results.push({
            node_id: o.node_id,
            name: o.name,
            content_type: o.content_type || dl.content_type,
            bytes: dl.bytes,
            suggestedPath: o.name,
        });
    }

    return { jobId, jobStatus: finalJob.status, outputs: results };
}

function matchesCap(o: OutputDescriptor, cap: "image" | "video"): boolean {
    if (o.type === cap) return true;
    if (cap === "image" && o.content_type.startsWith("image/")) return true;
    if (cap === "video" && o.content_type.startsWith("video/")) return true;
    return false;
}

// Re-export the default timeouts so consumers can read them if needed.
export { DEFAULT_TIMEOUT_MS };
export type { JobStatusResponse };