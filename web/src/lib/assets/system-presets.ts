/**
 * 系统预设资产（System Preset Asset）领域模型。
 *
 * 预设资产是平台内置、只读、通过公开 CDN 分发的参考素材，与用户自己的「我的素材」相对。
 * 图片二进制不入库：仓库只保存索引元数据（web/src/data/system-presets/*.json，
 * 由 scripts/sync-system-presets.mjs 从 CDN 索引生成），运行时按需从 CDN 取图。
 */

export type SystemPresetCategory = "pose" | "costume" | "portrait";

/** 姿态的两种渲染：线稿（line）与深度图（depth）。两者 id 命名空间完全一致。 */
export type PoseRendition = "line" | "depth";

export type PoseAngleKey = "front" | "side" | "diag" | "high" | "low";

/** 取图档位：网格用 thumb，预览用 mid，插入节点/送入生成用 full。 */
export type SystemPresetTier = "thumb" | "mid" | "full";

export type SystemPresetSeries = {
    id: string;
    name: string;
    count: number;
    nsfw: boolean;
    groups?: string[];
    section?: string;
    hair?: string;
};

export type SystemPresetAsset = {
    id: string;
    series: string;
    name: string;
    group?: string;
    subtitle?: string;
    promptText?: string;
    angles?: PoseAngleKey[];
    nsfw: boolean;
    width?: number;
    height?: number;
};

export type SystemPresetDataset = {
    generatedAt: string;
    source: string;
    renditions?: PoseRendition[];
    series: SystemPresetSeries[];
    assets: SystemPresetAsset[];
};

export const SYSTEM_PRESET_CDN = {
    pose: "https://ai-pose-gallery.pages.dev",
    poseDepth: "https://ai-pose-depth-gallery.pages.dev",
    costume: "https://ai-costume-gallery.pages.dev",
    costumeFull: "https://ai-costume-anime-gallery.pages.dev",
    portrait: "https://ai-portrait-gallery.pages.dev",
} as const;

export const SYSTEM_PRESET_CATEGORIES: SystemPresetCategory[] = ["pose", "costume", "portrait"];

export const POSE_RENDITIONS: PoseRendition[] = ["line", "depth"];

export const POSE_ANGLE_KEYS: PoseAngleKey[] = ["front", "side", "diag", "high", "low"];

export const POSE_ANGLE_LABELS: Record<PoseAngleKey, string> = {
    front: "正面",
    side: "侧面",
    diag: "斜向",
    high: "俯视",
    low: "仰视",
};

export const POSE_ANGLE_SHORT_LABELS: Record<PoseAngleKey, string> = {
    front: "正",
    side: "侧",
    diag: "斜",
    high: "俯",
    low: "仰",
};

const join = (base: string, rest: string) => `${base.replace(/\/+$/, "")}/${rest.replace(/^\/+/, "")}`;

/**
 * 构造预设资产的图片地址。姿态按「id_机位」拼路径，服装与发型按 id 直取。
 * 各 CDN 的目录约定不同，集中在此处便于一处调整。
 */
export function presetImageUrl(category: SystemPresetCategory, assetId: string, options: { tier?: SystemPresetTier; angle?: PoseAngleKey; rendition?: PoseRendition } = {}): string {
    const { tier = "thumb", angle, rendition = "line" } = options;

    if (category === "pose") {
        const host = rendition === "depth" ? SYSTEM_PRESET_CDN.poseDepth : SYSTEM_PRESET_CDN.pose;
        const file = angle ? `${assetId}_${angle}` : assetId;
        return tier === "thumb" ? join(host, `thumbs/${file}.jpg`) : join(host, `img/${file}.png`);
    }

    if (category === "costume") {
        if (tier === "full") return join(SYSTEM_PRESET_CDN.costumeFull, `png/${assetId}.png`);
        if (tier === "mid") return join(SYSTEM_PRESET_CDN.costume, `img/${assetId}.webp`);
        return join(SYSTEM_PRESET_CDN.costume, `thumbs/${assetId}.webp`);
    }

    return tier === "thumb" ? join(SYSTEM_PRESET_CDN.portrait, `img/thumb/${assetId}.webp`) : join(SYSTEM_PRESET_CDN.portrait, `img/full/${assetId}.png`);
}

// JSON 导入的字段类型会被推断为 string[]，实际取值由同步脚本保证
const LOADERS: Record<SystemPresetCategory, () => Promise<{ default: unknown }>> = {
    pose: () => import("@/data/system-presets/poses.json"),
    costume: () => import("@/data/system-presets/costumes.json"),
    portrait: () => import("@/data/system-presets/portraits.json"),
};

const datasetCache = new Map<SystemPresetCategory, Promise<SystemPresetDataset>>();

/** 按类目懒加载索引数据（三个 JSON 各自独立分包，不进入首屏 bundle）。 */
export function loadSystemPresets(category: SystemPresetCategory): Promise<SystemPresetDataset> {
    const cached = datasetCache.get(category);
    if (cached) return cached;
    const pending = LOADERS[category]().then((module) => module.default as SystemPresetDataset);
    datasetCache.set(category, pending);
    return pending;
}

export type SystemPresetQuery = {
    series?: string;
    group?: string;
    keyword?: string;
    includeSensitive?: boolean;
};

/** 预设资产的检索：系列 + 分组 + 关键字（名称/编号/提示词），并按敏感内容开关过滤。 */
export function filterPresetAssets(assets: SystemPresetAsset[], query: SystemPresetQuery = {}): SystemPresetAsset[] {
    const { series, group, keyword, includeSensitive = false } = query;
    const text = keyword?.trim().toLowerCase() ?? "";
    return assets.filter((asset) => {
        if (asset.nsfw && !includeSensitive) return false;
        if (series && asset.series !== series) return false;
        if (group && asset.group !== group) return false;
        if (!text) return true;
        return [asset.name, asset.id, asset.group, asset.subtitle, asset.promptText].filter(Boolean).some((value) => String(value).toLowerCase().includes(text));
    });
}

/** 插入资产时使用的标题：优先用可读名称，姿态附带机位后缀。 */
export function presetInsertTitle(asset: SystemPresetAsset, angleLabel?: string): string {
    return angleLabel ? `${asset.name} (${angleLabel})` : asset.name;
}

/** 默认机位：优先正面，否则取第一个可用机位。 */
export function defaultPoseAngle(angles?: PoseAngleKey[]): PoseAngleKey {
    if (!angles?.length) return "front";
    return angles.includes("front") ? "front" : angles[0];
}

/** 预设资产携带的提示词（服装关键词 / 发型描述）并入提示词框；用户已有输入时追加在后。 */
export function mergePresetPrompt(current: string, presetPrompt?: string): string {
    const extra = presetPrompt?.trim();
    if (!extra) return current;
    return current.trim() ? `${current.trim()}, ${extra}` : extra;
}
