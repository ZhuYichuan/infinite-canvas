import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "antd";

import i18n from "@/i18n";
import { ImageSettingsTheme } from "@/components/image-settings-panel";
import { type CanvasTheme } from "@/lib/canvas-theme";
import type { AiConfig, ReasoningEffort } from "@/stores/use-config-store";
import { getModelProfile } from "@/services/api/models";

export type TextSettingsPanelProps = {
    modelId?: string;
    maxLength?: number;
    thinking?: boolean;
    onParamChange?: (patch: { maxLength?: number; thinking?: boolean }) => void;
    config?: AiConfig;
    onConfigChange?: (key: "reasoningEffort", value: ReasoningEffort) => void;
    theme: CanvasTheme;
    className?: string;
};

export function TextSettingsPanel({
    modelId,
    maxLength,
    thinking,
    onParamChange,
    config,
    onConfigChange,
    theme,
    className = "space-y-4",
}: TextSettingsPanelProps) {
    const { t } = useTranslation();
    const profile = getModelProfile(modelId || "text-qwen-35-chat");
    const textConfig = profile?.capabilityConfig?.textConfig;
    const maxLengthOptions = textConfig?.maxLength?.options || [256, 512, 1024];
    const defaultMaxLength = textConfig?.maxLength?.default || 512;
    const currentMaxLength = maxLength ?? defaultMaxLength;
    const isThinkingSupported = textConfig?.thinkingSupported ?? true;
    const currentThinking = thinking ?? true;

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                <div className="text-lg font-semibold">{t("settingsPanels.text.title")}</div>

                {/* 生成长度控制 */}
                <div className="space-y-2.5">
                    <div className="text-sm font-medium" style={{ color: theme.node.muted }}>
                        {t("settingsPanels.text.maxLength", "生成长度")}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {maxLengthOptions.map((val) => (
                            <OptionPill
                                key={val}
                                selected={currentMaxLength === val}
                                theme={theme}
                                onClick={() => onParamChange?.({ maxLength: val })}
                            >
                                {val} {t("settingsPanels.text.tokens", "词")}
                            </OptionPill>
                        ))}
                    </div>
                </div>

                {/* 深度思考开关 */}
                {isThinkingSupported ? (
                    <div className="flex items-center justify-between pt-1">
                        <div>
                            <div className="text-sm font-medium" style={{ color: theme.node.text }}>
                                {t("settingsPanels.text.thinking", "深度思考")}
                            </div>
                            <div className="text-xs" style={{ color: theme.node.muted }}>
                                {t("settingsPanels.text.thinkingDesc", "开启模型链式思考推理过程")}
                            </div>
                        </div>
                        <Switch
                            checked={currentThinking}
                            onChange={(checked) => onParamChange?.({ thinking: checked })}
                        />
                    </div>
                ) : null}
            </div>
        </ImageSettingsTheme>
    );
}

export function reasoningEffortLabel(value: ReasoningEffort) {
    return i18n.t(`settingsPanels.common.${value}`, { defaultValue: value });
}

function OptionPill({ selected, theme, onClick, children }: { selected: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            className="h-9 cursor-pointer rounded-full border px-2 text-sm transition hover:opacity-80"
            style={{ background: "transparent", borderColor: selected ? theme.node.text : theme.node.stroke, color: theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClick}
        >
            {children}
        </button>
    );
}
