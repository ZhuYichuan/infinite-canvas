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

export const POSE_ANGLE_LABELS: Record<PoseAngleKey, string> = {
    front: "正面",
    side: "侧面",
    diag: "斜向",
    high: "俯视",
    low: "仰视",
};

export const POSE_SERIES_LIST: PoseSeriesItem[] = poseData.series as PoseSeriesItem[];
export const ALL_POSES: PoseItem[] = poseData.poses as PoseItem[];

export function getPoseImageUrl(poseId: string, angle: PoseAngleKey, cdnBase = POSE_CDN_BASE): string {
    return `${cdnBase.replace(/\/+$/, "")}/${poseId}_${angle}.png`;
}
