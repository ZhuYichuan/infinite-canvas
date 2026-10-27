import { Select } from "antd";
import { AlertTriangle, Film, Sparkles } from "lucide-react";
import { useMemo } from "react";

import {
    BUILTIN_WORKFLOW_MODELS,
    getModelProfile,
    type WorkflowModelProfile,
} from "@/services/api/models";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { isModelSupportedByHost, useEffectiveConfig } from "@/stores/use-config-store";

export type VideoModelPickerProps = {
    modelId?: string;
    onChange: (modelId: string, profile: WorkflowModelProfile) => void;
    className?: string;
    disabled?: boolean;
};

export function VideoModelPicker({
    modelId,
    onChange,
    className = "",
    disabled = false,
}: VideoModelPickerProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const config = useEffectiveConfig();
    const activeChannel = useMemo(() => {
        return config.channels.find((c) => c.id === config.channelId) || config.channels[0];
    }, [config.channels, config.channelId]);

    // 默认模型为全能 4 步极速版
    const activeProfile = useMemo(() => {
        return getModelProfile(modelId) || BUILTIN_WORKFLOW_MODELS[0];
    }, [modelId]);

    // 按全能参考 (Omni) 与首尾帧插值 (Frame) 分组选项
    const options = useMemo(() => {
        const omniModels = BUILTIN_WORKFLOW_MODELS.filter((m) => m.category === "omniVideo");
        const frameModels = BUILTIN_WORKFLOW_MODELS.filter((m) => m.category === "frameVideo");

        const renderOption = (m: WorkflowModelProfile, isFrame: boolean) => {
            const vramLabel = `${m.vramTier || "8GB"} 显存`;
            const durationDesc = m.capabilityConfig.vram?.recommendedDuration.description || "";
            const shortDuration = durationDesc.includes("3~5") ? "分镜 3~5s" : "分镜 5~8s";
            const isSupported = isModelSupportedByHost(activeChannel, m.id);

            return {
                value: m.id,
                label: (
                    <div className="flex items-center justify-between gap-2 py-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                            {isFrame ? (
                                <Sparkles className="size-3.5 shrink-0 text-purple-500" />
                            ) : (
                                <Film className="size-3.5 shrink-0 text-emerald-500" />
                            )}
                            <span className="font-medium text-xs truncate">{m.name}</span>
                            <span className="text-[10px] bg-stone-500/10 text-stone-600 dark:text-stone-300 px-1 py-0.5 rounded font-mono">
                                {vramLabel}
                            </span>
                            {!isSupported && (
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-medium shrink-0">
                                    <AlertTriangle className="size-3" />
                                    <span>未就绪</span>
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-stone-400 shrink-0">{shortDuration}</span>
                    </div>
                ),
            };
        };

        return [
            {
                label: (
                    <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                        全能参考视频 (Omni Video) · 最多 9图3视3音
                    </span>
                ),
                options: omniModels.map((m) => renderOption(m, false)),
            },
            {
                label: (
                    <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                        首尾帧插值视频 (Frame Video) · 严格 2 图插值
                    </span>
                ),
                options: frameModels.map((m) => renderOption(m, true)),
            },
        ];
    }, [activeChannel]);

    const handleChange = (nextId: string) => {
        const found = getModelProfile(nextId);
        if (found) {
            onChange(found.id, found);
        }
    };

    const isActiveSupported = isModelSupportedByHost(activeChannel, activeProfile.id);

    return (
        <Select
            value={activeProfile.id}
            options={options}
            onChange={handleChange}
            disabled={disabled}
            popupMatchSelectWidth={340}
            className={`!h-10 min-w-0 !max-w-[220px] ${className}`}
            classNames={{
                root: "!h-10",
            }}
            styles={{
                root: {
                    background: "transparent",
                    color: theme.node.text,
                    height: "40px",
                },
            }}
            labelRender={(option) => {
                const profile = getModelProfile(String(option.value)) || activeProfile;
                const isFrame = profile.category === "frameVideo";
                const vram = profile.vramTier ? `${profile.vramTier} 显存` : "8GB 显存";

                return (
                    <div className="flex items-center gap-1.5 truncate text-xs">
                        {isFrame ? (
                            <Sparkles className="size-3.5 shrink-0 text-purple-500" />
                        ) : (
                            <Film className="size-3.5 shrink-0 text-emerald-500" />
                        )}
                        <span className="truncate font-medium">{profile.name}</span>
                        <span className="text-[10px] opacity-60 font-mono shrink-0">{vram}</span>
                        {!isActiveSupported && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-medium shrink-0">
                                <AlertTriangle className="size-3" />
                                <span>未就绪</span>
                            </span>
                        )}
                    </div>
                );
            }}
        />
    );
}
