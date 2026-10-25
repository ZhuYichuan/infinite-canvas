import type { WorkflowCategory } from "@/stores/use-config-store";
import { validateComfyuiWorkflow, type ComfyuiWorkflowJson } from "./comfyui";

export interface IngestOptions {
    categoryHint?: WorkflowCategory;
    autoFixAmbiguities?: boolean;
}

export interface DetectedSlotInfo {
    slot: string;
    nodeId: string;
    inputKey?: string;
    confidence: number;
}

export interface AmbiguityInfo {
    slot: string;
    candidateNodeIds: string[];
    description: string;
}

export interface IngestResult {
    ok: boolean;
    workflow?: ComfyuiWorkflowJson;
    detectedCategory: WorkflowCategory;
    confidence: number;
    detectedSlots: DetectedSlotInfo[];
    ambiguities?: AmbiguityInfo[];
    error?: string;
}

type NodeRecord = {
    class_type?: string;
    inputs?: Record<string, unknown>;
    _meta?: { title?: string };
};

const RESERVED_SLOT_REGEX =
    /^(prompt|seed|width|height|duration|first_frame|last_frame|ref_mask|mask|ref_mask_\d+|ref_image(_\d+)?|ref_video(_\d+)?|ref_audio(_\d+)?|output_image|output_video|output_text|output_audio|caption|lyrics)$/i;

function isStandardSlot(title?: string): boolean {
    if (!title) return false;
    return RESERVED_SLOT_REGEX.test(title.trim().toLowerCase());
}

/**
 * 转换 ComfyUI UI 界面格式（包含 nodes 和 links）为标准 API 格式
 */
function normalizeUiGraphToApi(graph: {
    nodes: Array<{ id: number | string; type: string; title?: string; widgets_values?: unknown[] }>;
    links: Array<[number, number | string, number, number | string, number, string]>;
}): ComfyuiWorkflowJson {
    const apiJson: Record<string, NodeRecord> = {};

    for (const node of graph.nodes) {
        const nodeId = String(node.id);
        const inputs: Record<string, unknown> = {};

        if (Array.isArray(node.widgets_values)) {
            const vals = node.widgets_values;
            if (node.type === "CLIPTextEncode") {
                if (typeof vals[0] === "string") inputs.text = vals[0];
            } else if (node.type === "KSampler" || node.type === "KSamplerAdvanced") {
                if (typeof vals[0] === "number") inputs.seed = vals[0];
                if (typeof vals[2] === "number") inputs.steps = vals[2];
                if (typeof vals[3] === "number") inputs.cfg = vals[3];
                if (typeof vals[4] === "string") inputs.sampler_name = vals[4];
                if (typeof vals[5] === "string") inputs.scheduler = vals[5];
                if (typeof vals[6] === "number") inputs.denoise = vals[6];
            } else if (node.type === "EmptyLatentImage") {
                if (typeof vals[0] === "number") inputs.width = vals[0];
                if (typeof vals[1] === "number") inputs.height = vals[1];
                if (typeof vals[2] === "number") inputs.batch_size = vals[2];
            } else if (node.type === "SaveImage" || node.type === "PreviewImage") {
                if (typeof vals[0] === "string") inputs.filename_prefix = vals[0];
            } else if (node.type.startsWith("Primitive")) {
                if (vals[0] !== undefined) inputs.value = vals[0];
            }
        }

        apiJson[nodeId] = {
            class_type: node.type,
            inputs,
            _meta: { title: node.title || node.type },
        };
    }

    for (const link of graph.links) {
        if (!Array.isArray(link) || link.length < 5) continue;
        const [, originId, originSlot, targetId, targetSlot, linkType] = link;
        const targetNode = apiJson[String(targetId)];
        if (!targetNode) continue;
        if (!targetNode.inputs) targetNode.inputs = {};

        const targetClass = targetNode.class_type || "";
        let inputKey: string | undefined;

        if (targetClass === "KSampler" || targetClass === "KSamplerAdvanced") {
            const slotMap: Record<number, string> = {
                0: "model",
                1: "positive",
                2: "negative",
                3: "latent_image",
            };
            inputKey = slotMap[Number(targetSlot)] || (linkType === "CONDITIONING" ? "positive" : linkType === "LATENT" ? "latent_image" : "model");
        } else if (targetClass === "SaveImage" || targetClass === "PreviewImage" || targetClass === "VHS_VideoCombine") {
            inputKey = "images";
        } else if (targetClass === "VAEDecode") {
            inputKey = Number(targetSlot) === 0 ? "samples" : "vae";
        } else if (targetClass === "VAEEncode") {
            inputKey = Number(targetSlot) === 0 ? "pixels" : "vae";
        } else if (targetClass === "CLIPTextEncode") {
            inputKey = "clip";
        } else {
            inputKey = `input_${targetSlot}`;
        }

        targetNode.inputs[inputKey] = [String(originId), Number(originSlot)];
    }

    return apiJson;
}

/**
 * 提取现有工作流中已经合规打标的槽位
 */
function extractExistingSlots(workflow: ComfyuiWorkflowJson): DetectedSlotInfo[] {
    const slots: DetectedSlotInfo[] = [];
    for (const [nodeId, node] of Object.entries(workflow)) {
        if (typeof node !== "object" || node === null) continue;
        const rec = node as NodeRecord;
        const title = rec._meta?.title?.trim().toLowerCase();
        if (title && isStandardSlot(title)) {
            slots.push({ slot: title, nodeId, confidence: 1.0 });
        }
    }
    return slots;
}

/**
 * 工作流智能摄取与自适应适配引擎 (Workflow Ingestion Adapter)
 * 对外暴露单一高杠杆接口，自动完成格式标准化、拓扑推断、插槽自动补全与模型挂载。
 */
export function ingestWorkflow(rawInput: unknown, options?: IngestOptions): IngestResult {
    if (!rawInput) {
        return { ok: false, error: "工作流内容为空", detectedCategory: "t2i", confidence: 0, detectedSlots: [] };
    }

    let parsed: unknown = rawInput;
    if (typeof rawInput === "string") {
        try {
            parsed = JSON.parse(rawInput);
        } catch {
            return { ok: false, error: "工作流必须为有效的 JSON 格式", detectedCategory: "t2i", confidence: 0, detectedSlots: [] };
        }
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { ok: false, error: "工作流 JSON 必须为对象结构", detectedCategory: "t2i", confidence: 0, detectedSlots: [] };
    }

    // 1. 格式自适应标准化
    let workflowJson: ComfyuiWorkflowJson;
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.nodes) && Array.isArray(obj.links)) {
        workflowJson = normalizeUiGraphToApi(obj as unknown as {
            nodes: Array<{ id: number | string; type: string; title?: string; widgets_values?: unknown[] }>;
            links: Array<[number, number | string, number, number | string, number, string]>;
        });
    } else {
        workflowJson = obj;
    }

    const nodeEntries = Object.entries(workflowJson).filter(([_, n]) => typeof n === "object" && n !== null) as [string, NodeRecord][];
    if (nodeEntries.length === 0) {
        return { ok: false, error: "工作流不包含任何有效节点", detectedCategory: "t2i", confidence: 0, detectedSlots: [] };
    }

    // 2. 存量已合规工作流快速通道（保留 100% 兼容性）
    const existingSlots = extractExistingSlots(workflowJson);

    if (options?.categoryHint) {
        const val = validateComfyuiWorkflow(workflowJson, options.categoryHint);
        if (val.ok) {
            return {
                ok: true,
                workflow: workflowJson,
                detectedCategory: options.categoryHint,
                confidence: 1.0,
                detectedSlots: existingSlots,
            };
        }
    } else {
        const ALL_CATS: WorkflowCategory[] = ["t2i", "i2i", "inpaint", "text", "omniVideo", "frameVideo", "audio", "faceRefine", "depthVideo"];
        for (const cat of ALL_CATS) {
            const val = validateComfyuiWorkflow(workflowJson, cat);
            if (val.ok) {
                return {
                    ok: true,
                    workflow: workflowJson,
                    detectedCategory: cat,
                    confidence: 1.0,
                    detectedSlots: existingSlots,
                };
            }
        }
    }

    // 3. DAG 拓扑分析与能力分类自动判定
    const adapted: Record<string, NodeRecord> = structuredClone(workflowJson) as Record<string, NodeRecord>;

    const imageLoaders: string[] = [];
    const videoLoaders: string[] = [];
    const audioLoaders: string[] = [];
    let imageOutputId: string | undefined;
    let videoOutputId: string | undefined;
    let audioOutputId: string | undefined;
    let textOutputId: string | undefined;

    let hasDepthNode = false;
    let hasFaceRefineNode = false;
    let hasAudioDitNode = false;
    let hasInpaintNode = false;
    let hasLLMNode = false;
    let samplerNodeId: string | undefined;
    let frameConditioningNodeId: string | undefined;

    for (const [nodeId, node] of Object.entries(adapted)) {
        const cls = (node.class_type || "").toLowerCase();
        const title = (node._meta?.title || "").toLowerCase();

        // 识别输入节点
        if (cls.includes("loadimage") || cls === "imageload") {
            imageLoaders.push(nodeId);
        } else if (cls.includes("loadvideo") || cls.includes("getvideocomponents")) {
            videoLoaders.push(nodeId);
        } else if (cls.includes("loadaudio")) {
            audioLoaders.push(nodeId);
        }

        // 识别输出节点
        if (cls === "saveimage" || cls === "previewimage" || title.includes("output_image")) {
            imageOutputId = nodeId;
        } else if (cls === "vhs_videocombine" || cls === "savevideo" || title.includes("output_video")) {
            videoOutputId = nodeId;
        } else if (cls === "saveaudio" || cls === "saveaudioadvanced" || title.includes("output_audio")) {
            audioOutputId = nodeId;
        } else if (cls === "savetext" || cls === "showtext" || title.includes("output_text")) {
            textOutputId = nodeId;
        }

        // 识别特征算子
        if (cls.includes("videodepthanything") || cls.includes("depthanything") || cls.includes("depthcrafter") || cls.includes("marigold")) {
            hasDepthNode = true;
        }
        if (cls.includes("ultralytics") || cls.includes("facedetailer") || cls.includes("facecrop") || cls.includes("reactor") || cls.includes("face_refine")) {
            hasFaceRefineNode = true;
        }
        if (cls.includes("minimaxmusic") || cls.includes("audioldm") || cls.includes("musicgen")) {
            hasAudioDitNode = true;
        }
        if (cls.includes("inpaint") || cls.includes("setlatentnoisemask") || cls.includes("masktoimage")) {
            hasInpaintNode = true;
        }
        if (cls.includes("llm") || cls.includes("ollama") || cls.includes("universaltoolkit") || cls.includes("promptexpand")) {
            hasLLMNode = true;
        }
        if (cls.includes("ksampler") || cls.includes("samplercustomadvanced") || cls.includes("guider")) {
            samplerNodeId = nodeId;
        }
        if (cls.includes("firstlastframe") || cls.includes("frameconditioning")) {
            frameConditioningNodeId = nodeId;
        }
    }

    // 检查是否存在 LoadImage 的 mask 输出被下游使用的情形（单节点 Inpaint 拓扑）
    let singleNodeMaskUsage: { origNodeId: string; downstreamNodeId: string; downstreamKey: string } | undefined;
    for (const [nodeId, node] of Object.entries(adapted)) {
        if (!node.inputs) continue;
        for (const [inKey, inVal] of Object.entries(node.inputs)) {
            if (Array.isArray(inVal) && inVal.length >= 2) {
                const [targetNodeId, targetPin] = inVal;
                const targetNode = adapted[String(targetNodeId)];
                if (targetNode?.class_type?.toLowerCase().includes("loadimage") && Number(targetPin) === 1) {
                    singleNodeMaskUsage = { origNodeId: String(targetNodeId), downstreamNodeId: nodeId, downstreamKey: inKey };
                    hasInpaintNode = true;
                }
            }
        }
    }

    // 判定分类
    let detectedCategory: WorkflowCategory;
    if (options?.categoryHint) {
        detectedCategory = options.categoryHint;
    } else if (hasDepthNode && videoOutputId) {
        detectedCategory = "depthVideo";
    } else if (hasFaceRefineNode && videoOutputId) {
        detectedCategory = "faceRefine";
    } else if (audioOutputId || hasAudioDitNode) {
        detectedCategory = "audio";
    } else if (videoOutputId) {
        if (frameConditioningNodeId || (imageLoaders.length === 2 && !videoLoaders.length)) {
            detectedCategory = "frameVideo";
        } else {
            detectedCategory = "omniVideo";
        }
    } else if (hasLLMNode && (textOutputId || !imageOutputId)) {
        detectedCategory = "text";
    } else if (imageOutputId) {
        if (hasInpaintNode) {
            detectedCategory = "inpaint";
        } else if (imageLoaders.length > 0) {
            detectedCategory = "i2i";
        } else {
            detectedCategory = "t2i";
        }
    } else {
        detectedCategory = "t2i";
    }

    const detectedSlots: DetectedSlotInfo[] = [];
    const ambiguities: AmbiguityInfo[] = [];

    // 4. 启发式槽位推断与 AST 打标

    // 4.1 输出标记注入
    if (detectedCategory === "t2i" || detectedCategory === "i2i" || detectedCategory === "inpaint") {
        if (imageOutputId) {
            const outNode = adapted[imageOutputId];
            if (outNode.class_type === "PreviewImage") {
                outNode.class_type = "SaveImage";
            }
            outNode._meta = { ...outNode._meta, title: "output_image" };
            detectedSlots.push({ slot: "output_image", nodeId: imageOutputId, confidence: 0.98 });
        }
    } else if (detectedCategory === "omniVideo" || detectedCategory === "frameVideo" || detectedCategory === "faceRefine" || detectedCategory === "depthVideo") {
        if (videoOutputId) {
            adapted[videoOutputId]._meta = { ...adapted[videoOutputId]._meta, title: "output_video" };
            detectedSlots.push({ slot: "output_video", nodeId: videoOutputId, confidence: 0.98 });
        }
    } else if (detectedCategory === "audio") {
        if (audioOutputId) {
            adapted[audioOutputId]._meta = { ...adapted[audioOutputId]._meta, title: "output_audio" };
            detectedSlots.push({ slot: "output_audio", nodeId: audioOutputId, confidence: 0.98 });
        }
    } else if (detectedCategory === "text") {
        if (textOutputId) {
            adapted[textOutputId]._meta = { ...adapted[textOutputId]._meta, title: "output_text" };
            detectedSlots.push({ slot: "output_text", nodeId: textOutputId, confidence: 0.98 });
        }
    }

    // 4.2 Prompt 提示词自动识别 (沿着 Conditioning DAG 深度追踪)
    if (detectedCategory !== "depthVideo") {
        if (detectedCategory === "audio") {
            const textNodes: string[] = [];
            for (const [nodeId, node] of Object.entries(adapted)) {
                const cls = (node.class_type || "").toLowerCase();
                if (cls.includes("string") || cls.includes("textencode") || cls.includes("caption") || cls.includes("lyrics")) {
                    textNodes.push(nodeId);
                }
            }

            let foundCaption = false;
            let foundLyrics = false;
            for (const id of textNodes) {
                const node = adapted[id];
                const raw = JSON.stringify(node).toLowerCase();
                if (!foundLyrics && (raw.includes("lyric") || raw.includes("verse") || raw.includes("song"))) {
                    node._meta = { ...node._meta, title: "lyrics" };
                    detectedSlots.push({ slot: "lyrics", nodeId: id, confidence: 0.95 });
                    foundLyrics = true;
                } else if (!foundCaption) {
                    node._meta = { ...node._meta, title: "caption" };
                    detectedSlots.push({ slot: "caption", nodeId: id, confidence: 0.95 });
                    foundCaption = true;
                }
            }
        } else {
            let positiveNodeId: string | undefined;

            // 从 sampler 逆向回溯 positive 连线
            if (samplerNodeId && adapted[samplerNodeId]?.inputs?.positive) {
                let currentId: string | undefined = String((adapted[samplerNodeId].inputs!.positive as [string, number])[0]);
                const visited = new Set<string>();

                while (currentId && adapted[currentId] && !visited.has(currentId)) {
                    visited.add(currentId);
                    const currentNode: NodeRecord = adapted[currentId];
                    const cls = (currentNode.class_type || "").toLowerCase();

                    // 若是最终的文本节点
                    if (cls.includes("cliptextencode") || cls.includes("textencode") || cls.includes("primitivestring")) {
                        // 检查其 text 属性是否来自前置 PrimitiveString
                        if (Array.isArray(currentNode.inputs?.text) && adapted[String(currentNode.inputs.text[0])]) {
                            positiveNodeId = String(currentNode.inputs.text[0]);
                        } else {
                            positiveNodeId = currentId;
                        }
                        break;
                    }

                    // 若是中间 Conditioning 处理节点（如 InpaintModelConditioning, FluxGuidance 等），继续逆向深入 positive
                    if (Array.isArray(currentNode.inputs?.positive)) {
                        currentId = String(currentNode.inputs.positive[0]);
                    } else if (Array.isArray(currentNode.inputs?.conditioning)) {
                        currentId = String(currentNode.inputs.conditioning[0]);
                    } else {
                        break;
                    }
                }
            }

            // 若回溯未直接命中，搜索所有非 negative 的文本编码节点
            if (!positiveNodeId) {
                const candidates: string[] = [];
                for (const [nodeId, node] of Object.entries(adapted)) {
                    const cls = (node.class_type || "").toLowerCase();
                    const title = (node._meta?.title || "").toLowerCase();
                    if (cls.includes("cliptextencode") || cls.includes("primitivestring") || cls.includes("textencode")) {
                        const strVal = JSON.stringify(node.inputs || "").toLowerCase();
                        if (!title.includes("neg") && !strVal.includes("low quality") && !strVal.includes("deformed")) {
                            candidates.push(nodeId);
                        }
                    }
                }
                if (candidates.length === 1) {
                    positiveNodeId = candidates[0];
                } else if (candidates.length > 1) {
                    positiveNodeId = candidates[0];
                    ambiguities.push({
                        slot: "prompt",
                        candidateNodeIds: candidates,
                        description: `检测到 ${candidates.length} 个候选正向提示词节点，默认选择节点 ${candidates[0]}`,
                    });
                }
            }

            if (positiveNodeId && adapted[positiveNodeId]) {
                adapted[positiveNodeId]._meta = { ...adapted[positiveNodeId]._meta, title: "prompt" };
                detectedSlots.push({ slot: "prompt", nodeId: positiveNodeId, confidence: 0.95 });
            }
        }
    }

    // 4.3 Seed 随机种子自动识别
    if (samplerNodeId && adapted[samplerNodeId]) {
        const sNode = adapted[samplerNodeId];
        if (Array.isArray(sNode.inputs?.seed)) {
            const seedNodeId = String(sNode.inputs.seed[0]);
            if (adapted[seedNodeId]) {
                adapted[seedNodeId]._meta = { ...adapted[seedNodeId]._meta, title: "seed" };
                detectedSlots.push({ slot: "seed", nodeId: seedNodeId, confidence: 0.95 });
            }
        } else if (typeof sNode.inputs?.seed === "number" || typeof sNode.inputs?.noise_seed === "number") {
            sNode._meta = { ...sNode._meta, title: sNode._meta?.title || "seed" };
            detectedSlots.push({ slot: "seed", nodeId: samplerNodeId, confidence: 0.9 });
        }
    }

    // 4.4 尺寸 Width & Height 自动识别
    for (const [nodeId, node] of Object.entries(adapted)) {
        const cls = (node.class_type || "").toLowerCase();
        if (cls.includes("emptylatent") || cls.includes("sd3latent") || cls.includes("fluxlatent")) {
            if (Array.isArray(node.inputs?.width) && adapted[String(node.inputs.width[0])]) {
                adapted[String(node.inputs.width[0])]._meta = { ...adapted[String(node.inputs.width[0])]._meta, title: "width" };
                detectedSlots.push({ slot: "width", nodeId: String(node.inputs.width[0]), confidence: 0.9 });
            }
            if (Array.isArray(node.inputs?.height) && adapted[String(node.inputs.height[0])]) {
                adapted[String(node.inputs.height[0])]._meta = { ...adapted[String(node.inputs.height[0])]._meta, title: "height" };
                detectedSlots.push({ slot: "height", nodeId: String(node.inputs.height[0]), confidence: 0.9 });
            }
        }
    }

    // 4.5 局部重绘 (Inpaint) Mask AST 自动分流重构
    if (detectedCategory === "inpaint") {
        if (singleNodeMaskUsage) {
            const { origNodeId, downstreamNodeId, downstreamKey } = singleNodeMaskUsage;
            adapted[origNodeId]._meta = { ...adapted[origNodeId]._meta, title: "ref_image_01" };
            detectedSlots.push({ slot: "ref_image_01", nodeId: origNodeId, confidence: 0.95 });

            const numericIds = Object.keys(adapted).map((k) => parseInt(k, 10)).filter((n) => !isNaN(n));
            const newMaskId = String((numericIds.length > 0 ? Math.max(...numericIds) : 1000) + 1);

            adapted[newMaskId] = {
                class_type: "LoadImage",
                inputs: { image: "ref_mask.png" },
                _meta: { title: "ref_mask" },
            };
            detectedSlots.push({ slot: "ref_mask", nodeId: newMaskId, confidence: 0.95 });

            if (adapted[downstreamNodeId]?.inputs) {
                adapted[downstreamNodeId].inputs[downstreamKey] = [newMaskId, 0];
            }
        } else {
            if (imageLoaders.length >= 2) {
                adapted[imageLoaders[0]]._meta = { ...adapted[imageLoaders[0]]._meta, title: "ref_image_01" };
                adapted[imageLoaders[1]]._meta = { ...adapted[imageLoaders[1]]._meta, title: "ref_mask" };
                detectedSlots.push({ slot: "ref_image_01", nodeId: imageLoaders[0], confidence: 0.9 });
                detectedSlots.push({ slot: "ref_mask", nodeId: imageLoaders[1], confidence: 0.9 });
            }
        }
    }

    // 4.6 首尾帧 (Frame Video) 自动识别
    if (detectedCategory === "frameVideo") {
        if (imageLoaders.length >= 2) {
            adapted[imageLoaders[0]]._meta = { ...adapted[imageLoaders[0]]._meta, title: "first_frame" };
            adapted[imageLoaders[1]]._meta = { ...adapted[imageLoaders[1]]._meta, title: "last_frame" };
            detectedSlots.push({ slot: "first_frame", nodeId: imageLoaders[0], confidence: 0.95 });
            detectedSlots.push({ slot: "last_frame", nodeId: imageLoaders[1], confidence: 0.95 });
        }
    }

    // 4.7 图生图与多图参考 (I2I & OmniVideo) 自动排序
    if (detectedCategory === "i2i" || detectedCategory === "omniVideo") {
        // 对 imageLoaders 按照拓扑深度排序：连接至 VAEEncode 的优先作为主参考底图 ref_image_01
        imageLoaders.sort((a, b) => {
            const aFeedsVae = Object.values(adapted).some(
                (n) => n.class_type === "VAEEncode" && Array.isArray(n.inputs?.pixels) && String(n.inputs.pixels[0]) === a,
            );
            const bFeedsVae = Object.values(adapted).some(
                (n) => n.class_type === "VAEEncode" && Array.isArray(n.inputs?.pixels) && String(n.inputs.pixels[0]) === b,
            );
            if (aFeedsVae && !bFeedsVae) return -1;
            if (!aFeedsVae && bFeedsVae) return 1;
            return 0;
        });

        let idx = 1;
        for (const imgId of imageLoaders) {
            if (!isStandardSlot(adapted[imgId]._meta?.title)) {
                const slotKey = `ref_image_${String(idx).padStart(2, "0")}`;
                adapted[imgId]._meta = { ...adapted[imgId]._meta, title: slotKey };
                detectedSlots.push({ slot: slotKey, nodeId: imgId, confidence: 0.9 });
                idx++;
            }
        }
    }

    // 4.8 视频输入识别 (Face Refine / Depth Video)
    if (detectedCategory === "faceRefine" || detectedCategory === "depthVideo") {
        if (videoLoaders.length > 0) {
            adapted[videoLoaders[0]]._meta = { ...adapted[videoLoaders[0]]._meta, title: "ref_video_01" };
            detectedSlots.push({ slot: "ref_video_01", nodeId: videoLoaders[0], confidence: 0.95 });
        }
    }

    // 4.9 大模型动态挂载标签自动注入 (select_models_*)
    for (const [nodeId, node] of Object.entries(adapted)) {
        const cls = (node.class_type || "").toLowerCase();
        let modelCategory: string | undefined;

        if (cls.includes("unet") || cls.includes("diffusionmodel") || cls.includes("fluxmodel")) {
            modelCategory = "diffusion_models";
        } else if (cls.includes("cliploader") || cls.includes("dualcliploader") || cls.includes("textencoder")) {
            modelCategory = "clip";
        } else if (cls.includes("checkpointloader")) {
            modelCategory = "checkpoints";
        } else if (cls.includes("vaeloader")) {
            modelCategory = "vae";
        } else if (cls.includes("loraloader")) {
            modelCategory = "loras";
        } else if (cls.includes("controlnetloader")) {
            modelCategory = "controlnet";
        }

        if (modelCategory) {
            const currentTitle = node._meta?.title || "";
            if (!currentTitle.toLowerCase().includes("select_models_")) {
                const tag = `select_models_${modelCategory}`;
                node._meta = { ...node._meta, title: currentTitle ? `${currentTitle} [${tag}]` : tag };
                detectedSlots.push({ slot: tag, nodeId, confidence: 0.95 });
            }
        }
    }

    // 5. 校验适配后工作流完整性
    const finalValidation = validateComfyuiWorkflow(adapted, detectedCategory);
    if (!finalValidation.ok) {
        return {
            ok: false,
            workflow: adapted,
            detectedCategory,
            confidence: 0.5,
            detectedSlots,
            ambiguities,
            error: finalValidation.error,
        };
    }

    return {
        ok: true,
        workflow: adapted,
        detectedCategory,
        confidence: ambiguities.length > 0 ? 0.85 : 0.95,
        detectedSlots,
        ambiguities,
    };
}
