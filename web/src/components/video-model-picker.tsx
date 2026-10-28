import { Cascader, Tooltip } from "antd";
import { AlertTriangle, Film, HelpCircle, Server, Sparkles } from "lucide-react";
import { useMemo } from "react";

import {
    BUILTIN_WORKFLOW_MODELS,
    evaluateModelAvailability,
    getModelProfile,
    type WorkflowModelProfile,
} from "@/services/api/models";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { useEffectiveConfig } from "@/stores/use-config-store";

export type VideoModelPickerProps = {
    channelId?: string;
    modelId?: string;
    onChange: (channelId: string, modelId: string, profile: WorkflowModelProfile) => void;
    className?: string;
    disabled?: boolean;
    connectedImages?: number;
    connectedVideos?: number;
    connectedAudios?: number;
    promptText?: string;
};

export function VideoModelPicker({
    channelId,
    modelId,
    onChange,
    className = "",
    disabled = false,
    connectedImages = 0,
    connectedVideos = 0,
    connectedAudios = 0,
    promptText = "",
}: VideoModelPickerProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const config = useEffectiveConfig();

    const channels = useMemo(() => {
        return (config.channels && config.channels.length > 0)
            ? config.channels
            : [{ id: "builtin", name: "系统内置 ComfyUI", baseUrl: "http://127.0.0.1:8188", apiKey: "", apiFormat: "comfyui" as const, models: [] }];
    }, [config.channels]);

    const activeChannel = useMemo(() => {
        return (channelId ? channels.find((c) => c.id === channelId) : null) || channels[0];
    }, [channels, channelId]);

    const activeProfile = useMemo(() => {
        return getModelProfile(modelId) || BUILTIN_WORKFLOW_MODELS[0];
    }, [modelId]);

    // 级联递进选项：第一级为 API 提供商 (算力主机)，hover 展开第二级为模型
    const options = useMemo(() => {
        return channels.map((channel) => ({
            value: channel.id,
            label: (
                <div className="flex items-center gap-1.5 py-0.5">
                    <Server className="size-3.5 text-blue-500 shrink-0" />
                    <span className="font-medium text-xs truncate max-w-[140px]">{channel.name || "ComfyUI 主机"}</span>
                </div>
            ),
            rawName: channel.name,
            children: BUILTIN_WORKFLOW_MODELS.map((model) => {
                const isFrame = model.category === "frameVideo";
                const availability = evaluateModelAvailability({
                    targetModel: model,
                    connectedImages,
                    connectedVideos,
                    connectedAudios,
                    promptText,
                    activeChannel: channel,
                });

                return {
                    value: model.id,
                    disabled: !availability.isAvailable,
                    label: (
                        <div className={`flex items-center justify-between gap-2 py-0.5 min-w-[200px] ${!availability.isAvailable ? "opacity-60" : ""}`}>
                            <div className="flex items-center gap-1.5 truncate">
                                {isFrame ? (
                                    <Sparkles className="size-3.5 shrink-0 text-purple-500" />
                                ) : (
                                    <Film className="size-3.5 shrink-0 text-emerald-500" />
                                )}
                                <span className="font-medium text-xs truncate">{model.name}</span>
                            </div>
                            {!availability.isAvailable && (
                                <Tooltip
                                    title={
                                        <div className="space-y-1 text-xs">
                                            <div className="font-semibold text-amber-300">当前不可用：</div>
                                            {availability.reasons.map((r, i) => (
                                                <div key={i} className="flex items-start gap-1">
                                                    <span className="text-amber-400">•</span>
                                                    <span>{r}</span>
                                                </div>
                                            ))}
                                        </div>
                                    }
                                >
                                    <span
                                        className="pointer-events-auto flex items-center gap-0.5 text-amber-500 shrink-0 cursor-help p-0.5 hover:text-amber-600"
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        <HelpCircle className="size-3.5" />
                                    </span>
                                </Tooltip>
                            )}
                        </div>
                    ),
                    model,
                    availability,
                };
            }),
        }));
    }, [channels, connectedImages, connectedVideos, connectedAudios, promptText]);

    const cascaderValue = useMemo(() => {
        return [activeChannel.id, activeProfile.id];
    }, [activeChannel.id, activeProfile.id]);

    const handleCascaderChange = (value: (string | number)[]) => {
        if (!value || value.length < 2) return;
        const selectedChannelId = String(value[0]);
        const selectedModelId = String(value[1]);
        const found = getModelProfile(selectedModelId) || activeProfile;
        onChange(selectedChannelId, found.id, found);
    };

    const activeAvailability = useMemo(() => {
        return evaluateModelAvailability({
            targetModel: activeProfile,
            connectedImages,
            connectedVideos,
            connectedAudios,
            promptText,
            activeChannel,
        });
    }, [activeProfile, connectedImages, connectedVideos, connectedAudios, promptText, activeChannel]);

    return (
        <Cascader
            value={cascaderValue}
            options={options}
            onChange={handleCascaderChange}
            expandTrigger="hover"
            allowClear={false}
            disabled={disabled}
            className={`!h-10 min-w-0 !max-w-[280px] ${className}`}
            styles={{
                root: {
                    background: "transparent",
                    color: theme.node.text,
                    height: "40px",
                },
            }}
            displayRender={(_labels, selectedOptions) => {
                const channelOpt = selectedOptions?.[0] as { rawName?: string } | undefined;
                const modelOpt = selectedOptions?.[1] as { value?: string } | undefined;
                const profile = getModelProfile(String(modelOpt?.value)) || activeProfile;
                const isFrame = profile.category === "frameVideo";
                const channelName = channelOpt?.rawName || activeChannel?.name || "ComfyUI";

                return (
                    <div className="flex items-center gap-1.5 truncate text-xs">
                        <Server className="size-3.5 shrink-0 text-blue-500 opacity-80" />
                        <span className="truncate max-w-[80px] font-medium opacity-85">
                            {channelName}
                        </span>
                        <span className="opacity-30">/</span>
                        {isFrame ? (
                            <Sparkles className="size-3.5 shrink-0 text-purple-500" />
                        ) : (
                            <Film className="size-3.5 shrink-0 text-emerald-500" />
                        )}
                        <span className="truncate font-medium">{profile.name}</span>
                        {!activeAvailability.isAvailable && (
                            <Tooltip
                                title={
                                    <div className="space-y-1 text-xs">
                                        <div className="font-semibold text-amber-300">当前不可用：</div>
                                        {activeAvailability.reasons.map((r, i) => (
                                            <div key={i} className="flex items-start gap-1">
                                                <span className="text-amber-400">•</span>
                                                <span>{r}</span>
                                            </div>
                                        ))}
                                    </div>
                                }
                            >
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-medium shrink-0 cursor-help">
                                    <AlertTriangle className="size-3" />
                                    <HelpCircle className="size-3" />
                                </span>
                            </Tooltip>
                        )}
                    </div>
                );
            }}
        />
    );
}
