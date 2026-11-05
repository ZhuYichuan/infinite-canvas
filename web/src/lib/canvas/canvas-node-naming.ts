import { CanvasNodeType, type CanvasNodeData, type CanvasNodeTypeId } from "@/types/canvas";

export function getNodeTypePrefix(type: CanvasNodeTypeId): string {
    if (Object.values(CanvasNodeType).includes(type as CanvasNodeType)) {
        return type;
    }
    return type.replace(/^plugin:/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function generateNextNodeTitle(type: CanvasNodeTypeId, existingNodes: CanvasNodeData[]): string {
    const prefix = getNodeTypePrefix(type);
    const regex = new RegExp(`^${prefix}-(\\d+)$`);
    let maxIndex = 0;

    for (const node of existingNodes) {
        if (!node.title) continue;
        const match = node.title.match(regex);
        if (match) {
            const val = parseInt(match[1], 10);
            if (!Number.isNaN(val) && val > maxIndex) {
                maxIndex = val;
            }
        }
    }

    const nextIndex = maxIndex + 1;
    const formatted = nextIndex < 100 ? String(nextIndex).padStart(2, "0") : String(nextIndex);
    return `${prefix}-${formatted}`;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function generateDuplicateNodeTitle(sourceNode: CanvasNodeData, existingNodes: CanvasNodeData[]): string {
    const prefix = getNodeTypePrefix(sourceNode.type);
    const isDefault = new RegExp(`^${prefix}-\\d+$`).test(sourceNode.title || "");

    if (isDefault || !sourceNode.title) {
        return generateNextNodeTitle(sourceNode.type, existingNodes);
    }

    // 处理自定义名称的副本递增
    const match = sourceNode.title.match(/^(.*?)-副本(?: (\d+))?$/);
    const baseName = match ? match[1] : sourceNode.title;
    const copyRegex = new RegExp(`^${escapeRegex(baseName)}-副本(?: (\\d+))?$`);

    let maxCopyNum = 0;
    let hasPlainCopy = false;

    for (const node of existingNodes) {
        if (!node.title) continue;
        const copyMatch = node.title.match(copyRegex);
        if (copyMatch) {
            if (copyMatch[1]) {
                const num = parseInt(copyMatch[1], 10);
                if (!Number.isNaN(num) && num > maxCopyNum) {
                    maxCopyNum = num;
                }
            } else {
                hasPlainCopy = true;
                if (maxCopyNum < 1) maxCopyNum = 1;
            }
        }
    }

    if (!hasPlainCopy && maxCopyNum === 0) {
        return `${baseName}-副本`;
    }

    const nextNum = Math.max(2, maxCopyNum + 1);
    return `${baseName}-副本 ${nextNum}`;
}
