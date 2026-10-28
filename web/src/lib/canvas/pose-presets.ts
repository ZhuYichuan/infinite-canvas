import poseData from "@/data/pose-presets.json";

export type PoseAngleKey = "front" | "side" | "diag" | "high" | "low";

export type PoseItem = {
    id: string;
    series: string;
    category: string;
    name: string;
    angles: PoseAngleKey[];
};

export type PoseSeriesItem = {
    id: string;
    name: string;
    count: number;
    categories: string[];
};

export const POSE_CDN_BASE = "https://ai-pose-gallery.pages.dev/img";
export const POSE_REPOSITORY_URL = "https://github.com/ZhuYichuan/pose-gallery";

export const POSE_ANGLE_LABELS: Record<PoseAngleKey, string> = {
    front: "正面",
    side: "侧面",
    diag: "斜向",
    high: "俯视",
    low: "仰视",
};

const BLOCKED_SERIES_IDS = new Set(["pair60"]);
const BLOCKED_SERIES_NAMES = new Set(["双人纠缠"]);

export const POSE_SERIES_LIST: PoseSeriesItem[] = (poseData.series as PoseSeriesItem[]).filter(
    (s) => !BLOCKED_SERIES_IDS.has(s.id) && !BLOCKED_SERIES_NAMES.has(s.name),
);
export const ALL_POSES: PoseItem[] = (poseData.poses as PoseItem[]).filter(
    (p) => !BLOCKED_SERIES_IDS.has(p.series),
);

export function getPoseImageUrl(poseId: string, angle: PoseAngleKey, cdnBase = POSE_CDN_BASE): string {
    return `${cdnBase.replace(/\/+$/, "")}/${poseId}_${angle}.png`;
}
