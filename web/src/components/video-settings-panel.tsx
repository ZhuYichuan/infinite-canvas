import { Slider } from "antd";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ImageSettingsTheme } from "@/components/image-settings-panel";
import { type CanvasTheme } from "@/lib/canvas-theme";
import { type AiConfig } from "@/stores/use-config-store";
import {
    getModelProfile,
    type WorkflowModelProfile,
    videoMinimaxH3OmniProfile,
} from "@/services/api/models";

export type MiniMaxVideoTier = {
    mp: string;
    landscapeW: number;
    landscapeH: number;
};

/**
 * MiniMax H3 官方支持的 32 整数倍尺寸档位（最大支持到 0.98 MP）
 */
export const MINIMAX_VIDEO_SIZE_TIERS: MiniMaxVideoTier[] = [
    { mp: "0.2M", landscapeW: 608, landscapeH: 352 },
    { mp: "0.3M", landscapeW: 736, landscapeH: 416 },
    { mp: "0.4M", landscapeW: 864, landscapeH: 480 },
    { mp: "0.5M", landscapeW: 960, landscapeH: 544 },
    { mp: "0.6M", landscapeW: 1056, landscapeH: 608 },
    { mp: "0.7M", landscapeW: 1152, landscapeH: 640 },
    { mp: "0.8M", landscapeW: 1216, landscapeH: 672 },
    { mp: "0.9M", landscapeW: 1280, landscapeH: 736 },
    { mp: "0.98M", landscapeW: 1344, landscapeH: 768 },
];

export const quickSecondOptions = [5, 10, 15];

export const videoSecondOptions = quickSecondOptions.map((value) => String(value));
export const videoResolutionOptions = [{ value: "720", label: "720p" }];
export const videoSizeOptions = MINIMAX_VIDEO_SIZE_TIERS.flatMap((tier) => [
    { value: `${tier.landscapeW}x${tier.landscapeH}`, label: `16:9 · ${tier.landscapeW}×${tier.landscapeH} (${tier.mp})`, width: tier.landscapeW, height: tier.landscapeH },
    { value: `${tier.landscapeH}x${tier.landscapeW}`, label: `9:16 · ${tier.landscapeH}×${tier.landscapeW} (${tier.mp})`, width: tier.landscapeH, height: tier.landscapeW },
]);

export type VideoSettingsPanelProps = {
    modelId?: string;
    size?: string;
    duration?: number | string;
    videoMode?: "omni" | "frame";
    onParamChange?: (patch: {
        modelId?: string;
        videoMode?: "omni" | "frame";
        size?: string;
        seconds?: string;
        duration?: number;
    }) => void;
    config?: AiConfig;
    onConfigChange?: (key: "vquality" | "size" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark" | "videoMode", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
};

export function VideoSettingsPanel({
    modelId,
    size,
    duration,
    videoMode,
    onParamChange,
    config,
    onConfigChange,
    theme,
    showTitle = true,
    className = "w-[320px] space-y-4 rounded-2xl px-1 py-0.5",
}: VideoSettingsPanelProps) {
    const { t } = useTranslation();

    // 动态解析绑定的工作流模型 Profile
    const effectiveModelId = modelId || (videoMode === "frame" ? "frame-video-minimax-h3-fp8-4step-pdmd" : videoMode === "omni" ? "omni-video-minimax-h3-fp8-4step-pdmd" : undefined) || config?.videoModel || config?.model;
    const profile = getModelProfile(effectiveModelId) || videoMinimaxH3OmniProfile;

    const currentMode: "omni" | "frame" = videoMode || (profile.category === "frameVideo" ? "frame" : (config?.videoMode === "frame" ? "frame" : "omni"));

    // 动态尺寸能力配置
    const sizeConfig = profile.capabilityConfig.size;
    const sizeTiers = extractVideoSizeTiers(sizeConfig?.values);
    const rawSize = size || config?.size;
    const currentSize = normalizeVideoSizeValue(rawSize, profile);
    const { width: currentW, height: currentH, aspect, tier: selectedTier } = parseVideoSize(currentSize, sizeTiers);

    // 动态时长能力配置
    const durationConfig = profile.capabilityConfig.duration;
    const minDuration = durationConfig?.min ?? 1;
    const maxDuration = durationConfig?.max ?? 15;
    const stepDuration = durationConfig?.step ?? 1;
    const quickTags = durationConfig?.tags ?? [5, 10, 15];
    const defaultDuration = durationConfig?.default ?? 5;
    const rawSeconds = duration !== undefined ? Number(duration) : Number(config?.videoSeconds);
    const secondsNum = Math.min(maxDuration, Math.max(minDuration, Number.isFinite(rawSeconds) && rawSeconds > 0 ? rawSeconds : defaultDuration));

    const handleSelectMode = (nextMode: "omni" | "frame") => {
        const is20Step = profile.steps === 20;
        const nextModelId = nextMode === "frame"
            ? (is20Step ? "frame-video-minimax-h3-fp8" : "frame-video-minimax-h3-fp8-4step-pdmd")
            : (is20Step ? "omni-video-minimax-h3-fp8" : "omni-video-minimax-h3-fp8-4step-pdmd");
        onParamChange?.({
            modelId: nextModelId,
            videoMode: nextMode,
        });
        onConfigChange?.("videoMode", nextMode);
    };

    const handleSelectTier = (tier: MiniMaxVideoTier) => {
        const nextW = aspect === "16:9" ? tier.landscapeW : tier.landscapeH;
        const nextH = aspect === "16:9" ? tier.landscapeH : tier.landscapeW;
        const nextSize = `${nextW}x${nextH}`;
        onParamChange?.({ size: nextSize });
        onConfigChange?.("size", nextSize);
    };

    const handleSwitchAspect = (nextAspect: "16:9" | "9:16") => {
        if (nextAspect === aspect) return;
        const nextW = nextAspect === "16:9" ? selectedTier.landscapeW : selectedTier.landscapeH;
        const nextH = nextAspect === "16:9" ? selectedTier.landscapeH : selectedTier.landscapeW;
        const nextSize = `${nextW}x${nextH}`;
        onParamChange?.({ size: nextSize });
        onConfigChange?.("size", nextSize);
    };

    const handleDurationChange = (val: number) => {
        onParamChange?.({ seconds: String(val), duration: val });
        onConfigChange?.("videoSeconds", String(val));
    };

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? (
                    <div className="flex items-center justify-between">
                        <span className="text-base font-semibold">{t("settingsPanels.video.title")}</span>
                        <span className="rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[11px] font-medium opacity-70">
                            {profile.name}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center justify-between px-0.5 text-[11px] font-medium opacity-70">
                        <span>{profile.name}</span>
                    </div>
                )}

                {/* 0. 生成模式切换：全能参考 vs 首尾帧 */}
                <SettingGroup title="生成模式" color={theme.node.muted}>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            className="flex h-10 cursor-pointer flex-col items-center justify-center rounded-xl border text-xs font-medium transition hover:opacity-85"
                            style={{
                                borderColor: currentMode === "omni" ? theme.node.text : theme.node.stroke,
                                background: currentMode === "omni" ? (theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)") : "transparent",
                                color: theme.node.text,
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={() => handleSelectMode("omni")}
                        >
                            <span className="font-semibold">全能参考 (Omni)</span>
                            <span className="text-[10px] leading-none opacity-55">多模态 (图/音/视频)</span>
                        </button>
                        <button
                            type="button"
                            className="flex h-10 cursor-pointer flex-col items-center justify-center rounded-xl border text-xs font-medium transition hover:opacity-85"
                            style={{
                                borderColor: currentMode === "frame" ? theme.node.text : theme.node.stroke,
                                background: currentMode === "frame" ? (theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)") : "transparent",
                                color: theme.node.text,
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={() => handleSelectMode("frame")}
                        >
                            <span className="font-semibold">首尾帧 (Frame)</span>
                            <span className="text-[10px] leading-none opacity-55">首帧 / 首尾帧插帧</span>
                        </button>
                    </div>
                </SettingGroup>

                {/* 1. 比例切换：16:9 横屏 vs 9:16 竖屏 */}
                <SettingGroup title="视频宽高比" color={theme.node.muted}>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl border text-xs font-medium transition hover:opacity-85"
                            style={{
                                borderColor: aspect === "16:9" ? theme.node.text : theme.node.stroke,
                                background: aspect === "16:9" ? (theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)") : "transparent",
                                color: theme.node.text,
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={() => handleSwitchAspect("16:9")}
                        >
                            <span className="inline-block h-2.5 w-4 rounded-sm border-2" style={{ borderColor: theme.node.text }} />
                            <span>16:9 横屏</span>
                        </button>
                        <button
                            type="button"
                            className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl border text-xs font-medium transition hover:opacity-85"
                            style={{
                                borderColor: aspect === "9:16" ? theme.node.text : theme.node.stroke,
                                background: aspect === "9:16" ? (theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)") : "transparent",
                                color: theme.node.text,
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={() => handleSwitchAspect("9:16")}
                        >
                            <span className="inline-block h-4 w-2.5 rounded-sm border-2" style={{ borderColor: theme.node.text }} />
                            <span>9:16 竖屏</span>
                        </button>
                    </div>
                </SettingGroup>

                {/* 2. 尺寸清晰度档位：动态呈现硬件对齐规格 */}
                <SettingGroup title={`生成尺寸规格 (${aspect === "16:9" ? "横屏" : "竖屏"}，当前: ${currentW} × ${currentH})`} color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-2">
                        {sizeTiers.map((tier) => {
                            const itemW = aspect === "16:9" ? tier.landscapeW : tier.landscapeH;
                            const itemH = aspect === "16:9" ? tier.landscapeH : tier.landscapeW;
                            const isSelected = selectedTier.landscapeW === tier.landscapeW && selectedTier.landscapeH === tier.landscapeH;

                            return (
                                <button
                                    key={`${tier.landscapeW}x${tier.landscapeH}`}
                                    type="button"
                                    className="flex h-[54px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border transition hover:opacity-80"
                                    style={{
                                        borderColor: isSelected ? theme.node.text : theme.node.stroke,
                                        background: isSelected ? (theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)") : "transparent",
                                        color: theme.node.text,
                                    }}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={() => handleSelectTier(tier)}
                                >
                                    <span className="text-xs font-semibold leading-tight tracking-tight">
                                        {itemW} × {itemH}
                                    </span>
                                    <span className="text-[10px] leading-none opacity-55">
                                        {tier.mp}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </SettingGroup>

                {/* 3. 视频时长 */}
                <SettingGroup title={`视频时长: ${secondsNum} 秒`} color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-2">
                        {quickTags.map((value) => (
                            <OptionPill
                                key={value}
                                selected={secondsNum === value}
                                theme={theme}
                                onClick={() => handleDurationChange(value)}
                            >
                                {value} 秒
                            </OptionPill>
                        ))}
                    </div>
                    <div className="px-1 pt-1">
                        <Slider
                            min={minDuration}
                            max={maxDuration}
                            step={stepDuration}
                            value={secondsNum}
                            tooltip={{ formatter: (v) => `${v} 秒` }}
                            onChange={(val) => handleDurationChange(val)}
                        />
                    </div>
                </SettingGroup>
            </div>
        </ImageSettingsTheme>
    );
}

export function videoResolutionLabel(_value: string) {
    return "720p";
}

export function extractVideoSizeTiers(values?: string[]): MiniMaxVideoTier[] {
    if (!values || values.length === 0) return MINIMAX_VIDEO_SIZE_TIERS;
    const tierMap = new Map<string, MiniMaxVideoTier>();
    for (const val of values) {
        const match = val.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
        if (!match) continue;
        const w = Number(match[1]);
        const h = Number(match[2]);
        const landscapeW = Math.max(w, h);
        const landscapeH = Math.min(w, h);
        const key = `${landscapeW}x${landscapeH}`;
        if (!tierMap.has(key)) {
            const pixels = landscapeW * landscapeH;
            const mp = pixels >= 1_000_000 && pixels <= 1_050_000 ? "0.98M" : `${(pixels / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
            tierMap.set(key, { mp, landscapeW, landscapeH });
        }
    }
    return Array.from(tierMap.values()).sort((a, b) => (a.landscapeW * a.landscapeH) - (b.landscapeW * b.landscapeH));
}

export function videoSizeLabel(value?: string, profile?: WorkflowModelProfile) {
    const tiers = extractVideoSizeTiers(profile?.capabilityConfig.size?.values);
    const size = normalizeVideoSizeValue(value, profile);
    const { width, height, aspect } = parseVideoSize(size, tiers);
    return `${width}×${height} (${aspect})`;
}

export function videoSecondsLabel(value?: string | number, profile?: WorkflowModelProfile) {
    const durationConfig = profile?.capabilityConfig.duration;
    const min = durationConfig?.min ?? 1;
    const max = durationConfig?.max ?? 15;
    const def = durationConfig?.default ?? 5;
    const raw = Number(value);
    const s = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : def;
    return `${s}s`;
}

export function normalizeVideoSizeValue(value?: string, profile?: WorkflowModelProfile) {
    const allowed = profile?.capabilityConfig.size?.values;
    const defaultVal = profile?.capabilityConfig.size?.default || "1280x736";
    if (!value) return defaultVal;
    if (allowed && allowed.length > 0) {
        const clean = value.toLowerCase().replace(/\s+/g, "");
        const matched = allowed.find((v) => v.toLowerCase().replace(/\s+/g, "") === clean);
        return matched || defaultVal;
    }
    const isValid = videoSizeOptions.some((option) => option.value === value);
    return isValid ? value : defaultVal;
}

export function normalizeVideoResolutionValue(_value?: string) {
    return "720";
}

export function parseVideoSize(
    sizeStr?: string,
    tiers: MiniMaxVideoTier[] = MINIMAX_VIDEO_SIZE_TIERS,
): { width: number; height: number; aspect: "16:9" | "9:16"; tier: MiniMaxVideoTier } {
    const raw = (sizeStr || "").trim().toLowerCase();
    const match = raw.match(/^(\d+)\s*[x×]\s*(\d+)$/);
    const w = Number(match?.[1]) || 1280;
    const h = Number(match?.[2]) || 736;

    const isLandscape = w >= h;
    const aspect: "16:9" | "9:16" = isLandscape ? "16:9" : "9:16";
    const longSide = Math.max(w, h);
    const shortSide = Math.min(w, h);

    const availableTiers = tiers.length > 0 ? tiers : MINIMAX_VIDEO_SIZE_TIERS;
    let matchedTier = availableTiers[0] || MINIMAX_VIDEO_SIZE_TIERS[0];
    let minDiff = Infinity;
    for (const t of availableTiers) {
        const diff = Math.abs(t.landscapeW - longSide) + Math.abs(t.landscapeH - shortSide);
        if (diff < minDiff) {
            minDiff = diff;
            matchedTier = t;
        }
    }

    const finalW = aspect === "16:9" ? matchedTier.landscapeW : matchedTier.landscapeH;
    const finalH = aspect === "16:9" ? matchedTier.landscapeH : matchedTier.landscapeW;

    return { width: finalW, height: finalH, aspect, tier: matchedTier };
}

function OptionPill({ selected, disabled = false, theme, onClick, children }: { selected: boolean; disabled?: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            disabled={disabled}
            className="h-9 cursor-pointer rounded-xl border px-2 text-xs font-medium transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-35"
            style={{
                background: selected ? (theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)") : "transparent",
                borderColor: selected ? theme.node.text : theme.node.stroke,
                color: theme.node.text,
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function SettingGroup({ title, color, children }: { title: string; color: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <div className="text-xs font-medium" style={{ color }}>
                {title}
            </div>
            {children}
        </div>
    );
}
