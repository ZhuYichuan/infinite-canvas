import type { AiTextMessage } from "@/services/api/image";
import i18n from "@/i18n";
import { imageReferenceLabel } from "@/lib/image-reference-prompt";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";
import { CanvasNodeType, type CanvasConnection, type CanvasGenerationReferenceSnapshot, type CanvasNodeData } from "@/types/canvas";
import { getGenerationResourceNodes, getGroupResourceNodes } from "@/lib/canvas/canvas-resource-references";
import { getNodeDefinition } from "@/lib/canvas/node-registry";

export type NodeGenerationContext = {
    prompt: string;
    generationReferences: CanvasGenerationReferenceSnapshot[];
    referenceImages: ReferenceImage[];
    referenceVideos: ReferenceVideo[];
    referenceAudios: ReferenceAudio[];
    textCount: number;
    imageCount: number;
    videoCount: number;
    audioCount: number;
};

type NodeGenerationResourceInput = {
    nodeId: string;
    type: "text" | "image" | "video" | "audio";
    title: string;
    text?: string;
    image?: ReferenceImage;
    video?: ReferenceVideo;
    audio?: ReferenceAudio;
};

type NodeGenerationGroupInput = {
    nodeId: string;
    type: "group";
    title: string;
    children: NodeGenerationResourceInput[];
};

export type NodeGenerationInput = NodeGenerationResourceInput | NodeGenerationGroupInput;

export function buildNodeGenerationContext(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[], prompt: string): NodeGenerationContext {
    const inputs = buildNodeGenerationInputs(nodeId, nodes, connections);
    const sourceNode = nodes.find((node) => node.id === nodeId);
    if (sourceNode?.type === CanvasNodeType.Config && Boolean(sourceNode.metadata?.composerContent?.trim())) {
        return buildComposerGenerationContext(inputs, nodes, prompt);
    }

    const resourceInputs = flattenGenerationInputs(inputs);
    const referenceImages = resourceInputs.map((input) => input.image).filter((image): image is ReferenceImage => Boolean(image));
    const referenceVideos = resourceInputs.map((input) => input.video).filter((video): video is ReferenceVideo => Boolean(video));
    const referenceAudios = resourceInputs.map((input) => input.audio).filter((audio): audio is ReferenceAudio => Boolean(audio));
    const generationReferences = snapshotGenerationInputs(resourceInputs);

    const inputByNodeId = new Map(inputs.map((input) => [input.nodeId, input]));
    const resourceByNodeId = new Map(resourceInputs.map((resource) => [resource.nodeId, resource]));
    const nodeTitleById = new Map(nodes.map((node) => [node.id, node.title]));
    const consumedTextNodeIds = new Set<string>();
    const mediaLabelByNodeId = new Map<string, string>();

    const cleanPrompt = prompt.trim();
    let lastIndex = 0;
    let nextPrompt = "";

    for (const match of cleanPrompt.matchAll(/@\[node:([^\]]+)\]/g)) {
        if (match.index === undefined) continue;
        nextPrompt += cleanPrompt.slice(lastIndex, match.index);
        lastIndex = match.index + match[0].length;

        const refNodeId = match[1];
        const input = inputByNodeId.get(refNodeId) ?? resourceByNodeId.get(refNodeId);
        if (!input) {
            throw new Error(i18n.t("agent.composer.mentions.resourceMissing", { title: nodeTitleById.get(refNodeId) || refNodeId }));
        }

        const resources = flattenGenerationInputs([input]);
        const replacements: string[] = [];
        resources.forEach((resource) => {
            if (resource.type === "text") {
                const textContent = (resource.text || "").trim();
                consumedTextNodeIds.add(resource.nodeId);
                if (textContent) replacements.push(textContent);
            } else {
                let label = mediaLabelByNodeId.get(resource.nodeId);
                if (!label) {
                    label = resolveMediaLabel(resource, resourceInputs);
                    mediaLabelByNodeId.set(resource.nodeId, label);
                }
                replacements.push(label);
            }
        });
        nextPrompt += replacements.join("、");
    }

    nextPrompt += cleanPrompt.slice(lastIndex);
    const resolvedPrompt = nextPrompt.trim();

    const textResources = resourceInputs.filter((input) => input.type === "text" && Boolean(input.text));
    const unconsumedTexts = textResources
        .filter((textRes) => !consumedTextNodeIds.has(textRes.nodeId))
        .map((textRes) => (textRes.text || "").trim())
        .filter(Boolean);

    const textsToAppend = unconsumedTexts.filter((txt) => !resolvedPrompt.includes(txt));
    let finalPrompt = resolvedPrompt;
    if (!resolvedPrompt) {
        finalPrompt = unconsumedTexts.join("\n\n");
    } else if (textsToAppend.length > 0) {
        finalPrompt = `${resolvedPrompt}\n\n${textsToAppend.join("\n\n")}`;
    }

    return {
        prompt: finalPrompt.trim(),
        generationReferences,
        referenceImages,
        referenceVideos,
        referenceAudios,
        textCount: textResources.length,
        imageCount: referenceImages.length,
        videoCount: referenceVideos.length,
        audioCount: referenceAudios.length,
    };
}

function buildComposerGenerationContext(inputs: NodeGenerationInput[], nodes: CanvasNodeData[], prompt: string): NodeGenerationContext {
    const inputByNodeId = new Map(inputs.map((input) => [input.nodeId, input]));
    const nodeTitleById = new Map(nodes.map((node) => [node.id, node.title]));
    const selectedInputs: NodeGenerationResourceInput[] = [];
    const snapshotInputs = new Map<string, NodeGenerationResourceInput>();
    const labelByNodeId = new Map<string, string>();
    const counts = { image: 0, video: 0, audio: 0, text: 0 };
    let hasToken = false;
    let lastIndex = 0;
    let nextPrompt = "";

    for (const match of prompt.matchAll(/@\[node:([^\]]+)\]/g)) {
        if (match.index === undefined) continue;
        hasToken = true;
        nextPrompt += prompt.slice(lastIndex, match.index);
        const input = inputByNodeId.get(match[1]);
        if (!input) {
            throw new Error(i18n.t("agent.composer.mentions.resourceMissing", { title: nodeTitleById.get(match[1]) || match[1] }));
        }
        const resources = flattenGenerationInputs([input]);
        resources.forEach((resource) => {
            if (!snapshotInputs.has(resource.nodeId)) snapshotInputs.set(resource.nodeId, resource);
        });
        const labels = resources.map((resource) => {
            if (resource.type === "text") {
                counts.text++;
                return (resource.text || "").trim();
            }
            let label = labelByNodeId.get(resource.nodeId);
            if (!label) {
                label = generationLabel(resource.type, counts[resource.type]++);
                labelByNodeId.set(resource.nodeId, label);
                selectedInputs.push(resource);
            }
            return label;
        });
        nextPrompt += labels.filter(Boolean).join("、");
        lastIndex = match.index + match[0].length;
    }

    nextPrompt += prompt.slice(lastIndex);
    const referenceImages = selectedInputs.map((input) => input.image).filter((image): image is ReferenceImage => Boolean(image));
    const referenceVideos = selectedInputs.map((input) => input.video).filter((video): video is ReferenceVideo => Boolean(video));
    const referenceAudios = selectedInputs.map((input) => input.audio).filter((audio): audio is ReferenceAudio => Boolean(audio));

    if (!hasToken) {
        return {
            prompt: prompt.trim(),
            generationReferences: [],
            referenceImages: [],
            referenceVideos: [],
            referenceAudios: [],
            textCount: 0,
            imageCount: 0,
            videoCount: 0,
            audioCount: 0,
        };
    }

    return {
        prompt: nextPrompt.trim(),
        generationReferences: snapshotGenerationInputs([...snapshotInputs.values()]),
        referenceImages,
        referenceVideos,
        referenceAudios,
        textCount: counts.text,
        imageCount: referenceImages.length,
        videoCount: referenceVideos.length,
        audioCount: referenceAudios.length,
    };
}

function snapshotGenerationInputs(inputs: NodeGenerationResourceInput[]): CanvasGenerationReferenceSnapshot[] {
    return inputs.flatMap((input): CanvasGenerationReferenceSnapshot[] => {
        if (input.type === "text" && input.text !== undefined) return [{ nodeId: input.nodeId, kind: "text", text: input.text }];
        if (input.type === "image" && input.image) {
            const url = input.image.storageKey ? undefined : input.image.url || (!input.image.dataUrl.startsWith("data:") ? input.image.dataUrl : undefined);
            return [{ nodeId: input.nodeId, kind: "image", storageKey: input.image.storageKey, url, mimeType: input.image.type }];
        }
        if (input.type === "video" && input.video) {
            return [{ nodeId: input.nodeId, kind: "video", storageKey: input.video.storageKey, url: input.video.storageKey ? undefined : input.video.url, mimeType: input.video.type }];
        }
        if (input.type === "audio" && input.audio) {
            return [{ nodeId: input.nodeId, kind: "audio", storageKey: input.audio.storageKey, url: input.audio.storageKey ? undefined : input.audio.url, mimeType: input.audio.type }];
        }
        return [];
    });
}

export function buildNodeGenerationInputs(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]): NodeGenerationInput[] {
    return getGenerationResourceNodes(nodeId, nodes, connections).flatMap((node): NodeGenerationInput[] => {
        if (node.type === CanvasNodeType.Group) {
            const children = getGroupResourceNodes(node.id, nodes).flatMap(readNodeGenerationResource);
            return children.length ? [{ nodeId: node.id, type: "group", title: node.title, children }] : [];
        }
        return readNodeGenerationResource(node);
    });
}

function flattenGenerationInputs(inputs: NodeGenerationInput[]) {
    const resources = inputs.flatMap((input) => (input.type === "group" ? input.children : [input]));
    return [...new Map(resources.map((input) => [input.nodeId, input])).values()];
}

function resolveMediaLabel(resource: NodeGenerationResourceInput, resourceInputs: NodeGenerationResourceInput[]): string {
    if (resource.type === "text") return "";
    const index = resourceInputs.filter((input) => input.type === resource.type).findIndex((input) => input.nodeId === resource.nodeId);
    return generationLabel(resource.type, index);
}

function readNodeGenerationResource(node: CanvasNodeData): NodeGenerationResourceInput[] {
    const image = readReferenceImage(node);
    if (image) return [{ nodeId: node.id, type: "image", title: node.title, image }];
    const video = readReferenceVideo(node);
    if (video) return [{ nodeId: node.id, type: "video", title: node.title, video }];
    const audio = readReferenceAudio(node);
    if (audio) return [{ nodeId: node.id, type: "audio", title: node.title, audio }];
    const resource = getNodeDefinition(node.type)?.resource?.(node);
    if (resource?.kind === "image" && resource.url) return [{ nodeId: node.id, type: "image", title: node.title, image: { id: node.id, name: `${node.title || node.id}.png`, type: node.metadata?.mimeType || "image/png", dataUrl: resource.url, storageKey: node.metadata?.storageKey } }];
    if (resource?.kind === "video" && resource.url) return [{ nodeId: node.id, type: "video", title: node.title, video: { id: node.id, name: `${node.title || node.id}.mp4`, type: node.metadata?.mimeType || "video/mp4", url: resource.url, storageKey: node.metadata?.storageKey } }];
    if (resource?.kind === "audio" && resource.url) return [{ nodeId: node.id, type: "audio", title: node.title, audio: { id: node.id, name: `${node.title || node.id}.mp3`, type: node.metadata?.mimeType || "audio/mpeg", url: resource.url, storageKey: node.metadata?.storageKey } }];
    if (resource?.kind === "text" && resource.text) return [{ nodeId: node.id, type: "text", title: node.title, text: resource.text }];
    const text = readNodeTextInput(node);
    return text ? [{ nodeId: node.id, type: "text", title: node.title, text }] : [];
}

export function buildNodeResponseMessages(context: NodeGenerationContext): AiTextMessage[] {
    if (!context.referenceImages.length) {
        return [{ role: "user", content: context.prompt }];
    }

    return [
        {
            role: "user",
            content: [{ type: "text" as const, text: context.prompt }, ...context.referenceImages.map((image) => ({ type: "image_url" as const, image_url: { url: image.dataUrl } }))],
        },
    ];
}

export async function hydrateNodeGenerationContext(context: NodeGenerationContext) {
    const { imageToDataUrl } = await import("@/services/image-storage");
    return { ...context, referenceImages: await Promise.all(context.referenceImages.map(async (image) => ({ ...image, dataUrl: await imageToDataUrl(image) }))) };
}

function readNodeTextInput(node: CanvasNodeData) {
    if (node.type === CanvasNodeType.Text) return node.metadata?.content || node.metadata?.prompt || "";
    return node.metadata?.prompt || "";
}

function generationLabel(type: NodeGenerationResourceInput["type"], index: number) {
    if (type === "image") return imageReferenceLabel(index);
    if (type === "video") return i18n.t("canvas.configNode.videoReferences") + ` ${index + 1}`;
    if (type === "audio") return i18n.t("canvas.configNode.audioReferences") + ` ${index + 1}`;
    return i18n.t("canvas.composer.resources.text", { index: index + 1 });
}

function readReferenceImage(node: CanvasNodeData): ReferenceImage | null {
    if (node.type !== CanvasNodeType.Image || !node.metadata?.content) return null;
    return {
        id: node.id,
        name: `${node.title || node.id}.png`,
        type: node.metadata.mimeType || "image/png",
        dataUrl: node.metadata.content,
        storageKey: node.metadata.storageKey,
    };
}

function readReferenceVideo(node: CanvasNodeData): ReferenceVideo | null {
    if (node.type !== CanvasNodeType.Video || !node.metadata?.content) return null;
    return {
        id: node.id,
        name: `${node.title || node.id}.mp4`,
        type: node.metadata.mimeType || "video/mp4",
        url: node.metadata.content,
        storageKey: node.metadata.storageKey,
        bytes: node.metadata.bytes,
        width: node.metadata.naturalWidth,
        height: node.metadata.naturalHeight,
        durationMs: node.metadata.durationMs,
    };
}

function readReferenceAudio(node: CanvasNodeData): ReferenceAudio | null {
    if (node.type !== CanvasNodeType.Audio || !node.metadata?.content) return null;
    return {
        id: node.id,
        name: `${node.title || node.id}.mp3`,
        type: node.metadata.mimeType || "audio/mpeg",
        url: node.metadata.content,
        storageKey: node.metadata.storageKey,
        durationMs: node.metadata.durationMs,
    };
}
