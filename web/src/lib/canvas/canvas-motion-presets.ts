import motionsData from "@/data/system-presets/motions.json";

export type CanvasMotionPreset = {
    id: string;
    order: number;
    name: string;
    video: string;
    prompt: string;
};

export const MOTION_PRESETS: CanvasMotionPreset[] = motionsData as CanvasMotionPreset[];

export const MOTION_PRESET_MAP: Map<string, CanvasMotionPreset> = new Map(
    MOTION_PRESETS.map((m) => [m.id, m]),
);

export function getMotionPreset(id: string): CanvasMotionPreset | undefined {
    return MOTION_PRESET_MAP.get(id);
}

/**
 * 编译包含 @[motion:<id>] 的提示词，将其替换为电影级运镜描述
 */
export function compileMotionTokens(text: string): string {
    return text.replace(/@\[motion:([^\]]+)\]/g, (_, id) => {
        const preset = getMotionPreset(id);
        return preset ? preset.prompt : "";
    });
}
