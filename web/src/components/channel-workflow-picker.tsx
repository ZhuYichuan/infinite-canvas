import { Select } from "antd";
import { useEffect, useMemo } from "react";
import { Server, Workflow } from "lucide-react";

import {
    getChannelWorkflows,
    getDefaultWorkflow,
    useConfigStore,
    useEffectiveConfig,
    type WorkflowCategory,
} from "@/stores/use-config-store";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

export type ChannelWorkflowPickerProps = {
    category: WorkflowCategory;
    channelId?: string;
    workflowId?: string;
    onChange: (channelId: string, workflowId: string) => void;
    className?: string;
};

export function ChannelWorkflowPicker({
    category,
    channelId,
    workflowId,
    onChange,
    className,
}: ChannelWorkflowPickerProps) {
    const config = useEffectiveConfig();
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    const channels = useMemo(() => config.channels || [], [config.channels]);

    // 当前解析生效的渠道
    const activeChannel = useMemo(() => {
        if (!channels.length) return null;
        return (channelId ? channels.find((c) => c.id === channelId) : null) || channels[0];
    }, [channels, channelId]);

    // 当前渠道下匹配 category 的工作流列表
    const workflows = useMemo(() => {
        if (!activeChannel) return [];
        return getChannelWorkflows(activeChannel, category);
    }, [activeChannel, category]);

    // 当前解析生效的工作流
    const activeWorkflow = useMemo(() => {
        if (!workflows.length) return null;
        return (workflowId ? workflows.find((w) => w.id === workflowId) : null) || getDefaultWorkflow(activeChannel, category) || workflows[0];
    }, [workflows, workflowId, activeChannel, category]);

    // 若当前传入的 channelId 或 workflowId 与实际计算不一致，自动校准
    useEffect(() => {
        if (!activeChannel || !activeWorkflow) return;
        if (activeChannel.id !== channelId || activeWorkflow.id !== workflowId) {
            onChange(activeChannel.id, activeWorkflow.id);
        }
    }, [activeChannel, activeWorkflow, channelId, workflowId, onChange]);

    const handleChannelChange = (nextChannelId: string) => {
        const nextChannel = channels.find((c) => c.id === nextChannelId);
        const defaultWf = nextChannel ? getDefaultWorkflow(nextChannel, category) : undefined;
        onChange(nextChannelId, defaultWf?.id || "");
    };

    const handleWorkflowChange = (nextWorkflowId: string) => {
        if (!activeChannel) return;
        onChange(activeChannel.id, nextWorkflowId);
    };

    if (!channels.length) {
        return (
            <button
                type="button"
                className="text-xs text-red-500 hover:underline"
                onClick={() => openConfigDialog(true)}
            >
                未配置渠道，点击添加
            </button>
        );
    }

    return (
        <div
            className={`flex items-center gap-1.5 ${className || ""}`}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {/* 1. 渠道下拉 */}
            <Select
                size="small"
                value={activeChannel?.id}
                onChange={handleChannelChange}
                className="w-[110px] shrink-0"
                popupMatchSelectWidth={false}
                options={channels.map((c) => ({
                    value: c.id,
                    label: (
                        <span className="flex items-center gap-1 text-xs">
                            <Server className="size-3 shrink-0 text-stone-400" />
                            <span className="truncate">{c.name}</span>
                        </span>
                    ),
                }))}
            />

            {/* 2. 工作流下拉 */}
            <Select
                size="small"
                value={activeWorkflow?.id}
                onChange={handleWorkflowChange}
                className="min-w-[130px] max-w-[170px] flex-1"
                popupMatchSelectWidth={false}
                placeholder={workflows.length ? "选择工作流" : "暂无工作流"}
                options={workflows.map((wf) => ({
                    value: wf.id,
                    label: (
                        <span className="flex items-center gap-1 text-xs">
                            <Workflow className="size-3 shrink-0 text-blue-500" />
                            <span className="truncate">{wf.name}</span>
                            {wf.isDefault && <span className="text-[10px] text-stone-400">·默认</span>}
                        </span>
                    ),
                }))}
            />
        </div>
    );
}
