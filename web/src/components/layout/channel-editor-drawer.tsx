import { App, Button, Drawer, Input, Space, Popconfirm, Tag, Tooltip } from "antd";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, Plus, Trash2, Check, RotateCcw, Upload, FileCode, CheckCircle2 } from "lucide-react";
import { nanoid } from "nanoid";

import { checkComfyuiConnection, isMixedContentHttp, notifyMixedContentBlocked, validateComfyuiWorkflow } from "@/services/api/comfyui";
import {
    normalizeChannelModels,
    type ComfyWorkflowItem,
    type WorkflowCategory,
    type ModelChannel,
} from "@/stores/use-config-store";
import { getDefaultComfyWorkflowItems } from "@/services/api/comfyui-default-workflows";

const WORKFLOW_CATEGORIES: Array<{ key: WorkflowCategory; title: string; desc: string }> = [
    { key: "t2i", title: "文生图工作流", desc: "文本生成图像（必标 prompt、output_image）" },
    { key: "i2i", title: "图生图工作流", desc: "参考图垫图生成（必标 prompt、ref_image_01、output_image）" },
    { key: "inpaint", title: "局部编辑工作流", desc: "遮罩重绘修图（必标 ref_image_01、ref_mask、output_image）" },
    { key: "text", title: "文本生成工作流", desc: "大语言模型问答与反推（必标 prompt、output_text）" },
    { key: "omniVideo", title: "全能参考视频工作流", desc: "多模态参考生视频（必标 prompt、output_video）" },
    { key: "frameVideo", title: "首尾帧视频工作流", desc: "首尾关键帧生视频（必标 first_frame、last_frame、output_video）" },
];

function formatWorkflowSize(json: Record<string, unknown>) {
    const bytes = JSON.stringify(json).length;
    return bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`;
}

export function ChannelEditorDrawer({ open, channel, onSave, onClose }: { open: boolean; channel: ModelChannel | null; onSave: (channel: ModelChannel) => void; onClose: () => void }) {
    type ProxyFieldErrors = { url?: string; token?: string };
    const { t } = useTranslation();
    const [draft, setDraft] = useState<ModelChannel | null>(channel);
    const [proxyErrors, setProxyErrors] = useState<ProxyFieldErrors>({});
    const [testingConnection, setTestingConnection] = useState(false);
    const { message } = App.useApp();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingCategoryRef = useRef<WorkflowCategory | null>(null);

    const handleTestConnection = async () => {
        const url = (draft?.comfyuiProxyUrl || "").trim() || "http://127.0.0.1:8188";
        setTestingConnection(true);
        try {
            const res = await checkComfyuiConnection(url, draft?.comfyuiProxyToken);
            if (res.ok) {
                message.success("ComfyUI 服务连接成功！");
            } else if (res.error === "MIXED_CONTENT") {
                // Guideline modal is automatically displayed via event
            } else {
                message.error(`连接失败: ${res.error || "无法访问服务，请检查服务是否已启动"}`);
            }
        } finally {
            setTestingConnection(false);
        }
    };

    useEffect(() => {
        if (open && channel) {
            const defaults = getDefaultComfyWorkflowItems(channel);
            const workflows = Array.isArray(channel.workflows) && channel.workflows.length > 0 ? channel.workflows : defaults;
            setDraft({ ...channel, workflows });
            setProxyErrors({});
        }
    }, [open, channel]);

    if (!draft) return null;

    const patch = (value: Partial<ModelChannel>) => setDraft((current) => (current ? { ...current, ...value } : current));

    const currentWorkflows: ComfyWorkflowItem[] = Array.isArray(draft.workflows) && draft.workflows.length > 0
        ? draft.workflows
        : getDefaultComfyWorkflowItems(draft);

    const setWorkflows = (workflows: ComfyWorkflowItem[]) => {
        patch({ workflows });
    };

    const handleTriggerUpload = (category: WorkflowCategory) => {
        pendingCategoryRef.current = category;
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const category = pendingCategoryRef.current;
        if (!file || !category) return;
        try {
            const text = await file.text();
            const parsed: unknown = JSON.parse(text);
            const validation = validateComfyuiWorkflow(parsed, category);
            if (!validation.ok) {
                message.error(`工作流协议校验失败: ${validation.error}`);
                return;
            }

            const rawName = file.name.replace(/\.[^/.]+$/, "");
            const existingInCat = currentWorkflows.filter((w) => w.category === category);
            const newWorkflow: ComfyWorkflowItem = {
                id: nanoid(),
                name: rawName || `${category}-workflow-${existingInCat.length + 1}`,
                category,
                json: parsed as Record<string, unknown>,
                createdAt: Date.now(),
                isBuiltin: false,
                isDefault: existingInCat.length === 0,
            };

            setWorkflows([...currentWorkflows, newWorkflow]);
            message.success(`成功添加工作流 "${newWorkflow.name}"！`);
        } catch {
            message.error("解析文件失败，请确保上传的是有效的 JSON 格式工作流");
        }
    };

    const handleSetDefault = (category: WorkflowCategory, id: string) => {
        const next = currentWorkflows.map((w) => {
            if (w.category === category) {
                return { ...w, isDefault: w.id === id };
            }
            return w;
        });
        setWorkflows(next);
        message.success("已更新默认工作流");
    };

    const handleRemove = (category: WorkflowCategory, id: string) => {
        const target = currentWorkflows.find((w) => w.id === id);
        if (target?.isBuiltin) {
            message.warning("系统内置工作流不可删除");
            return;
        }
        const filtered = currentWorkflows.filter((w) => w.id !== id);
        const remainingInCat = filtered.filter((w) => w.category === category);
        if (target?.isDefault && remainingInCat.length > 0) {
            remainingInCat[0].isDefault = true;
        }
        setWorkflows(filtered);
        message.success("工作流已删除");
    };

    const handleResetCategory = (category: WorkflowCategory) => {
        const defaults = getDefaultComfyWorkflowItems(draft).filter((w) => w.category === category);
        const others = currentWorkflows.filter((w) => w.category !== category);
        setWorkflows([...others, ...defaults]);
        message.success("已恢复内置默认工作流");
    };

    const save = () => {
        const errors: ProxyFieldErrors = {};
        let proxyUrl = (draft.comfyuiProxyUrl || "").trim();
        if (!proxyUrl && draft.id === "local") {
            proxyUrl = "http://127.0.0.1:8188";
        } else if (proxyUrl && !/^https?:\/\//i.test(proxyUrl)) {
            proxyUrl = `http://${proxyUrl}`;
        }
        if (proxyUrl && !/^https?:\/\/.+/i.test(proxyUrl)) {
            errors.url = t("config.channelEditor.comfyuiProxyUrlError");
        }
        setProxyErrors(errors);
        if (Object.keys(errors).length) return;

        const savedWorkflows = currentWorkflows;
        const t2iDef = savedWorkflows.find((w) => w.category === "t2i" && w.isDefault) || savedWorkflows.find((w) => w.category === "t2i");
        const i2iDef = savedWorkflows.find((w) => w.category === "i2i" && w.isDefault) || savedWorkflows.find((w) => w.category === "i2i");
        const inpaintDef = savedWorkflows.find((w) => w.category === "inpaint" && w.isDefault) || savedWorkflows.find((w) => w.category === "inpaint");
        const textDef = savedWorkflows.find((w) => w.category === "text" && w.isDefault) || savedWorkflows.find((w) => w.category === "text");
        const videoDef = savedWorkflows.find((w) => w.category === "omniVideo" && w.isDefault) || savedWorkflows.find((w) => w.category === "omniVideo");
        const frameDef = savedWorkflows.find((w) => w.category === "frameVideo" && w.isDefault) || savedWorkflows.find((w) => w.category === "frameVideo");

        onSave({
            ...draft,
            name: draft.name.trim() || t("config.channels.unnamed"),
            comfyuiProxyUrl: proxyUrl,
            workflows: savedWorkflows,
            models: normalizeChannelModels(draft.models),
            comfyuiT2iWorkflow: t2iDef ? { name: t2iDef.name, json: t2iDef.json, createdAt: t2iDef.createdAt, isBuiltin: t2iDef.isBuiltin } : undefined,
            comfyuiI2iWorkflow: i2iDef ? { name: i2iDef.name, json: i2iDef.json, createdAt: i2iDef.createdAt, isBuiltin: i2iDef.isBuiltin } : undefined,
            comfyuiInpaintWorkflow: inpaintDef ? { name: inpaintDef.name, json: inpaintDef.json, createdAt: inpaintDef.createdAt, isBuiltin: inpaintDef.isBuiltin } : undefined,
            comfyuiTextWorkflow: textDef ? { name: textDef.name, json: textDef.json, createdAt: textDef.createdAt, isBuiltin: textDef.isBuiltin } : undefined,
            comfyuiVideoWorkflow: videoDef ? { name: videoDef.name, json: videoDef.json, createdAt: videoDef.createdAt, isBuiltin: videoDef.isBuiltin } : undefined,
            comfyuiFrameVideoWorkflow: frameDef ? { name: frameDef.name, json: frameDef.json, createdAt: frameDef.createdAt, isBuiltin: frameDef.isBuiltin } : undefined,
        });
        onClose();
    };

    return (
        <Drawer
            open={open}
            width={680}
            title={t("config.channelEditor.title")}
            onClose={onClose}
            styles={{ body: { paddingTop: 16 } }}
            extra={
                <Space>
                    <Button onClick={onClose}>{t("common.cancel")}</Button>
                    <Button type="primary" onClick={save}>
                        {t("common.save")}
                    </Button>
                </Space>
            }
        >
            <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.name")}</span>
                    <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.protocol")}</span>
                    <Input value="ComfyUI" disabled />
                </label>
                <div className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.comfyuiProxyUrl")}</span>
                    <Space.Compact style={{ width: "100%" }}>
                        <Input
                            value={draft.comfyuiProxyUrl || ""}
                            status={proxyErrors.url ? "error" : undefined}
                            onChange={(event) => {
                                patch({ comfyuiProxyUrl: event.target.value });
                                if (proxyErrors.url) setProxyErrors((current) => ({ ...current, url: undefined }));
                            }}
                            placeholder="http://127.0.0.1:8188"
                        />
                        <Button loading={testingConnection} onClick={handleTestConnection}>
                            测试连接
                        </Button>
                    </Space.Compact>
                    {proxyErrors.url ? <div className="mt-1 text-xs text-red-500">{proxyErrors.url}</div> : null}
                    {isMixedContentHttp(draft.comfyuiProxyUrl || "http://127.0.0.1:8188") && (
                        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/90 p-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1 font-medium">
                                    <ShieldAlert className="size-3.5 shrink-0 text-amber-500" />
                                    HTTPS 访问本地 HTTP 提示
                                </span>
                                <button
                                    type="button"
                                    className="cursor-pointer font-normal text-blue-600 hover:underline dark:text-blue-400"
                                    onClick={() => notifyMixedContentBlocked(draft.comfyuiProxyUrl || "http://127.0.0.1:8188")}
                                >
                                    查看放行指引
                                </button>
                            </div>
                            <p className="mt-1 text-[11px] leading-relaxed text-stone-600 dark:text-stone-300">
                                当前站点运行在 HTTPS 下，直连本地 HTTP 会被浏览器安全拦截。请在地址栏左侧点击<strong>「锁头」图标</strong> -&gt; 将<strong>「不安全内容」</strong>设为<strong>「允许」</strong>并刷新；本地 ComfyUI 需携带 <code>--enable-cors-header "*"</code> 启动。
                            </p>
                        </div>
                    )}
                </div>
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.comfyuiProxyToken")}</span>
                    <Input.Password
                        value={draft.comfyuiProxyToken || ""}
                        status={proxyErrors.token ? "error" : undefined}
                        onChange={(event) => {
                            patch({ comfyuiProxyToken: event.target.value });
                            if (proxyErrors.token) setProxyErrors((current) => ({ ...current, token: undefined }));
                        }}
                        placeholder={t("config.channelEditor.comfyuiProxyTokenPlaceholder")}
                    />
                    {proxyErrors.token ? <div className="mt-1 text-xs text-red-500">{proxyErrors.token}</div> : null}
                </label>
            </div>

            <div className="mt-6 border-t border-stone-200 pt-5 dark:border-stone-800">
                <div className="mb-4">
                    <div className="text-base font-semibold">工作流管理（6 大分类）</div>
                    <div className="mt-0.5 text-xs text-stone-500">
                        每个分类下可添加多个独立工作流。上传时需包含完整的 <code>_meta.title</code> 槽位协议标注。
                    </div>
                </div>

                <div className="space-y-5">
                    {WORKFLOW_CATEGORIES.map((cat) => {
                        const items = currentWorkflows.filter((w) => w.category === cat.key);
                        return (
                            <div key={cat.key} className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-3.5 dark:border-stone-800 dark:bg-stone-900/30">
                                <div className="mb-2.5 flex items-center justify-between gap-2">
                                    <div>
                                        <div className="text-sm font-semibold text-stone-800 dark:text-stone-200">{cat.title}</div>
                                        <div className="text-[11px] text-stone-500">{cat.desc}</div>
                                    </div>
                                    <Space size="small">
                                        <Button
                                            size="small"
                                            icon={<Plus className="size-3.5" />}
                                            onClick={() => handleTriggerUpload(cat.key)}
                                        >
                                            添加工作流
                                        </Button>
                                        <Tooltip title="重置回系统内置默认工作流">
                                            <Button
                                                size="small"
                                                icon={<RotateCcw className="size-3" />}
                                                onClick={() => handleResetCategory(cat.key)}
                                            />
                                        </Tooltip>
                                    </Space>
                                </div>

                                <div className="space-y-1.5">
                                    {items.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-stone-200 py-3 text-center text-xs text-stone-400 dark:border-stone-800">
                                            暂无工作流，请点击右上角添加
                                        </div>
                                    ) : (
                                        items.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs transition ${
                                                    item.isDefault
                                                        ? "border-blue-300 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20"
                                                        : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950/40"
                                                }`}
                                            >
                                                <div className="min-w-0 flex-1 truncate">
                                                    <div className="flex items-center gap-1.5 font-medium text-stone-800 dark:text-stone-200">
                                                        <FileCode className="size-3.5 shrink-0 text-stone-400" />
                                                        <span className="truncate">{item.name}</span>
                                                        {item.isBuiltin && <Tag color="default" className="!mr-0 !text-[10px]">内置</Tag>}
                                                        {item.isDefault && (
                                                            <Tag color="blue" className="!mr-0 !text-[10px] flex items-center gap-0.5">
                                                                <CheckCircle2 className="size-2.5" /> 默认
                                                            </Tag>
                                                        )}
                                                        <span className="ml-1 text-[10px] font-normal text-stone-400">
                                                            {formatWorkflowSize(item.json)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <Space size="small" className="shrink-0">
                                                    {!item.isDefault && (
                                                        <Button
                                                            size="small"
                                                            type="link"
                                                            className="!h-6 !px-1 text-xs"
                                                            onClick={() => handleSetDefault(cat.key, item.id)}
                                                        >
                                                            设为默认
                                                        </Button>
                                                    )}
                                                    {!item.isBuiltin && (
                                                        <Popconfirm
                                                            title="确认删除该工作流？"
                                                            onConfirm={() => handleRemove(cat.key, item.id)}
                                                            okText="删除"
                                                            cancelText="取消"
                                                        >
                                                            <Button
                                                                size="small"
                                                                type="text"
                                                                danger
                                                                className="!h-6 !w-6 !p-0"
                                                                icon={<Trash2 className="size-3.5" />}
                                                            />
                                                        </Popconfirm>
                                                    )}
                                                </Space>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 隐藏的文件上传 input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileChange}
            />
        </Drawer>
    );
}
