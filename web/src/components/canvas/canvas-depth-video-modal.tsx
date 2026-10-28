import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Select, Tag } from "antd";
import { CheckCircle2, Layers, Server, Sparkles, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
    getChannelWorkflows,
    getDefaultWorkflow,
    useConfigStore,
    useEffectiveConfig,
} from "@/stores/use-config-store";
import { getDefaultComfyWorkflowItems, type ComfyWorkflowItem } from "@/services/api/comfyui-default-workflows";
import type { CanvasNodeData } from "@/types/canvas";

export type CanvasDepthVideoModalProps = {
    open: boolean;
    node: CanvasNodeData | null;
    onClose: () => void;
    onConfirm: (payload: { channelId: string; workflowId: string }) => void;
};

export function CanvasDepthVideoModal({
    open,
    node,
    onClose,
    onConfirm,
}: CanvasDepthVideoModalProps) {
    const { t } = useTranslation();
    const config = useEffectiveConfig();
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);

    const channels = useMemo(() => config.channels || [], [config.channels]);

    const initialChannelId = useMemo(() => {
        if (!channels.length) return "";
        if (node?.metadata?.channelId && channels.some((c) => c.id === node.metadata.channelId)) {
            return node.metadata.channelId;
        }
        return config.channelId && channels.some((c) => c.id === config.channelId)
            ? config.channelId
            : channels[0].id;
    }, [channels, config.channelId, node?.metadata?.channelId]);

    const [selectedChannelId, setSelectedChannelId] = useState<string>(initialChannelId);
    const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");

    // 当弹窗打开或节点变化时重置初始值
    useEffect(() => {
        if (!open) return;
        setSelectedChannelId(initialChannelId);
    }, [open, initialChannelId, node]);

    const currentChannel = useMemo(() => {
        return channels.find((c) => c.id === selectedChannelId) || channels[0] || null;
    }, [channels, selectedChannelId]);

    // 获取当前渠道下的深度视频工作流列表
    const depthVideoWorkflows = useMemo((): ComfyWorkflowItem[] => {
        if (!currentChannel) return [];
        const list = getChannelWorkflows(currentChannel, "depthVideo");
        if (list.length > 0) return list;
        return getDefaultComfyWorkflowItems(currentChannel).filter((w) => w.category === "depthVideo");
    }, [currentChannel]);

    // 自动关联默认工作流
    useEffect(() => {
        if (!open || !currentChannel) return;
        const defaultWf =
            getDefaultWorkflow(currentChannel, "depthVideo") ||
            depthVideoWorkflows[0] ||
            getDefaultComfyWorkflowItems(currentChannel).find((w) => w.category === "depthVideo");
        setSelectedWorkflowId(defaultWf?.id || "");
    }, [open, currentChannel, depthVideoWorkflows]);

    const handleConfirm = () => {
        if (!selectedChannelId || !selectedWorkflowId) return;
        onConfirm({
            channelId: selectedChannelId,
            workflowId: selectedWorkflowId,
        });
        onClose();
    };

    const hasVideo = Boolean(node?.metadata?.content);

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 dark:bg-indigo-400/20 dark:text-indigo-400">
                        <Layers className="size-4" />
                    </span>
                    <span className="text-base font-semibold">{t("canvas.depthVideo.modal.title")}</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            centered
            destroyOnHidden
            width={540}
            footer={
                <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-stone-400">
                        {hasVideo ? t("canvas.depthVideo.modal.hasVideo") : t("canvas.depthVideo.modal.noVideo")}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={onClose}>{t("common.cancel")}</Button>
                        <Button
                            type="primary"
                            icon={<Sparkles className="size-3.5" />}
                            disabled={!selectedChannelId || !selectedWorkflowId || !hasVideo}
                            onClick={handleConfirm}
                        >
                            {t("canvas.depthVideo.modal.startDepth")}
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-4 py-2">
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                    {t("canvas.depthVideo.modal.description")}
                </p>

                {/* 1. 执行主机 / 渠道选择 */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <label className="font-medium text-stone-700 dark:text-stone-200">
                            {t("canvas.depthVideo.modal.channelLabel")}
                        </label>
                        <button
                            type="button"
                            onClick={() => openConfigDialog(true, "channels")}
                            className="text-blue-500 hover:underline cursor-pointer"
                        >
                            {t("canvas.depthVideo.modal.manageChannels")}
                        </button>
                    </div>
                    <Select
                        className="w-full"
                        value={selectedChannelId}
                        onChange={(value) => setSelectedChannelId(value)}
                        placeholder={t("canvas.depthVideo.modal.channelPlaceholder")}
                        options={channels.map((c) => {
                            const isDefault = c.id === config.channelId;
                            const hostUrl = c.comfyuiProxyUrl?.trim() || "http://127.0.0.1:8188";
                            return {
                                value: c.id,
                                label: (
                                    <div className="flex items-center justify-between py-0.5">
                                        <span className="flex items-center gap-1.5">
                                            <Server className="size-3.5 text-blue-500 shrink-0" />
                                            <span className="font-medium truncate max-w-[180px]">{c.name}</span>
                                            {isDefault && <Tag className="text-[10px] m-0 px-1 py-0">{t("common.default")}</Tag>}
                                        </span>
                                        <span className="font-mono text-xs text-stone-400 truncate max-w-[200px]">
                                            {hostUrl}
                                        </span>
                                    </div>
                                ),
                            };
                        })}
                    />
                </div>

                {/* 2. 深度视频工作流选择 */}
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-stone-700 dark:text-stone-200">
                        {t("canvas.depthVideo.modal.workflowLabel")}
                    </label>
                    <Select
                        className="w-full"
                        value={selectedWorkflowId}
                        onChange={(value) => setSelectedWorkflowId(value)}
                        placeholder={t("canvas.depthVideo.modal.workflowPlaceholder")}
                        options={depthVideoWorkflows.map((w) => ({
                            value: w.id,
                            label: (
                                <div className="flex items-center justify-between py-0.5">
                                    <span className="flex items-center gap-1.5">
                                        <Workflow className="size-3.5 text-indigo-500 shrink-0" />
                                        <span className="truncate">{w.name}</span>
                                    </span>
                                    {w.isDefault && <Tag className="text-[10px] m-0 px-1 py-0">{t("common.default")}</Tag>}
                                </div>
                            ),
                        }))}
                    />
                </div>

                {/* 3. 目标视频与特性说明 */}
                <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-500 dark:text-stone-400">{t("canvas.depthVideo.modal.videoDetection")}</span>
                        {hasVideo ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="size-3.5" />
                                <span className="truncate max-w-[240px]">{t("canvas.depthVideo.modal.videoReady", { title: node?.title || "" })}</span>
                            </span>
                        ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                                {t("canvas.depthVideo.modal.noVideoContent")}
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-stone-400 leading-normal">
                        {t("canvas.depthVideo.modal.depthTip")}
                    </p>
                </div>
            </div>
        </Modal>
    );
}
