import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type ConnectionHandle } from "@/types/canvas";

export function nodeBounds(nodes: CanvasNodeData[]) {
    return nodes.reduce(
        (acc, node) => ({
            left: Math.min(acc.left, node.position.x),
            top: Math.min(acc.top, node.position.y),
            right: Math.max(acc.right, node.position.x + node.width),
            bottom: Math.max(acc.bottom, node.position.y + node.height),
        }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
}

export function findGroupDropTarget(movedIds: Set<string>, nodes: CanvasNodeData[]) {
    if (nodes.some((node) => movedIds.has(node.id) && node.type === CanvasNodeType.Group)) return null;
    const movingNodes = nodes.filter((node) => movedIds.has(node.id) && node.type !== CanvasNodeType.Group);
    if (!movingNodes.length) return null;
    return (
        [...nodes].reverse().find((group) => {
            if (group.type !== CanvasNodeType.Group || movedIds.has(group.id)) return false;
            return movingNodes.some((node) => {
                const centerX = node.position.x + node.width / 2;
                const centerY = node.position.y + node.height / 2;
                return centerX >= group.position.x && centerX <= group.position.x + group.width && centerY >= group.position.y && centerY <= group.position.y + group.height;
            });
        }) || null
    );
}

export function snapNodesIntoGroup(movedIds: Set<string>, nodes: CanvasNodeData[], group: CanvasNodeData) {
    const movingNodes = nodes.filter((node) => movedIds.has(node.id) && node.type !== CanvasNodeType.Group);
    if (!movingNodes.length) return nodes;
    const pad = 24;
    const bounds = nodeBounds(movingNodes);
    const left = group.position.x + pad;
    const top = group.position.y + pad;
    const right = group.position.x + group.width - pad;
    const bottom = group.position.y + group.height - pad;
    const dx = bounds.right - bounds.left > right - left ? left - bounds.left : bounds.left < left ? left - bounds.left : bounds.right > right ? right - bounds.right : 0;
    const dy = bounds.bottom - bounds.top > bottom - top ? top - bounds.top : bounds.top < top ? top - bounds.top : bounds.bottom > bottom ? bottom - bounds.bottom : 0;
    return nodes.map((node) => {
        if (!movedIds.has(node.id) || node.type === CanvasNodeType.Group) return node;
        return { ...node, position: { x: node.position.x + dx, y: node.position.y + dy }, metadata: { ...node.metadata, groupId: group.id } };
    });
}

export function findContainingGroupId(node: CanvasNodeData, nodes: CanvasNodeData[]) {
    const centerX = node.position.x + node.width / 2;
    const centerY = node.position.y + node.height / 2;
    return (
        [...nodes]
            .reverse()
            .find((group) => group.type === CanvasNodeType.Group && group.id !== node.id && centerX >= group.position.x && centerX <= group.position.x + group.width && centerY >= group.position.y && centerY <= group.position.y + group.height)?.id ||
        undefined
    );
}

export function getConnectionTargetAnchor(node: CanvasNodeData, current: ConnectionHandle) {
    return {
        x: current.handleType === "source" ? node.position.x : node.position.x + node.width,
        y: node.position.y + node.height / 2,
    };
}

export function validateInputConnection(
    fromNodeId: string,
    toNodeId: string,
    nodes: CanvasNodeData[],
    connections: CanvasConnection[] = [],
): { fromNodeId: string; toNodeId: string } | null {
    const fromNode = nodes.find((node) => node.id === fromNodeId);
    const toNode = nodes.find((node) => node.id === toNodeId);
    if (!fromNode || !toNode) return null;
    if (fromNodeId === toNodeId) return null;
    if (toNode.type === CanvasNodeType.Group) return null;
    if (fromNode.type === CanvasNodeType.Config) return null;
    if (connections.some((connection) => connection.fromNodeId === fromNodeId && connection.toNodeId === toNodeId)) return null;
    return { fromNodeId, toNodeId };
}

export function normalizeConnection(
    firstNodeId: string,
    secondNodeId: string,
    nodes: CanvasNodeData[],
    firstHandleType: "source" | "target",
    connections: CanvasConnection[] = [],
) {
    const first = nodes.find((node) => node.id === firstNodeId);
    const second = nodes.find((node) => node.id === secondNodeId);
    if (!first || !second) return null;
    const [fromNodeId, toNodeId] =
        first.type === CanvasNodeType.Config && firstHandleType === "target"
            ? [second.id, first.id]
            : [first.id, second.id];
    return validateInputConnection(fromNodeId, toNodeId, nodes, connections);
}

/**
 * 检查节点是否与指定的组相交或被其包含（判定标准：节点中心落在组内）
 */
export function isNodeEnclosedInGroup(node: CanvasNodeData, group: CanvasNodeData): boolean {
    if (node.id === group.id || node.type === CanvasNodeType.Group) return false;
    const centerX = node.position.x + node.width / 2;
    const centerY = node.position.y + node.height / 2;
    return (
        centerX >= group.position.x &&
        centerX <= group.position.x + group.width &&
        centerY >= group.position.y &&
        centerY <= group.position.y + group.height
    );
}

/**
 * 根据一组目标节点计算包围该组节点的 Group 容器参数（带 padding）
 */
export function calculateGroupBoundsForNodes(
    nodes: CanvasNodeData[],
    padX = 36,
    padTop = 44,
    padBottom = 36,
): { x: number; y: number; width: number; height: number } {
    if (!nodes.length) {
        return { x: 0, y: 0, width: 760, height: 480 };
    }
    const bounds = nodeBounds(nodes);
    const contentW = bounds.right - bounds.left + padX * 2;
    const contentH = bounds.bottom - bounds.top + padTop + padBottom;
    const extraW = Math.max(0, 280 - contentW);
    const extraH = Math.max(0, 200 - contentH);

    return {
        x: bounds.left - padX - extraW / 2,
        y: bounds.top - padTop - extraH / 2,
        width: contentW + extraW,
        height: contentH + extraH,
    };
}

/**
 * 调整指定组节点的尺寸与位置，使其紧密自适应包裹组内所有子节点
 */
export function fitGroupToEnclosedChildren(
    groupId: string,
    nodes: CanvasNodeData[],
    padX = 36,
    padTop = 44,
    padBottom = 36,
): CanvasNodeData[] {
    const group = nodes.find((n) => n.id === groupId && n.type === CanvasNodeType.Group);
    if (!group) return nodes;
    const children = nodes.filter((n) => n.metadata?.groupId === groupId);
    if (!children.length) return nodes;

    const newBounds = calculateGroupBoundsForNodes(children, padX, padTop, padBottom);
    return nodes.map((node) => {
        if (node.id !== groupId) return node;
        return {
            ...node,
            position: { x: newBounds.x, y: newBounds.y },
            width: newBounds.width,
            height: newBounds.height,
        };
    });
}

/**
 * 一键吸附：将几何位置落在指定组内的所有非组节点归入该组
 */
export function captureEnclosedNodesIntoGroup(
    groupId: string,
    nodes: CanvasNodeData[],
): { nextNodes: CanvasNodeData[]; capturedCount: number } {
    const group = nodes.find((n) => n.id === groupId && n.type === CanvasNodeType.Group);
    if (!group) return { nextNodes: nodes, capturedCount: 0 };

    let capturedCount = 0;
    const nextNodes = nodes.map((node) => {
        if (node.type === CanvasNodeType.Group || node.id === groupId) return node;
        if (isNodeEnclosedInGroup(node, group)) {
            if (node.metadata?.groupId !== groupId) {
                capturedCount++;
                return { ...node, metadata: { ...node.metadata, groupId } };
            }
        }
        return node;
    });

    return { nextNodes, capturedCount };
}

/**
 * 解散组：删除指定组节点，并将该组内所有子节点的 groupId 清除
 */
export function ungroupCanvasGroup(groupId: string, nodes: CanvasNodeData[]): CanvasNodeData[] {
    return nodes
        .filter((node) => node.id !== groupId)
        .map((node) => {
            if (node.metadata?.groupId === groupId) {
                return { ...node, metadata: { ...node.metadata, groupId: undefined } };
            }
            return node;
        });
}

/**
 * 组发生移动或缩放后，自动同步节点所属组关系
 */
export function syncGroupMembershipAfterTransform(
    groupNodeId: string,
    nodes: CanvasNodeData[],
): CanvasNodeData[] {
    const group = nodes.find((n) => n.id === groupNodeId && n.type === CanvasNodeType.Group);
    if (!group) return nodes;

    return nodes.map((node) => {
        if (node.type === CanvasNodeType.Group) return node;
        const isInside = isNodeEnclosedInGroup(node, group);
        if (isInside) {
            if (node.metadata?.groupId !== group.id) {
                return { ...node, metadata: { ...node.metadata, groupId: group.id } };
            }
        } else if (node.metadata?.groupId === group.id) {
            // 原先属于该组但缩放或移动后脱离了该组
            const containingGroupId = findContainingGroupId(node, nodes);
            return { ...node, metadata: { ...node.metadata, groupId: containingGroupId } };
        }
        return node;
    });
}

