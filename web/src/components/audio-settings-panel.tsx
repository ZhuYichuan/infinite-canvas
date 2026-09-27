import { Slider } from "antd";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ImageSettingsTheme } from "@/components/image-settings-panel";
import { type CanvasTheme } from "@/lib/canvas-theme";
import type { AiConfig } from "@/stores/use-config-store";

export const audioQuickSecondOptions = [60, 120, 180];

export function audioSecondsLabel(value?: string | number): string {
    const s = Math.min(300, Math.max(10, Number(value) || 60));
    return `${s}s`;
}

type AudioSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: "audioSeconds", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
};

export function AudioSettingsPanel({
    config,
    onConfigChange,
    theme,
    showTitle = true,
    className = "space-y-4",
}: AudioSettingsPanelProps) {
    const { t } = useTranslation();
    const currentSeconds = Math.min(300, Math.max(10, Number(config.audioSeconds) || 60));

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? (
                    <div className="flex items-center justify-between">
                        <span className="text-base font-semibold">{t("settingsPanels.audio.title", { defaultValue: "音频设置" })}</span>
                        <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full" style={{ background: theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: theme.node.text }}>
                            {currentSeconds} 秒
                        </span>
                    </div>
                ) : null}

                <SettingGroup title="生成时长" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-2">
                        {audioQuickSecondOptions.map((sec) => (
                            <button
                                key={sec}
                                type="button"
                                className="h-9 cursor-pointer rounded-xl border text-sm font-medium transition hover:opacity-85"
                                style={{
                                    borderColor: currentSeconds === sec ? theme.node.text : theme.node.stroke,
                                    background: currentSeconds === sec ? (theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)") : "transparent",
                                    color: theme.node.text,
                                }}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={() => onConfigChange("audioSeconds", String(sec))}
                            >
                                {sec}s
                            </button>
                        ))}
                    </div>

                    <div className="px-1 pt-1">
                        <Slider
                            min={10}
                            max={300}
                            step={1}
                            value={currentSeconds}
                            tooltip={{ formatter: (v) => `${v} 秒` }}
                            onChange={(val) => onConfigChange("audioSeconds", String(val))}
                        />
                    </div>
                </SettingGroup>
            </div>
        </ImageSettingsTheme>
    );
}

function SettingGroup({ title, color, children }: { title: string; color: string; children: ReactNode }) {
    return (
        <div className="space-y-2.5">
            <div className="text-xs font-medium" style={{ color }}>
                {title}
            </div>
            {children}
        </div>
    );
}
