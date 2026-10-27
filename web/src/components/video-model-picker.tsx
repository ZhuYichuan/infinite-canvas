import { Cascader } from "antd";
import { AlertTriangle, Film, Server, Sparkles } from "lucide-react";
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
    channelId?: string;
    modelId?: string;
    onChange: (channelId: string, modelId: string, profile: WorkflowModelProfile) => void;
    className?: string;
    disabled?: boolean;
};

export function VideoModelPicker({
    channelId,
    modelId,
    onChange,
    className = "",
    disabled = false,
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
                const isSupported = isModelSupportedByHost(channel, model.id);
                const vramLabel = `${model.vramTier || "8GB"} 显存`;
                const durationDesc = model.capabilityConfig.vram?.recommendedDuration.description || "";
                const shortDuration = durationDesc.includes("3~5") ? "分镜 3~5s" : "分镜 5~8s";

                return {
                    value: model.id,
                    label: (
                        <div className="flex items-center justify-between gap-3 py-0.5 min-w-[210px]">
                            <div className="flex items-center gap-1.5 truncate">
                                {isFrame ? (
                                    <Sparkles className="size-3.5 shrink-0 text-purple-500" />
                                ) : (
                                    <Film className="size-3.5 shrink-0 text-emerald-500" />
                                )}
                                <span className="font-medium text-xs truncate">{model.name}</span>
                                <span className="text-[10px] bg-stone-500/10 text-stone-600 dark:text-stone-300 px-1 py-0.5 rounded font-mono shrink-0">
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
                    model,
                };
            }),
        }));
    }, [channels]);

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

    const isActiveSupported = isModelSupportedByHost(activeChannel, activeProfile.id);

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
                const vram = profile.vramTier ? `${profile.vramTier} 显存` : "8GB 显存";
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
