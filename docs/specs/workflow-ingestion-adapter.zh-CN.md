# 规范：工作流智能接入适配器与插槽自适应系统 (Workflow Ingestion Adapter Spec)

> 关联 Issue: [#1 feat: Workflow Ingestion Adapter & Automatic Slot Adaptation (Candidate 1)](https://github.com/ZhuYichuan/infinite-canvas/issues/1)  
> 状态: `ready-for-agent`  
> 适用范围: ComfyUI 工作流导入、9 大模态能力自动推断、插槽与模型挂载自适应

---

## Problem Statement

从社区平台（Civitai、Liblib、OpenArt）下载或从原生 ComfyUI 导出的工作流，无法直接拖入无限画布运行。当前系统的校验层强依赖保留的 `_meta.title`（如 `prompt`、`seed`、`width`、`height`、`ref_image_01`、`output_image`、`select_models_*`），非标工作流上传时会遭遇即时拦截并抛出晦涩的校验错误。用户必须阅读长篇使用文档，在 ComfyUI 内手动给每个关键节点改名并重新导出 API 格式。这种浅层架构把拓扑理解与协议适配的复杂度全量转嫁给了最终用户，严重阻碍了用户配置自定义模型和拓展 9 大核心生成模态（文生图、图生图、局部编辑、文本生成、全能参考视频、首尾帧视频、音乐/音频、人脸精修、深度视频）的体验。

---

## Solution

引入深模块 `WorkflowIngestionAdapter`（工作流摄取与适配引擎），对外提供高内聚、单一的高杠杆接口。适配器负责：
1. **格式自适应解包**：将社区 UI 流程图格式（带 `nodes` 和 `links`）、原生 API 字典格式或生成图片的元数据自动转译为规范的 API 执行图；
2. **DAG 拓扑指纹分类**：基于有向无环图结构分析，自动推断工作流所属的模态分类；
3. **启发式插槽推断与 AST 自动打标**：自动识别并注入 `prompt`、`seed`、`width`/`height`、参考资源群（`ref_image_NN`、`ref_video_NN`、`ref_audio_NN`）以及输出端点（`output_*`）；
4. **动态模型挂载**：自动遍历主干模型 Loader 并挂载 `select_models_*` 标签，实现模型在画布设置中的无感下拉替换；
5. **歧义交互向导**：仅在多候选节点置信度不足时，提供一步式的可视化确认卡片，彻底免去手动改名和翻阅说明书的负担。

---

## User Stories

1. 作为 AI 创作者，我希望直接将从 Civitai 导出的原生 ComfyUI API JSON 拖入画布渠道配置中，以便系统自动完成适配而无需我手动重命名节点。
2. 作为数字艺术家，我希望能够直接上传 ComfyUI 界面保存的 UI 格式工作流（含 `nodes` 和 `links`），以便系统自动将其编译为执行图，不再提示格式错误。
3. 作为工作流爱好者，我希望将 ComfyUI 生成的 WebP/PNG 样张直接拖入上传区，以便系统自动提取图片元数据中嵌入的工作流并完成适配。
4. 作为文生图用户，我希望工作流中的正向提示词编码节点被自动识别并绑定，以便我无需在繁杂的节点图里到处寻找文本输入端口。
5. 作为图像创作者，我希望采样器的随机种子与潜空间尺寸（宽高）自动映射到画布控件，以便画布的尺寸选择与种子轮转开箱即用。
6. 作为创作者，我希望末端的图像保存节点（无论是 `SaveImage` 还是 `PreviewImage`）自动被标记为输出端点，以便生成的图像资产可靠回传到画布节点中。
7. 作为图生图用户，我希望上传工作流后，接入潜空间编码的主参考图节点自动识别为 `ref_image_01`，无需我手动配置垫图插槽。
8. 作为风格迁移用户，我希望多图参考工作流（如 Qwen-Image 或 Flux 多参考）能按拓扑深度自动对辅助参考图排序编号，以便画布连线顺序与输入端口严格对齐。
9. 作为修图用户，我希望使用单一节点右键 Mask 的传统 Inpaint 工作流时，系统自动分流补齐独立的 `ref_mask` 节点，以便与画布的手绘遮罩工具无缝配合。
10. 作为文本创作者，我希望上传的端侧 LLM 或视觉反推工作流能自动识别指令输入与结果输出，并桥接统一的文本提取通道。
11. 作为视频创作者，我希望上传 MiniMax H3 或 Wan2.1 全能参考视频工作流时，多达 9 图 + 3 视频 + 3 音频的参考插槽自动分组归集，并具备动态修剪能力。
12. 作为动画创作者，我希望首尾帧视频工作流能按时序条件槽位自动区分首帧与尾帧，避免两端输入顺序颠倒。
13. 作为音乐创作者，我希望上传音乐生成工作流（如 MiniMax Music 03）时，曲风描述（`caption`）与歌词（`lyrics`）双文本端口能被独立识别与呈现。
14. 作为音频驱动视频创作者，我希望系统自动区分驱动音频与人像底图端口，并将合并产出的视频作为主结果输出。
15. 作为视频后期制作人员，我希望上传包含 YOLO 追踪与泊松融合的人脸精修工作流时，大量复杂的内部算法超参被妥善封装在后台，仅在界面暴露视频源与精修提示词。
16. 作为 3D/VFX 艺术家，我希望上传视频深度估计工作流（如 Video Depth Anything）时，系统自动识别其为结构型预处理管道，自动豁免必填提示词的检查。
17. 作为高级用户，我希望工作流中所有的模型加载节点（`UNETLoader`、`CheckpointLoaderSimple`、`CLIPLoader`、`DualCLIPLoader`、`VAELoader`、`LoraLoader`）自动挂载动态模型选择标签，以便我在画布设置中通过下拉框随意切换本地已下载的模型。
18. 作为上传了非标复杂工作流的用户，我希望在出现多个提示词节点歧义时，界面能弹出一步式的可视化高亮卡片供我快速点选确认，而无需去改代码或写配置。
19. 作为画布创作者，我希望全能参考视频工作流在未连满多模态资产时能自动修剪悬挂节点，以便纯文本生成视频时不会出现找不到文件的运行时错误。
20. 作为开发者，我希望工作流适配器暴露单一纯函数接口，以便通过端到端测试完整覆盖 9 大模态的输入输出，无需深入测试内部私有解析流程。

---

## Implementation Decisions

### 1. 单一高杠杆接口 (Single High-Leverage Seam)
深模块 `WorkflowIngestionAdapter` 暴露统一入口契约：
```ts
interface IngestOptions {
    categoryHint?: WorkflowCategory;
    autoFixAmbiguities?: boolean;
}

interface IngestResult {
    ok: boolean;
    workflow?: Record<string, unknown>;
    detectedCategory: WorkflowCategory;
    confidence: number;
    detectedSlots: {
        slot: string;
        nodeId: string;
        inputKey?: string;
        confidence: number;
    }[];
    ambiguities?: {
        slot: string;
        candidateNodeIds: string[];
        description: string;
    }[];
    error?: string;
}
```

### 2. 格式标准化管道 (Format Normalization Layer)
- 检测根对象是否包含 `nodes` 和 `links` 数组；若是，运行拓扑图编译器将连线映射提取为 API 格式的 `inputs` 字典结构。
- 提取图片中的 Exif 或 PNG Text Chunk（`tEXt` / `zTXt`），解析 `prompt` 或 `workflow` JSON 字符串。

### 3. DAG 拓扑指纹推断分类 (Topological Classification)
基于出入度与特征算子集合推导 9 大能力：
- `t2i`: 包含潜空间发生器 + 文本条件编码 $\rightarrow$ 图像保存（且无图像输入上游）。
- `i2i`: 包含图像加载节点 $\rightarrow$ VAE 编码/潜空间加噪融合 $\rightarrow$ 图像保存。
- `inpaint`: 包含图像加载与遮罩条件注入节点 $\rightarrow$ 图像保存。
- `text`: 包含 LLM/VLM 核心处理器 $\rightarrow$ 文本保存/展示。
- `omniVideo`: 包含多模态解包组件与时序扩散模型 $\rightarrow$ 视频保存。
- `frameVideo`: 严格包含 2 个图像输入接入时序潜空间两端 $\rightarrow$ 视频保存。
- `audio`: 包含音频 DiT 发生器 $\rightarrow$ 音频保存。
- `faceRefine`: 包含目标检测追踪（YOLO 等）与人脸裁剪缝合子图 $\rightarrow$ 视频保存。
- `depthVideo`: 包含单目深度估计特征节点（`VideoDepthAnything` 等） $\rightarrow$ 视频保存。

### 4. 启发式插槽推断与 AST 自动打标 (Heuristic Auto-Tagging)
- `prompt`: 从主采样器/Guider 的正向条件输入端口进行逆向溯源，锁定首个文本输入节点注入 `_meta.title = "prompt"`。
- `seed`: 匹配主采样器的 `seed` / `noise_seed` 属性或其上游连接的整数 Primitive。
- `width` / `height`: 遍历提供潜空间的 `EmptyLatentImage` 等节点，提取并标注尺寸。
- `ref_mask` 节点分流重构：若检测到底图 `LoadImage` 的 mask 输出被下游 Inpaint Conditioning 使用，自动在 AST 中插入独立的 `LoadImage` 节点注入 `ref_mask` 并重定向连线。
- `select_models_*`: 自动扫描所有 Loader 节点并根据类名后缀挂载对应的模型类型标签。

### 5. 歧义消除与可视化接缝 (Ambiguity Resolution)
若推断置信度低于 90%（例如存在多个无法区分优先级的正向文本输入），返回 `ambiguities` 诊断列表，UI 工作流编辑器以弹层卡片高亮候选节点，用户一键确认后立即完成提交。

---

## Testing Decisions

- **良好测试的标准**：
  必须仅通过外部接口 `ingestWorkflow(rawInput, options)` 执行断言，验证不同模态社区真实 JSON 经转换后的 `_meta.title` 标注是否准确、模型选择器是否挂载、输出保存节点是否就绪。严禁刺探内部 AST 遍历路径或私有辅助函数。
- **被测模块与测试用例矩阵**：
  编写针对 `WorkflowIngestionAdapter` 的独立单元测试套件，覆盖 9 大模态真实场景：
  1. 未标注的 Flux / SDXL 极简文生图 JSON
  2. 包含本地测试图的多图参考图生图 JSON
  3. 单节点 Mask 局部编辑工作流（验证 AST 自动分流重构）
  4. 端侧 LLM 提示词润色/反推工作流
  5. MiniMax H3 全能多模态参考视频工作流（验证资源分组）
  6. 首尾帧视频工作流（验证时序插槽匹配）
  7. MiniMax Music 03 音乐工作流（验证风格描述与歌词分离）
  8. YOLO 人脸追踪精修工作流（验证内部参数封装）
  9. Video Depth Anything 深度视频工作流（验证免 prompt 检查）
- **现有测试参照**：
  参照 [`web/src/services/api/__tests__/comfyui.test.ts`](file:///Users/group/Documents/coder/claude_code/infinite-canvas/web/src/services/api/__tests__/comfyui.test.ts) 的工作流断言模式。

---

## Out of Scope

- 修改 ComfyUI 服务端底层 Python 算子执行逻辑。
- 浏览器客户端内运行扩散大模型推理（计算完全由直连的 ComfyUI 承担）。
- 画布白板主界面的拖拽与连线图形系统。

---

## Further Notes

- 已包含合规 `_meta.title` 标注的存量工作流将以 100% 置信度直接穿透，保证 100% 向后兼容。
