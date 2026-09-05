import { App, Button, Drawer, Input, Space } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";

import { checkComfyuiConnection, isMixedContentHttp, notifyMixedContentBlocked } from "@/services/api/comfyui";
import { normalizeChannelModels, type ChannelModel, type ComfyuiWorkflow, type ModelChannel } from "@/stores/use-config-store";
import {
    DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW,
    DEFAULT_COMFYUI_I2I_WORKFLOW,
    DEFAULT_COMFYUI_INPAINT_WORKFLOW,
    DEFAULT_COMFYUI_T2I_WORKFLOW,
    DEFAULT_COMFYUI_TEXT_WORKFLOW,
    DEFAULT_COMFYUI_VIDEO_WORKFLOW,
} from "@/services/api/comfyui-default-workflows";
import { ComfyuiWorkflowEditor } from "./comfyui-workflow-editor";

export function ChannelEditorDrawer({ open, channel, onSave, onClose }: { open: boolean; channel: ModelChannel | null; onSave: (channel: ModelChannel) => void; onClose: () => void }) {
    type ProxyFieldErrors = { url?: string; token?: string };
    const { t } = useTranslation();
    const [draft, setDraft] = useState<ModelChannel | null>(channel);
    const [proxyErrors, setProxyErrors] = useState<ProxyFieldErrors>({});
    const [testingConnection, setTestingConnection] = useState(false);
    const { message } = App.useApp();

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
            setDraft(channel);
            setProxyErrors({});
        }
    }, [open, channel]);

    if (!draft) return null;

    const patch = (value: Partial<ModelChannel>) => setDraft((current) => (current ? { ...current, ...value } : current));
    const setModels = (models: ChannelModel[]) => patch({ models });

    const setComfyuiInpaintWorkflow = (workflow: ComfyuiWorkflow | undefined) => {
        setDraft((current) => {
            if (!current) return current;
            const models = current.models.map((m) =>
                m.name === "ComfyUI Inpaint" || m.name.toLowerCase().includes("inpaint") || m.name.includes("局部编辑")
                    ? { ...m, comfyuiWorkflow: workflow }
                    : m,
            );
            return { ...current, comfyuiInpaintWorkflow: workflow, models };
        });
    };
    const setComfyuiTextWorkflow = (workflow: ComfyuiWorkflow | undefined) => {
        setDraft((current) => {
            if (!current) return current;
            const models = current.models.map((m) =>
                m.name === "ComfyUI LLM" || m.capability === "text"
                    ? { ...m, comfyuiWorkflow: workflow }
                    : m,
            );
            return { ...current, comfyuiTextWorkflow: workflow, models };
        });
    };
    const setComfyuiVideoWorkflow = (workflow: ComfyuiWorkflow | undefined) => {
        setDraft((current) => {
            if (!current) return current;
            const models = current.models.map((m) =>
                m.name === "ComfyUI Video" ? { ...m, comfyuiWorkflow: workflow } : m,
            );
            return { ...current, comfyuiVideoWorkflow: workflow, models };
        });
    };
    const setComfyuiFrameVideoWorkflow = (workflow: ComfyuiWorkflow | undefined) => {
        setDraft((current) => {
            if (!current) return current;
            const targetName = current.models.find((m) => m.name === "ComfyUI Frame Video" || m.name.toLowerCase().includes("frame") || m.name.includes("首尾帧"))?.name || "ComfyUI Frame Video";
            const models = current.models.some((m) => m.name === targetName)
                ? current.models.map((m) => (m.name === targetName ? { ...m, comfyuiWorkflow: workflow } : m))
                : [...current.models, { name: targetName, capability: "video" as const, comfyuiWorkflow: workflow }];
            return { ...current, comfyuiFrameVideoWorkflow: workflow, models };
        });
    };
    const setComfyuiI2iWorkflow = (workflow: ComfyuiWorkflow | undefined) => {
        setDraft((current) => {
            if (!current) return current;
            const targetName = current.models.find((m) => m.name === "ComfyUI I2I")?.name || "ComfyUI I2I";
            const models = current.models.some((m) => m.name === targetName)
                ? current.models.map((m) => (m.name === targetName ? { ...m, comfyuiWorkflow: workflow } : m))
                : [...current.models, { name: targetName, capability: "image" as const, comfyuiWorkflow: workflow }];
            return { ...current, comfyuiI2iWorkflow: workflow, models };
        });
    };
    const setComfyuiT2iWorkflow = (workflow: ComfyuiWorkflow | undefined) => {
        setDraft((current) => {
            if (!current) return current;
            const targetName = current.models.find((m) => m.name === "ComfyUI T2I")?.name || current.models[0]?.name || "ComfyUI T2I";
            const models = current.models.some((m) => m.name === targetName)
                ? current.models.map((m) => (m.name === targetName ? { ...m, comfyuiWorkflow: workflow } : m))
                : [...current.models, { name: targetName, capability: "image" as const, comfyuiWorkflow: workflow }];
            return { ...current, comfyuiT2iWorkflow: workflow, models };
        });
    };

    const save = () => {
        const errors: ProxyFieldErrors = {};
        const proxyUrl = (draft.comfyuiProxyUrl || "").trim();
        if (!/^https?:\/\/.+/.test(proxyUrl)) errors.url = t("config.channelEditor.comfyuiProxyUrlError");
        setProxyErrors(errors);
        if (Object.keys(errors).length) return;
        onSave({ ...draft, name: draft.name.trim() || t("config.channels.unnamed"), models: normalizeChannelModels(draft.models) });
        onClose();
    };

    return (
        <Drawer
            open={open}
            width={640}
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

            {draft.apiFormat === "comfyui" && (
                <>
                    <div className="mt-5 space-y-2">
                        <div>
                            <div className="text-sm font-semibold">{t("config.channelEditor.t2iWorkflowTitle")}</div>
                            <div className="mt-0.5 text-xs text-stone-500">{t("config.channelEditor.t2iWorkflowDesc")}</div>
                        </div>
                        <div className="rounded-lg border border-stone-200 p-2.5 dark:border-stone-800">
                            <ComfyuiWorkflowEditor
                                value={draft.comfyuiT2iWorkflow || draft.models.find((m) => m.name === "ComfyUI T2I")?.comfyuiWorkflow || draft.models[0]?.comfyuiWorkflow}
                                defaultWorkflow={DEFAULT_COMFYUI_T2I_WORKFLOW}
                                onChange={setComfyuiT2iWorkflow}
                            />
                        </div>
                    </div>

                    <div className="mt-5 space-y-2">
                        <div>
                            <div className="text-sm font-semibold">{t("config.channelEditor.i2iWorkflowTitle")}</div>
                            <div className="mt-0.5 text-xs text-stone-500">{t("config.channelEditor.i2iWorkflowDesc")}</div>
                        </div>
                        <div className="rounded-lg border border-stone-200 p-2.5 dark:border-stone-800">
                            <ComfyuiWorkflowEditor
                                value={draft.comfyuiI2iWorkflow || draft.models.find((m) => m.name === "ComfyUI I2I")?.comfyuiWorkflow}
                                defaultWorkflow={DEFAULT_COMFYUI_I2I_WORKFLOW}
                                onChange={setComfyuiI2iWorkflow}
                            />
                        </div>
                    </div>

                    <div className="mt-5 space-y-2">
                        <div>
                            <div className="text-sm font-semibold">{t("config.channelEditor.inpaintWorkflowTitle")}</div>
                            <div className="mt-0.5 text-xs text-stone-500">{t("config.channelEditor.inpaintWorkflowDesc")}</div>
                        </div>
                        <div className="rounded-lg border border-stone-200 p-2.5 dark:border-stone-800">
                            <ComfyuiWorkflowEditor
                                value={draft.comfyuiInpaintWorkflow || draft.models.find((m) => m.name === "ComfyUI Inpaint")?.comfyuiWorkflow}
                                defaultWorkflow={DEFAULT_COMFYUI_INPAINT_WORKFLOW}
                                onChange={setComfyuiInpaintWorkflow}
                            />
                        </div>
                    </div>

                    <div className="mt-5 space-y-2">
                        <div>
                            <div className="text-sm font-semibold">{t("config.channelEditor.textWorkflowTitle")}</div>
                            <div className="mt-0.5 text-xs text-stone-500">{t("config.channelEditor.textWorkflowDesc")}</div>
                        </div>
                        <div className="rounded-lg border border-stone-200 p-2.5 dark:border-stone-800">
                            <ComfyuiWorkflowEditor
                                value={draft.comfyuiTextWorkflow || draft.models.find((m) => m.name === "ComfyUI LLM" || m.capability === "text")?.comfyuiWorkflow}
                                defaultWorkflow={DEFAULT_COMFYUI_TEXT_WORKFLOW}
                                onChange={setComfyuiTextWorkflow}
                            />
                        </div>
                    </div>

                    <div className="mt-5 space-y-2">
                        <div>
                            <div className="text-sm font-semibold">{t("config.channelEditor.videoWorkflowTitle")}</div>
                            <div className="mt-0.5 text-xs text-stone-500">{t("config.channelEditor.videoWorkflowDesc")}</div>
                        </div>
                        <div className="rounded-lg border border-stone-200 p-2.5 dark:border-stone-800">
                            <ComfyuiWorkflowEditor
                                value={draft.comfyuiVideoWorkflow || draft.models.find((m) => m.name === "ComfyUI Video")?.comfyuiWorkflow}
                                defaultWorkflow={DEFAULT_COMFYUI_VIDEO_WORKFLOW}
                                onChange={setComfyuiVideoWorkflow}
                            />
                        </div>
                    </div>

                    <div className="mt-5 space-y-2">
                        <div>
                            <div className="text-sm font-semibold">{t("config.channelEditor.frameVideoWorkflowTitle")}</div>
                            <div className="mt-0.5 text-xs text-stone-500">{t("config.channelEditor.frameVideoWorkflowDesc")}</div>
                        </div>
                        <div className="rounded-lg border border-stone-200 p-2.5 dark:border-stone-800">
                            <ComfyuiWorkflowEditor
                                value={
                                    draft.comfyuiFrameVideoWorkflow ||
                                    draft.models.find((m) => m.name === "ComfyUI Frame Video" || m.name.toLowerCase().includes("frame") || m.name.includes("首尾帧"))?.comfyuiWorkflow
                                }
                                defaultWorkflow={DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW}
                                onChange={setComfyuiFrameVideoWorkflow}
                            />
                        </div>
                    </div>
                </>
            )}
        </Drawer>
    );
}
