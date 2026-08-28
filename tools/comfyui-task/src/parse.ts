// Stdin parser: accepts either a bare workflow JSON, or a wrapper form
// `{ workflow: <workflow>, outputCap?: "image"|"video" }`. Detected by the presence
// of a top-level `workflow` key.

import type { StdinInput, Workflow } from "./types.ts";

export interface ParsedInput {
    workflow: Workflow;
    outputCap?: "image" | "video";
}

export function parseStdin(raw: string): ParsedInput {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error("Stdin is empty");
    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch (e) {
        throw new Error(`Invalid JSON on stdin: ${(e as Error).message}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Stdin JSON must be an object (workflow or { workflow, outputCap })");
    }
    const obj = parsed as Record<string, unknown>;
    // Wrapper form: { workflow: <...>, outputCap?: <...> }
    if ("workflow" in obj && typeof obj.workflow === "object" && obj.workflow !== null && !Array.isArray(obj.workflow)) {
        const cap = obj.outputCap === "video" ? "video" : obj.outputCap === "image" ? "image" : undefined;
        return { workflow: obj.workflow as Workflow, outputCap: cap };
    }
    // Bare workflow form: { "<nodeId>": {...} }
    return { workflow: obj as Workflow };
}

/** Parse a duration string like "30m", "6h", "90s", or a raw number (ms). */
export function parseDuration(input: string): number {
    const trimmed = input.trim();
    const m = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/.exec(trimmed);
    if (!m) throw new Error(`Invalid duration: ${input}`);
    const value = Number(m[1]);
    const unit = m[2] ?? "ms";
    if (unit === "ms") return value;
    if (unit === "s") return value * 1000;
    if (unit === "m") return value * 60 * 1000;
    if (unit === "h") return value * 60 * 60 * 1000;
    throw new Error(`Invalid duration unit: ${unit}`);
}