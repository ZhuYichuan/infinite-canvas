// Public types for the comfyui-task library + CLI.

/** ComfyUI API-format workflow: { "<nodeId>": { class_type, inputs, _meta? } }. */
export type Workflow = Record<string, WorkflowNode>;
export type WorkflowNode = {
    class_type: string;
    inputs: Record<string, unknown>;
    _meta?: { title?: string };
};

/** One of three reference image sources. */
export type ReferenceInput =
    | { kind: "path"; value: string }
    | { kind: "url"; value: string }
    | { kind: "data"; value: string };

/** Caller-side options for a single workflow run. */
export interface RunOptions {
    /** Proxy base URL. Default: http://127.0.0.1:8189. */
    baseUrl?: string;
    /** Optional bearer token. Falls back to env COMFY_PROXY_TOKEN. */
    token?: string;
    /** Prompt text (injected into the node with title "prompt"). */
    prompt: string;
    /** Image width (injected into the node with title "width"). */
    width?: number;
    /** Image height (injected into the node with title "height"). */
    height?: number;
    /** Reference images, in order. Up to 9. */
    refImages?: ReferenceInput[];
    /** Output capability — drives default timeout (image=30m, video=6h). Default: "image". */
    outputCap?: "image" | "video";
    /** Override default timeout (ms). */
    timeoutMs?: number;
    /** Abort the run (e.g. from web's AbortController). */
    signal?: AbortSignal;
    /** Status callback for the CLI / web. */
    onProgress?: (status: string, detail?: Record<string, unknown>) => void;
}

/** A single output asset downloaded from the proxy. */
export interface RunOutput {
    /** Proxy node_id (e.g. "9"). */
    node_id: string;
    /** File name proxy suggested (e.g. "ComfyUI_00001_.png"). */
    name: string;
    /** MIME type (e.g. "image/png"). */
    content_type: string;
    /** Downloaded bytes. */
    bytes: Blob;
    /** Convenience: name as a saveable relative path. */
    suggestedPath: string;
}

/** Returned from a successful run. */
export interface RunResult {
    jobId: string;
    jobStatus: "succeeded" | "failed" | "cancelled";
    outputs: RunOutput[];
}

/** stdin payload — auto-detected: wrapper form if `workflow` key present. */
export type StdinInput = Workflow | { workflow: Workflow; outputCap?: "image" | "video" };