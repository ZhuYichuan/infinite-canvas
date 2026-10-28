import { Cascader, Tooltip } from "antd";
import { AlertTriangle, Eye, HelpCircle, MessageSquareText, Server, Sparkles } from "lucide-react";
import { useMemo } from "react";

import {
    BUILTIN_TEXT_WORKFLOW_MODELS,
    evaluateModelAvailability,
    getModelProfile,
    textQwen35ChatProfile,
    type WorkflowModelProfile,
} from "@/services/api/models";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { useEffectiveConfig } from "@/stores/use-config-store";

export type TextModelPickerProps = {
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

function getModelIcon(modelId: string) {
    switch (modelId) {
        case "text-qwen-35-vlm":
            return <Eye className="size-3.5 shrink-0 text-indigo-500" />;
        case "text-qwen-35-chat":
        default:
            return <MessageSquareText className="size-3.5 shrink-0 text-emerald-500" />;
    }
}

export function TextModelPicker({
    channelId,
    modelId,
    onChange,
    className = "",
    disabled = false,
    connectedImages = 0,
    connectedVideos = 0,
    connectedAudios = 0,
    promptText = "",
}: TextModelPickerProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const config = useEffectiveConfig();

    const channels = useMemo(() => {
        return config.channels && config.channels.length > 0
            ? config.channels
            : [{ id: "builtin", name: "系统内置 ComfyUI", baseUrl: "http://127.0.0.1:8188", apiKey: "", apiFormat: "comfyui" as const, models: [] }];
    }, [config.channels]);

    const activeChannel = useMemo(() => {
        return (channelId ? channels.find((c) => c.id === channelId) : null) || channels[0];
    }, [channels, channelId]);

    const activeProfile = useMemo(() => {
        return getModelProfile(modelId) || textQwen35ChatProfile;
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
            children: BUILTIN_TEXT_WORKFLOW_MODELS.map((model) => {
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
                                {getModelIcon(model.id)}
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
            disabled={disabled}
            allowClear={false}
            popupClassName="canvas-model-picker-dropdown"
            className={`canvas-compact-control !h-8 !rounded-full !text-xs ${className}`}
            style={{
                background: theme.node.fill,
                borderColor: activeAvailability.isAvailable ? theme.node.stroke : "#f59e0b",
                color: theme.node.text,
            }}
            displayRender={() => (
                <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                    {getModelIcon(activeProfile.id)}
                    <span className="font-semibold text-xs truncate">{activeProfile.name}</span>
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
                            <AlertTriangle className="size-3 text-amber-500 shrink-0" />
                        </Tooltip>
                    )}
                </div>
            )}
        />
    );
}
