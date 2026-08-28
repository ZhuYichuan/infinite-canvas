import { Button, Drawer, Input, Modal, Segmented, Select, Space } from "antd";
import { ListPlus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { COMFYUI_DEFAULT_MODELS, defaultBaseUrlForApiFormat, guessCapability, normalizeChannelModels, type ApiCallFormat, type ChannelModel, type ComfyuiWorkflow, type ModelCapability, type ModelChannel } from "@/stores/use-config-store";
import { ComfyuiWorkflowEditor } from "./comfyui-workflow-editor";
import { ModelScriptEditor } from "./model-script-editor";
import { ModelSelectModal } from "./model-select-modal";

type ScriptTarget = { name: string; capability: ModelCapability; value: string };

export function ChannelEditorDrawer({ open, channel, onSave, onClose }: { open: boolean; channel: ModelChannel | null; onSave: (channel: ModelChannel) => void; onClose: () => void }) {
    type ProxyFieldErrors = { url?: string; token?: string };
    const { t } = useTranslation();
    const [draft, setDraft] = useState<ModelChannel | null>(channel);
    const [selectOpen, setSelectOpen] = useState(false);
    const [scriptTarget, setScriptTarget] = useState<ScriptTarget | null>(null);
    const [workflowTarget, setWorkflowTarget] = useState<{ name: string } | null>(null);
    const [proxyErrors, setProxyErrors] = useState<ProxyFieldErrors>({});
    const apiFormatOptions: Array<{ label: string; value: ApiCallFormat }> = [
        { label: "OpenAI", value: "openai" },
        { label: "Gemini", value: "gemini" },
        { label: "ComfyUI", value: "comfyui" },
    ];
    const capabilityOptions: Array<{ label: string; value: ModelCapability }> = ["image", "video", "text", "audio"].map((value) => ({ label: t(`config.channelEditor.capabilities.${value}`), value: value as ModelCapability }));

    useEffect(() => {
        if (open && channel) {
            setDraft(channel);
            setProxyErrors({});
            // The drawer body stays mounted (destroyOnClose off), so stale modal targets would resurface on reopen.
            setScriptTarget(null);
            setWorkflowTarget(null);
        }
    }, [open, channel]);

    if (!draft) return null;

    const patch = (value: Partial<ModelChannel>) => setDraft((current) => (current ? { ...current, ...value } : current));
    const setModels = (models: ChannelModel[]) => patch({ models });

    const changeApiFormat = (apiFormat: ApiCallFormat) => {
        const baseUrl = !draft.baseUrl.trim() || draft.baseUrl.trim() === defaultBaseUrlForApiFormat(draft.apiFormat) ? defaultBaseUrlForApiFormat(apiFormat) : draft.baseUrl;
        // Switching to ComfyUI pre-provisions the default workflow models when the channel has none yet.
        const models = apiFormat === "comfyui" && draft.models.length === 0 ? COMFYUI_DEFAULT_MODELS.map((model) => ({ ...model })) : draft.models;
        patch({ apiFormat, baseUrl, models });
    };

    const applySelection = (names: string[]) => {
        const map = new Map(draft.models.map((model) => [model.name, model]));
        setModels(names.map((name) => map.get(name) || { name, capability: guessCapability(name) }));
    };

    const setCapability = (name: string, capability: ModelCapability) => setModels(draft.models.map((model) => (model.name === name ? { ...model, capability } : model)));
    const setScript = (name: string, script: string) => setModels(draft.models.map((model) => (model.name === name ? { ...model, script: script || undefined } : model)));
    const setComfyuiWorkflow = (name: string, workflow: ComfyuiWorkflow | undefined) => setModels(draft.models.map((model) => (model.name === name ? { ...model, comfyuiWorkflow: workflow } : model)));
    const removeModel = (name: string) => setModels(draft.models.filter((model) => model.name !== name));

    const save = () => {
        // A ComfyUI channel talks to the proxy, not an OpenAI-compatible endpoint: both proxy fields are required.
        const errors: ProxyFieldErrors = {};
        if (draft.apiFormat === "comfyui") {
            const proxyUrl = (draft.comfyuiProxyUrl || "").trim();
            if (!/^https?:\/\/.+/.test(proxyUrl)) errors.url = t("config.channelEditor.comfyuiProxyUrlError");
            if (!(draft.comfyuiProxyToken || "").trim()) errors.token = t("config.channelEditor.comfyuiProxyTokenError");
        }
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
                    <Select className="w-full" value={draft.apiFormat} options={apiFormatOptions} onChange={changeApiFormat} />
                </label>
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.baseUrl")}</span>
                    <Input value={draft.baseUrl} onChange={(event) => patch({ baseUrl: event.target.value })} placeholder="https://api.example.com" />
                </label>
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium">API Key</span>
                    <Input.Password value={draft.apiKey} onChange={(event) => patch({ apiKey: event.target.value })} placeholder="sk-..." />
                </label>
                {draft.apiFormat === "comfyui" && (
                    <>
                        <label className="block md:col-span-2">
                            <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.comfyuiProxyUrl")}</span>
                            <Input
                                value={draft.comfyuiProxyUrl || ""}
                                status={proxyErrors.url ? "error" : undefined}
                                onChange={(event) => {
                                    patch({ comfyuiProxyUrl: event.target.value });
                                    if (proxyErrors.url) setProxyErrors((current) => ({ ...current, url: undefined }));
                                }}
                                placeholder="http://127.0.0.1:8189"
                            />
                            {proxyErrors.url ? <div className="mt-1 text-xs text-red-500">{proxyErrors.url}</div> : null}
                        </label>
                        <label className="block md:col-span-2">
                            <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.comfyuiProxyToken")}</span>
                            <Input.Password
                                value={draft.comfyuiProxyToken || ""}
                                status={proxyErrors.token ? "error" : undefined}
                                onChange={(event) => {
                                    patch({ comfyuiProxyToken: event.target.value });
                                    if (proxyErrors.token) setProxyErrors((current) => ({ ...current, token: undefined }));
                                }}
                            />
                            {proxyErrors.token ? <div className="mt-1 text-xs text-red-500">{proxyErrors.token}</div> : null}
                        </label>
                    </>
                )}
            </div>

            <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-sm font-semibold">{t("config.channelEditor.models")}</div>
                    <div className="mt-0.5 text-xs text-stone-500">{t("config.channelEditor.modelDescription", { count: draft.models.length })}</div>
                </div>
                <Button type="primary" icon={<ListPlus className="size-4" />} onClick={() => setSelectOpen(true)}>
                    {t("config.channelEditor.selectModels")}
                </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-stone-200 p-2 dark:border-stone-800">
                {draft.models.length ? (
                    draft.models.map((model) => (
                        <div key={model.name} className="flex flex-wrap items-center gap-3 rounded-md px-2 py-1.5 hover:bg-stone-50 dark:hover:bg-stone-900/40">
                            <span className="min-w-0 flex-1 truncate text-sm" title={model.name}>
                                {model.name}
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
                                <Segmented size="small" value={model.capability} options={capabilityOptions} onChange={(value) => setCapability(model.name, value as ModelCapability)} />
                                <Button size="small" type={model.script ? "primary" : "default"} ghost={Boolean(model.script)} onClick={() => setScriptTarget({ name: model.name, capability: model.capability, value: model.script || "" })}>
                                    {t(model.script ? "config.channelEditor.scriptReady" : "config.channelEditor.script")}
                                </Button>
                                {draft.apiFormat === "comfyui" && (
                                    <Button size="small" type={model.comfyuiWorkflow ? "primary" : "default"} ghost={Boolean(model.comfyuiWorkflow)} onClick={() => setWorkflowTarget({ name: model.name })}>
                                        {t(model.comfyuiWorkflow ? "config.channelEditor.workflowReady" : "config.channelEditor.workflow")}
                                    </Button>
                                )}
                                <Button size="small" danger type="text" icon={<Trash2 className="size-3.5" />} onClick={() => removeModel(model.name)} />
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="px-2 py-8 text-center text-sm text-stone-500">{t("config.channelEditor.empty")}</div>
                )}
            </div>

            <ModelSelectModal open={selectOpen} channel={draft} selectedNames={draft.models.map((model) => model.name)} onConfirm={applySelection} onClose={() => setSelectOpen(false)} />

            <ModelScriptEditor
                open={Boolean(scriptTarget)}
                capability={scriptTarget?.capability || "text"}
                modelName={scriptTarget?.name || ""}
                value={scriptTarget?.value || ""}
                onSave={(script) => scriptTarget && setScript(scriptTarget.name, script)}
                onClose={() => setScriptTarget(null)}
            />

            <Modal
                open={Boolean(workflowTarget)}
                title={workflowTarget ? `${t("config.channelEditor.workflow")} · ${workflowTarget.name}` : ""}
                width={560}
                centered
                onCancel={() => setWorkflowTarget(null)}
                footer={
                    <Button onClick={() => setWorkflowTarget(null)}>{t("common.done")}</Button>
                }
            >
                {workflowTarget ? (
                    <ComfyuiWorkflowEditor value={draft.models.find((model) => model.name === workflowTarget.name)?.comfyuiWorkflow} onChange={(workflow) => setComfyuiWorkflow(workflowTarget.name, workflow)} />
                ) : null}
            </Modal>
        </Drawer>
    );
}
