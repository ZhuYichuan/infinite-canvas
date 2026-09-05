// _meta.title binding: scan workflow for nodes by title, resolve input slot, apply values.

import type { Workflow, WorkflowNode } from "./types.ts";

/**
 * For each title category, a map from `class_type` to the input slot name.
 * If a class is not in the map, the bound node is reported as `ignored`.
 */
export const TITLE_TO_INPUT_SLOT: Record<string, Record<string, string>> = {
    prompt: {
        CLIPTextEncode: "text",
        PrimitiveStringMultiline: "value",
        PrimitiveString: "value",
        TextEncodeBooguEdit: "prompt",
        TextEncodeQwenImageEditPlus: "prompt",
    },
    width: {
        PrimitiveInt: "value",
        PrimitiveFloat: "value",
    },
    height: {
        PrimitiveInt: "value",
        PrimitiveFloat: "value",
    },
    seed: {
        KSampler: "seed",
        KSamplerAdvanced: "noise_seed",
        PrimitiveInt: "value",
        PrimitiveFloat: "value",
    },
    ref_image: {
        LoadImage: "image",
        LoadImageMask: "image",
    },
    // Reserved for future phases (not used in image-class workflows today).
    ref_video: {
        LoadVideo: "video",
        VHS_LoadVideo: "video",
    },
    ref_audio: {
        LoadAudio: "audio",
    },
};

/** A binding: which node, which input slot, what value to write. */
export type Binding = { id: string; inputSlot: string; value: string | number | object };

/** A node found by its `_meta.title`. */
export type FoundNode = {
    id: string;
    class_type: string;
    inputSlot: string | null;
    title: string;
    ignored: boolean;
    ignoreReason?: string;
};

const REF_IMAGE_RE = /^ref_image_(0[1-9])$/;

/**
 * Find all nodes in the workflow whose `_meta.title` matches the given category
 * (e.g. "prompt", "width", "ref_image"). Returns nodes sorted by their numeric suffix
 * for ref_*_NN; for non-numeric titles, sort by their order in the workflow.
 */
export function findNodes(workflow: Workflow, category: keyof typeof TITLE_TO_INPUT_SLOT): FoundNode[] {
    const slotMap = TITLE_TO_INPUT_SLOT[category];
    const matches: FoundNode[] = [];
    for (const [id, node] of Object.entries(workflow)) {
        const title = node._meta?.title;
        if (typeof title !== "string") continue;
        if (category === "prompt") {
            if (title === "prompt") {
                const inputSlot = slotMap[node.class_type] ?? null;
                matches.push({
                    id,
                    class_type: node.class_type,
                    inputSlot,
                    title,
                    ignored: inputSlot === null,
                    ignoreReason: inputSlot === null ? `class_unknown:${node.class_type}` : undefined,
                });
            }
        } else if (category === "width" || category === "height") {
            if (title === category) {
                const inputSlot = slotMap[node.class_type] ?? null;
                matches.push({
                    id,
                    class_type: node.class_type,
                    inputSlot,
                    title,
                    ignored: inputSlot === null,
                    ignoreReason: inputSlot === null ? `class_unknown:${node.class_type}` : undefined,
                });
            }
        } else if (category === "ref_image") {
            const m = REF_IMAGE_RE.exec(title);
            if (m) {
                const inputSlot = slotMap[node.class_type] ?? null;
                matches.push({
                    id,
                    class_type: node.class_type,
                    inputSlot,
                    title,
                    ignored: inputSlot === null,
                    ignoreReason: inputSlot === null ? `class_unknown:${node.class_type}` : undefined,
                });
            }
        } else if (category === "ref_video") {
            const m = REF_IMAGE_RE.exec(title.replace(/^ref_video_/, "ref_image_"));
            if (title.startsWith("ref_video_") && m) {
                const inputSlot = slotMap[node.class_type] ?? null;
                matches.push({
                    id,
                    class_type: node.class_type,
                    inputSlot,
                    title,
                    ignored: inputSlot === null,
                    ignoreReason: inputSlot === null ? `class_unknown:${node.class_type}` : undefined,
                });
            }
        } else if (category === "ref_audio") {
            if (title.startsWith("ref_audio_") && REF_IMAGE_RE.test(title.replace(/^ref_audio_/, "ref_image_"))) {
                const inputSlot = slotMap[node.class_type] ?? null;
                matches.push({
                    id,
                    class_type: node.class_type,
                    inputSlot,
                    title,
                    ignored: inputSlot === null,
                    ignoreReason: inputSlot === null ? `class_unknown:${node.class_type}` : undefined,
                });
            }
        }
    }
    // Sort: for ref_*_NN, sort by numeric suffix ascending; for plain titles, preserve order.
    matches.sort((a, b) => {
        const an = numericSuffix(a.title);
        const bn = numericSuffix(b.title);
        if (an !== null && bn !== null) return an - bn;
        if (an !== null) return -1;
        if (bn !== null) return 1;
        return 0;
    });
    return matches;
}

function numericSuffix(title: string): number | null {
    const m = /_(0[1-9])$/.exec(title);
    return m ? Number(m[1]) : null;
}

/** Returns the error string if required nodes are missing, or null if OK. */
export function checkRequired(
    workflow: Workflow,
    needs: { prompt: boolean; width: boolean; height: boolean; refImages: number },
): string | null {
    if (needs.prompt && findNodes(workflow, "prompt").filter((n) => !n.ignored).length === 0) {
        return "工作流缺少 _meta.title=\"prompt\" 节点";
    }
    if (needs.width && findNodes(workflow, "width").filter((n) => !n.ignored).length === 0) {
        return "工作流缺少 _meta.title=\"width\" 节点";
    }
    if (needs.height && findNodes(workflow, "height").filter((n) => !n.ignored).length === 0) {
        return "工作流缺少 _meta.title=\"height\" 节点";
    }
    if (needs.refImages > 0 && findNodes(workflow, "ref_image").filter((n) => !n.ignored).length < needs.refImages) {
        return `工作流需要 ${needs.refImages} 张参考图（_meta.title="ref_image_01.."），但只识别到 ${findNodes(workflow, "ref_image").filter((n) => !n.ignored).length} 张`;
    }
    return null;
}

/** Apply bindings to the workflow, returning a new (deep-cloned) workflow. */
export function applyBindings(workflow: Workflow, bindings: Binding[]): Workflow {
    const cloned: Workflow = {};
    for (const [id, node] of Object.entries(workflow)) {
        cloned[id] = {
            class_type: node.class_type,
            inputs: { ...node.inputs },
            ...(node._meta ? { _meta: { ...node._meta } } : {}),
        };
    }
    for (const b of bindings) {
        const node = cloned[b.id];
        if (!node) continue;
        const value = typeof b.value === "object" ? JSON.stringify(b.value) : b.value;
        node.inputs[b.inputSlot] = value;
    }
    return cloned;
}