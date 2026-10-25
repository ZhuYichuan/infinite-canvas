import { useMemo } from "react";
import { Drawer, Tag, Select, Button, Empty } from "antd";
import { Cpu, Sparkles, Layers, ArrowRight, CornerDownRight, X, ExternalLink } from "lucide-react";
import type { ComfyFlowNodeData, ComfyFlowEdgeData } from "./comfy-flow-types";
import type { ComfyuiModelItem } from "@/services/api/comfyui";

interface ComfyFlowDrawerProps {
    node: ComfyFlowNodeData | null;
    open: boolean;
    onClose: () => void;
    edges: ComfyFlowEdgeData[];
    allNodesMap: Map<string, ComfyFlowNodeData>;
    onSelectNode: (nodeId: string) => void;
    modelsMap?: Record<string, { loading: boolean; error?: string; items: ComfyuiModelItem[] }>;
    onModelChange?: (nodeId: string, inputKey: string, nextValue: string) => void;
    onReloadModels?: (category: string, force?: boolean) => void;
    onSlotOverride?: (nodeId: string, slotTitle: string) => void;
}

const COMMON_SLOT_OPTIONS = [
    { value: "", label: "普通节点 (无保留槽位)" },
    {
        label: "提示词与文本输入",
        options: [
            { value: "prompt", label: "正向提示词 (prompt)" },
            { value: "negative_prompt", label: "负向提示词 (negative_prompt)" },
            { value: "text", label: "通用文本输入 (text)" },
        ],
    },
    {
        label: "采样与尺寸控制",
        options: [
            { value: "seed", label: "采样种子 (seed)" },
            { value: "width", label: "画布宽度 (width)" },
            { value: "height", label: "画布高度 (height)" },
            { value: "duration", label: "视频时长 (duration)" },
        ],
    },
    {
        label: "参考资源与垫图",
        options: [
            { value: "ref_image_01", label: "参考图 01 (ref_image_01)" },
            { value: "ref_image_02", label: "参考图 02 (ref_image_02)" },
            { value: "ref_image_03", label: "参考图 03 (ref_image_03)" },
            { value: "ref_mask", label: "局部重绘遮罩 (ref_mask)" },
            { value: "first_frame", label: "视频首帧 (first_frame)" },
            { value: "last_frame", label: "视频尾帧 (last_frame)" },
        ],
    },
    {
        label: "模型与选择器",
        options: [
            { value: "select_models_diffusion_models", label: "Diffusion 模型库 (select_models_diffusion_models)" },
            { value: "select_models_checkpoints", label: "Checkpoint 大模型 (select_models_checkpoints)" },
            { value: "select_models_unet", label: "UNet 权重库 (select_models_unet)" },
            { value: "select_models_loras", label: "LoRA 权重库 (select_models_loras)" },
            { value: "select_models_clip", label: "CLIP 文本编码器 (select_models_clip)" },
            { value: "select_models_vae", label: "VAE 变分编码器 (select_models_vae)" },
        ],
    },
    {
        label: "最终生成产物输出",
        options: [
            { value: "output_image", label: "输出图片 (output_image)" },
            { value: "output_video", label: "输出视频 (output_video)" },
            { value: "output_audio", label: "输出音频 (output_audio)" },
            { value: "output_text", label: "输出文本 (output_text)" },
        ],
    },
];

export function ComfyFlowDrawer({
    node,
    open,
    onClose,
    edges,
    allNodesMap,
    onSelectNode,
    modelsMap,
    onModelChange,
    onReloadModels,
    onSlotOverride,
}: ComfyFlowDrawerProps) {
    if (!node) return null;

    // 查找流入当前节点的边
    const incomingEdges = useMemo(() => {
        return edges.filter((e) => e.toNodeId === node.id);
    }, [edges, node.id]);

    // 查找流出当前节点的边
    const outgoingEdges = useMemo(() => {
        return edges.filter((e) => e.fromNodeId === node.id);
    }, [edges, node.id]);

    // 模型选择器相关信息
    const isModelSelector = Boolean(node.modelType);
    const modelCategoryKey = node.modelType || "";
    const modelState = modelsMap?.[modelCategoryKey];
    const modelItems = modelState?.items || [];
    const isModelLoading = modelState?.loading;

    // 探测当前节点中对应的模型 inputKey (与 ComfyUI 工作流标准契约一致)
    const targetModelInputKey = useMemo(() => {
        if (!isModelSelector) return null;
        const modelType = node.modelType || "";
        let candidateKeys: string[] = [];

        if (modelType === "diffusion_models" || modelType === "unet") {
            candidateKeys = ["unet_name", "model_name", "diffusion_model_name", "value"];
        } else if (modelType === "clip" || modelType === "text_encoders") {
            candidateKeys = ["clip_name", "text_encoder_name", "clip_name1", "value"];
        } else if (modelType === "checkpoints" || modelType === "checkpoint") {
            candidateKeys = ["ckpt_name", "model_name", "value"];
        } else if (modelType === "vae") {
            candidateKeys = ["vae_name", "value"];
        } else if (modelType === "loras" || modelType === "lora") {
            candidateKeys = ["lora_name", "value"];
        } else if (modelType === "controlnet") {
            candidateKeys = ["control_net_name", "value"];
        } else {
            candidateKeys = [`${modelType}_name`, "model_name", "name", "value"];
        }

        for (const cand of candidateKeys) {
            if (cand in node.inputs && !Array.isArray(node.inputs[cand])) {
                return cand;
            }
        }

        // 探测未命中的字符串入参（排除控制类参数）
        for (const [k, v] of Object.entries(node.inputs)) {
            if (typeof v === "string" && !Array.isArray(v) && !["device", "weight_dtype", "type"].includes(k)) {
                return k;
            }
        }
        return "model_name";
    }, [isModelSelector, node.modelType, node.inputs]);

    const currentModelValue = targetModelInputKey ? String(node.inputs[targetModelInputKey] || "") : "";

    const slotOptions = useMemo(() => {
        if (!node.slotTitle) return COMMON_SLOT_OPTIONS;
        const exists = COMMON_SLOT_OPTIONS.some((group) =>
            "options" in group ? group.options.some((opt) => opt.value === node.slotTitle) : group.value === node.slotTitle,
        );
        if (!exists) {
            return [
                { value: node.slotTitle, label: `当前自定义标记: ${node.slotTitle}` },
                ...COMMON_SLOT_OPTIONS,
            ];
        }
        return COMMON_SLOT_OPTIONS;
    }, [node.slotTitle]);

    return (
        <Drawer
            title={
                <div className="flex items-center justify-between pr-4">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-stone-500">#{node.id}</span>
                        <span className="font-semibold text-base text-stone-900 dark:text-stone-100 truncate max-w-[200px]">
                            {node.title}
                        </span>
                    </div>
                    {node.slotCategory && node.slotCategory !== "general" && (
                        <Tag color={node.slotCategory === "output" ? "green" : node.slotCategory === "model" ? "purple" : "blue"}>
                            {node.slotCategory.toUpperCase()}
                        </Tag>
                    )}
                </div>
            }
            placement="right"
            width={380}
            open={open}
            onClose={onClose}
            styles={{
                body: { padding: "16px", overflowY: "auto" },
                header: { padding: "14px 16px" },
            }}
        >
            <div className="space-y-5 text-xs text-stone-700 dark:text-stone-300">
                {/* 基础元数据 */}
                <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3.5 space-y-2 dark:border-stone-800 dark:bg-stone-900/40">
                    <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                        节点类型 (Class Type)
                    </div>
                    <div className="font-mono text-xs font-medium text-stone-900 dark:text-stone-100 select-all">
                        {node.classType}
                    </div>

                    {node.slotTitle && (
                        <>
                            <div className="mt-2 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                                槽位标记 (_meta.title)
                            </div>
                            <div className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                                {node.slotTitle}
                            </div>
                        </>
                    )}
                </div>

                {/* 交互式插槽指派 (若提供了 onSlotOverride) */}
                {onSlotOverride && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-2.5 dark:border-blue-900/60 dark:bg-blue-950/20">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                                <Sparkles className="size-3.5 text-blue-500" />
                                画布槽位指派 (Slot Override)
                            </span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-[11px] text-stone-500">
                                覆盖当前节点的画布保留槽位角色：
                            </div>
                            <Select
                                className="w-full"
                                showSearch
                                value={node.slotTitle || ""}
                                placeholder="选择分配给画布的槽位"
                                options={slotOptions}
                                onChange={(val) => onSlotOverride(node.id, val)}
                            />
                        </div>
                    </div>
                )}

                {/* 动态大模型切换 (若为 select_models_* 节点) */}
                {isModelSelector && targetModelInputKey && (
                    <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 space-y-2.5 dark:border-purple-900/60 dark:bg-purple-950/20">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                                <Cpu className="size-3.5 text-purple-500" />
                                动态模型配置
                            </span>
                            {onReloadModels && (
                                <Button
                                    size="small"
                                    type="text"
                                    loading={isModelLoading}
                                    onClick={() => onReloadModels(modelCategoryKey, true)}
                                >
                                    刷新
                                </Button>
                            )}
                        </div>

                        <div className="space-y-1">
                            <div className="text-[11px] text-stone-500">
                                匹配字段: <code className="font-mono text-purple-600 dark:text-purple-400">{targetModelInputKey}</code>
                            </div>
                            <Select
                                className="w-full"
                                showSearch
                                value={currentModelValue || undefined}
                                loading={isModelLoading}
                                placeholder={isModelLoading ? "正在拉取可用模型..." : "选择对应模型"}
                                options={modelItems.map((m) => ({
                                    value: m.name,
                                    label: m.name,
                                }))}
                                onChange={(val) => {
                                    if (targetModelInputKey && onModelChange) {
                                        onModelChange(node.id, targetModelInputKey, val);
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* 输入依赖 (Incoming Inputs) */}
                <div className="space-y-2">
                    <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 flex items-center justify-between">
                        <span>输入端口与连线 ({node.inputPorts.length})</span>
                    </div>

                    {node.inputPorts.length === 0 ? (
                        <div className="text-[11px] text-stone-400 py-1">无输入参数</div>
                    ) : (
                        <div className="space-y-1.5">
                            {node.inputPorts.map((port) => {
                                const edge = incomingEdges.find((e) => e.toInputKey === port.name);
                                const upstreamNode = edge ? allNodesMap.get(edge.fromNodeId) : null;

                                return (
                                    <div
                                        key={port.id}
                                        className="rounded-lg border border-stone-200/80 bg-white p-2 dark:border-stone-800 dark:bg-stone-900/60"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono font-medium text-stone-800 dark:text-stone-200">
                                                {port.name}
                                            </span>
                                            <span className="text-[10px] text-stone-400 font-mono">
                                                {port.type || "ANY"}
                                            </span>
                                        </div>

                                        {edge && upstreamNode ? (
                                            <div
                                                className="mt-1.5 flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                                                onClick={() => onSelectNode(upstreamNode.id)}
                                            >
                                                <CornerDownRight className="size-3 text-stone-400" />
                                                <span>来自 #{upstreamNode.id} ({upstreamNode.title}) [Slot {edge.fromSlot}]</span>
                                            </div>
                                        ) : (
                                            <div className="mt-1 text-[11px] text-stone-500 font-mono truncate">
                                                值: {String(node.inputs[port.name] ?? "未连接")}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 输出流向 (Outgoing Downstream) */}
                <div className="space-y-2">
                    <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 flex items-center justify-between">
                        <span>输出流向 ({outgoingEdges.length})</span>
                    </div>

                    {outgoingEdges.length === 0 ? (
                        <div className="text-[11px] text-stone-400 py-1">
                            {node.slotCategory === "output" ? "最终输出节点（无下游消费）" : "暂未被下游节点引用"}
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {outgoingEdges.map((edge) => {
                                const downstreamNode = allNodesMap.get(edge.toNodeId);
                                if (!downstreamNode) return null;

                                return (
                                    <div
                                        key={edge.id}
                                        className="flex items-center justify-between rounded-lg border border-stone-200/80 bg-white p-2 cursor-pointer transition hover:border-blue-400 dark:border-stone-800 dark:bg-stone-900/60 dark:hover:border-blue-500"
                                        onClick={() => onSelectNode(downstreamNode.id)}
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <ArrowRight className="size-3 text-stone-400 shrink-0" />
                                            <span className="truncate text-stone-800 dark:text-stone-200 font-medium">
                                                #{downstreamNode.id} ({downstreamNode.title})
                                            </span>
                                        </div>
                                        <span className="font-mono text-[10px] text-stone-400 shrink-0">
                                            .{edge.toInputKey}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </Drawer>
    );
}
