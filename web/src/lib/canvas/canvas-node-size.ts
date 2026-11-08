export const CANVAS_NODE_MAX_BOUND = 420;

export function fitNodeSize(width: number, height: number, maxWidth = 640, maxHeight = 640) {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const scale = Math.min(1, maxWidth / w, maxHeight / h);
    return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export function nodeSizeFromRatio(size?: string | null, baseWidth = CANVAS_NODE_MAX_BOUND, baseHeight = CANVAS_NODE_MAX_BOUND) {
    if (!size) return null;
    const match = size.match(/^(\d+)(?:x|:)(\d+)/);
    if (!match) return null;
    const width = Number(match[1]);
    const height = Number(match[2]);
    const ratio = width / Math.max(1, height);
    if (ratio < 0.25 || ratio > 4) return { width: baseWidth, height: baseHeight };
    return ratio >= baseWidth / baseHeight
        ? { width: baseWidth, height: Math.round(baseWidth / ratio) }
        : { width: Math.round(baseHeight * ratio), height: baseHeight };
}

export type SkeletonDimensionOptions = {
    targetSize?: string | null;
    referenceWidth?: number | null;
    referenceHeight?: number | null;
    userWidth?: number | null;
    userHeight?: number | null;
    freeResize?: boolean | null;
    baseMaxBound?: number;
    defaultRatio?: string | null;
};

export function resolveSkeletonDimensions(options: SkeletonDimensionOptions = {}): { width: number; height: number } {
    const baseBound = options.baseMaxBound || CANVAS_NODE_MAX_BOUND;

    // 1. 自由变形标记（freeResize）：严格保持当前尺寸不变
    if (options.freeResize && options.userWidth && options.userHeight) {
        return { width: Math.round(options.userWidth), height: Math.round(options.userHeight) };
    }

    // 2. 用户手动拉大尺寸优先级：若用户主动拉大过节点（长边超过基准），以用户拉大的最大边作为等比边界
    const hasCustomUserSize = Boolean(
        options.userWidth &&
        options.userHeight &&
        Math.max(options.userWidth, options.userHeight) > baseBound
    );
    const activeBound = hasCustomUserSize
        ? Math.max(options.userWidth!, options.userHeight!)
        : baseBound;

    // 3. 显式目标比例（targetSize）
    if (options.targetSize) {
        const fromRatio = nodeSizeFromRatio(options.targetSize, activeBound, activeBound);
        if (fromRatio) return fromRatio;
    }

    // 4. 图生图/参考图比例继承
    if (options.referenceWidth && options.referenceHeight && options.referenceWidth > 0 && options.referenceHeight > 0) {
        const fromRef = nodeSizeFromRatio(`${options.referenceWidth}:${options.referenceHeight}`, activeBound, activeBound);
        if (fromRef) return fromRef;
    }

    // 5. 若用户有自定义尺寸但没有目标比例/参考图，保持用户尺寸
    if (options.userWidth && options.userHeight) {
        return { width: Math.round(options.userWidth), height: Math.round(options.userHeight) };
    }

    // 6. 默认回退（若配置了 defaultRatio 则按该比例，否则回退为对称正方形基准）
    if (options.defaultRatio) {
        const fromDefault = nodeSizeFromRatio(options.defaultRatio, baseBound, baseBound);
        if (fromDefault) return fromDefault;
    }

    return { width: baseBound, height: baseBound };
}

export function isAspectRatioClose(frameWidth: number, frameHeight: number, actualWidth: number, actualHeight: number, tolerance = 0.08): boolean {
    if (!frameWidth || !frameHeight || !actualWidth || !actualHeight) return false;
    const frameRatio = frameWidth / frameHeight;
    const actualRatio = actualWidth / actualHeight;
    const diff = Math.abs(actualRatio - frameRatio) / frameRatio;
    return diff <= tolerance;
}
