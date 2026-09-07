# Canvas 生成链路 Bug 修复实施手册

> 状态：待实施
>
> 基线提交：`e21a4e0`
>
> 适用范围：画布文生图、图生图、文生视频、图生视频、文本生成、ComfyUI 任务、Agent 画布操作
>
> 本文是交给执行 Agent 的实现规格。代码位置以函数名为准，行号只用于首次定位。

## 1. 最终业务口径

先实现本节口径，再处理局部代码。不要根据旧代码行为反推产品规则。

### 1.1 五种动作必须分开

| 用户动作 | 含义 | 输入来源 | 输出方式 |
| --- | --- | --- | --- |
| 配置节点点击「生成」 | 按当前画布配置执行一次新生成 | 当前 `input` 连线、当前 `@` 提及、当前参数 | 创建新结果节点 |
| 成功结果点击「再次生成」 | 重放该结果的原始生成请求 | 结果节点保存的生成快照 | 创建新结果节点；使用新随机 seed |
| 成功结果点击「基于当前结果生成」 | 把当前结果作为新参考素材 | 当前结果自身，加用户明确连接的 `input` 素材 | 创建新结果节点 |
| 失败结果点击「重试」 | 重新提交失败请求 | 失败结果保存的生成快照 | 在原失败节点内写回结果 |
| 超时结果点击「继续查询」 | 查询已经提交的 ComfyUI 任务 | 原 `jobId` | 在原超时节点内写回结果 |

严禁通过“提示词是否改变”推断动作。界面必须给出明确动作，调用层必须携带明确 intent。

### 1.2 四类结果不改内容后再次生成

「再次生成」统一重放原请求，不把结果自身偷偷加入参考：

- 文生图仍是文生图。
- 图生图仍使用原参考图，不改成“上一张结果 + 原参考图”。
- 文生视频仍是文生视频。
- 图生视频仍使用原图片、视频、音频参考，不降级成文生视频。

「基于当前结果生成」才使用结果自身：

- 图片结果作为第一张图片参考。
- Omni 视频结果作为第一段视频参考。
- Frame 视频结果不能直接把视频当首帧；要求用户先提取帧，界面给出明确提示。
- 文本结果把当前文本作为文本输入。

### 1.3 连线不再靠“拆掉”解决歧义

生成开始、生成成功、失败重试时都不自动删除已有连线。连线必须区分用途：

- `input`：用户或 Agent 明确建立的输入关系，参与下一次生成。
- `lineage`：系统创建的结果血缘，只用于展示来源、定位原始生成记录，不参与资源收集。

因此：

- 配置节点到生成结果的自动连线是 `lineage`。
- 图片裁剪、拆图、角度生成、蒙版生成、视频抽帧等派生连线是 `lineage`。
- 用户拖线、引用选择器添加、Agent `connect_nodes` 建立的连线是 `input`。
- 重新生成只新增结果及其 `lineage`，不破坏旧分支。

### 1.4 下游节点不会自动级联重新生成

上游产生新结果后：

- 已有下游结果保持不变，不自动标记失败，不自动发请求。
- 下游保存的历史生成快照保持不变。
- 用户要让下游使用新结果时，必须明确改 `input` 连线或执行「基于当前结果生成」。

这条规则避免一次上游操作触发不可见的费用、长任务和整条链路变化。

## 2. 必须保持的数据契约

### 2.1 连线类型

修改 `web/src/types/canvas.ts`：

```ts
export type CanvasConnectionKind = "input" | "lineage";

export type CanvasConnection = {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    kind: CanvasConnectionKind;
};
```

项目未上线，按项目规则直接采用新结构，不写旧连线兼容或迁移分支。同步更新所有测试夹具、导入导出类型和 Agent 快照类型。

完成条件：全项目每一个新建连线的位置都显式写出 `kind`，不存在隐式默认值。

### 2.2 生成参考快照

修改 `CanvasNodeMetadata`，增加纯数据快照。不要保存 `Blob`、`File`、React 对象或临时 object URL。

```ts
export type CanvasGenerationReferenceSnapshot = {
    nodeId: string;
    kind: "image" | "video" | "audio" | "text";
    storageKey?: string;
    url?: string;
    text?: string;
    mimeType?: string;
};

// CanvasNodeMetadata 中增加
generationReferences?: CanvasGenerationReferenceSnapshot[];
generationOriginNodeId?: string;
```

继续使用已有扁平字段保存请求参数：

- `prompt`：供界面编辑和复制的原始提示词。
- `effectivePrompt`：完成 `@` 和文本资源解析后，实际提交给模型的提示词。
- `generationMode` / `generationType`、`model`、`size`、`quality`、视频参数：实际提交值。
- `generationReferences`：按实际提交顺序保存所有模态参考。
- `seed`：成功后保存服务返回值；「再次生成」默认生成新 seed，不复用旧 seed。

图片、视频、文本的生成根节点必须在网络请求开始前写入完整快照，确保请求失败时也能重试。

完成条件：断开原 Config 的输入连线、修改原文本节点或切换语言后，失败节点仍能从自己的快照重新提交同一请求。

### 2.3 单任务与批任务 ID

- 单结果节点使用 `metadata.jobId`。
- `CanvasNodeImage` 和 `CanvasNodeText` 增加各自可选的 `jobId`、`isTimeout`。
- 批量生成的每一次 ComfyUI 提交只写对应槽位，不能反复覆盖根节点的唯一 `jobId`。

任务 ID 生命周期：

1. 新提交前清空目标槽位的旧 `jobId` 和 `isTimeout`。
2. 收到 `submitted` 后写入本次 `jobId`。
3. 成功后清空 `jobId` 和 `isTimeout`。
4. 非超时失败清空 `jobId` 和 `isTimeout`。
5. 只有超时失败保留 `jobId`，并设置 `isTimeout: true`。

完成条件：批量生成 N 张图时能从节点数据中一一对应看到 N 个任务状态，重试第 i 张不会查询第 j 张的任务。

## 3. 按顺序实施

一次只完成一个批次。每个批次完成后先检查差异范围，再进入下一批次。

### 批次 A：连接语义与结果再次生成

涉及文件：

- `web/src/types/canvas.ts`
- `web/src/pages/canvas/project.tsx`
- `web/src/lib/canvas/canvas-resource-references.ts`
- `web/src/lib/canvas/canvas-generation-helpers.ts`
- `web/src/components/canvas/canvas-node-prompt-panel.tsx`
- 所有构造 `CanvasConnection` 的画布工具函数和测试

操作步骤：

1. 增加 `CanvasConnection.kind`。
2. 用户拖线、引用选择器和 Agent 连线写 `kind: "input"`。
3. 所有自动派生结果连线写 `kind: "lineage"`。
4. `getContextInputNodes`、`getConnectedConfigInputNodes`、`getGenerationResourceNodes` 只读取 `input`。
5. `findRetrySourceNode` 只沿 `lineage` 回溯；优先使用节点自己的快照，不再用当前 Config 内容替代历史请求。
6. 给生成入口增加明确 intent，例如 `"new" | "repeat" | "derive" | "retry" | "resume"`。不要用布尔值组合表达。
7. 成功结果面板提供「再次生成」和「基于当前结果生成」两个明确动作。
8. `repeat` 从节点快照构建请求；`derive` 才把当前图片或 Omni 视频加入参考。
9. 每次创建的新结果只增加一条 `lineage`，不删除任何 `input` 或旧 `lineage`。

当前缺陷定位：

- `project.tsx` 的 `sourceReference` 会把非空图片节点自身无条件塞进参考图。
- `project.tsx` 在生成后创建普通无类型连线。
- `canvas-resource-references.ts#getGenerationResourceNodes` 会把普通入线当生成输入，却无法判断它是血缘还是用户输入。
- `canvas-node-generation.ts#buildNodeGenerationContext` 只有源节点为 Config 时才按 Composer 协议解析，结果节点再次提交可能把原始 `@[node:id]` 发送给模型。

完成条件：四类用例“文生图、图生图、文生视频、图生视频”执行「再次生成」后，服务层收到的模式和参考列表与第一次相同；执行「基于当前结果生成」时才出现结果自身。

### 批次 B：失败重试、超时续查与批量任务

涉及文件：

- `web/src/pages/canvas/project.tsx`
- `web/src/components/canvas/canvas-node-hover-toolbar.tsx`
- `web/src/types/canvas.ts`
- `web/src/services/api/image.ts`
- `web/src/services/api/video.ts`
- `web/src/services/api/comfyui.ts`

操作步骤：

1. 工具栏判断改为 `Boolean(metadata.isTimeout && metadata.jobId)`，不能仅判断 `jobId`。
2. 普通失败按钮文案为「重试」，调用 intent `retry`，提交新的 `/prompt`。
3. 超时且有任务 ID 时按钮文案为「继续查询」，调用 intent `resume`，只查询 `/history/{jobId}`。
4. `handleRetryNode` 只有在 `resume` 时才把旧 `jobId` 传给 service。
5. 普通 `retry` 使用保存的 `effectivePrompt`、模型参数和 `generationReferences`，不读取当前上游图。
6. 批量图片和批量文本的 `onProgress` 写对应槽位的 `jobId`。
7. 单个批量槽位失败时只更新该槽位；根节点状态按“至少一个成功则可展示，仍有失败则保留部分失败标记”计算。
8. 子结果重试成功后同步重新计算来源 Config 状态，不能让 Config 永久停留在 error。

当前缺陷定位：

- `canvas-node-hover-toolbar.tsx` 中变量 `isTimeoutWithJob` 实际只检查 `jobId`。
- `project.tsx` 首次失败会保留普通失败任务的 `jobId`。
- `handleRetryNode` 对文本、视频、图片都无条件传入已有 `jobId`。
- 批量图片的多个 `onProgress` 同时覆盖根节点 `metadata.jobId`。
- 图片重试用原始 `prompt`，视频/文本重试用当前图拓扑，两者都不是稳定的历史请求重放。

完成条件：普通失败第一次点击「重试」就出现新的 `/prompt` 请求；超时点击「继续查询」不出现新的 `/prompt`；批量第 i 项只使用自己的任务 ID。

### 批次 C：取消和并发状态

涉及文件：

- `web/src/pages/canvas/project.tsx`
- `web/src/lib/canvas/canvas-generation-helpers.ts`
- `web/src/services/api/comfyui.ts`

操作步骤：

1. 把单值 `runningNodeId` 改成可并发的 `Set<string>` 状态，或从活动请求 Map 派生等价的可订阅状态。
2. 开始任务只添加本任务 ID；`finally` 只移除本任务 ID，不能清空其他任务。
3. 每个节点的 `isRunning` 使用集合包含关系；停止按钮只停止该节点关联的请求。
4. `isGenerationCanceled` 明确认可 `AbortError` 和 `ComfyuiAbortedError`。
5. 图片、文本、视频请求统一安装 abort 监听，并执行同一取消流程。
6. 实现按任务取消：先 `GET /queue` 定位 `jobId`；任务在等待队列时 `POST /queue`，body 为 `{ "delete": [jobId] }`；只有确认当前运行任务就是目标任务时才调用全局 `/interrupt`。
7. 不允许一个节点的取消操作无条件 `/interrupt`，以免杀掉另一个并发任务。
8. 用户主动停止后节点进入 idle 或明确的 cancelled 展示，不弹“生成失败”，不覆盖已有成功媒体。

当前缺陷定位：

- `project.tsx` 用一个 `runningNodeId` 表示实际上支持并发的请求 Map，任一任务完成都会 `setRunningNodeId(null)`。
- `canvas-generation-helpers.ts#isGenerationCanceled` 不识别 `ComfyuiAbortedError`。
- `comfyui.ts#cancelJob` 忽略 `_jobId` 并无条件调用全局 `/interrupt`。
- `requestComfyuiVideo` 没有像图片和文本一样在 abort 时取消 ComfyUI 任务。

完成条件：同时启动 A、B 两个节点，A 完成或取消后 B 仍显示运行且可单独停止；停止 A 不会取消 B；主动停止不进入 error。

### 批次 D：模型、视频输入与无产物错误

涉及文件：

- `web/src/lib/canvas/canvas-generation-helpers.ts`
- `web/src/services/api/comfyui.ts`
- `web/src/components/canvas/canvas-config-node-panel.tsx`
- `web/src/components/canvas/canvas-node-prompt-panel.tsx`
- `web/src/components/video-settings-panel.tsx`

操作步骤：

1. service 层优先使用本次请求已经解析出的 `config.model`；全局 `textModel` / `videoModel` 只作为没有请求模型时的后备。
2. 节点 ModelPicker 选出的模型必须决定实际 channel 和 workflow，尤其覆盖“节点模型与全局模型分属不同渠道”的情况。
3. Config 从图片/文本模式切换到视频模式时，如果 `size` 不是视频支持的像素档位，立即写入视频默认值 `544x960`；界面显示值、metadata 和实际提交值必须一致。
4. Frame 模式要求 1～2 张图片；超过 2 张或连入视频/音频时提交前显式报错。不能静默丢弃第 3 张图、视频或音频。
5. Omni 模式继续执行 9 图、3 视频、3 音频的上限校验。
6. 增加明确的“任务成功但没有目标产物”错误。图片、局部编辑的结果数组为空时抛错并记失败日志；视频无视频产物时抛“无视频输出”，不能抛 `ComfyuiAbortedError`。

当前缺陷定位：

- `requestComfyuiText` 使用 `config.textModel || config.model`。
- `submitComfyuiVideoJob`、`requestComfyuiVideo` 使用 `config.videoModel || config.model`。
- Frame 分支只读取前两张图片，其余图片及全部音视频引用被静默忽略。
- `requestComfyuiImage` 允许空 `items` 作为 success 返回。
- `pollComfyuiVideoJob` 把“任务完成但没找到视频”错误分类成“已取消”。

完成条件：节点选择的文本/视频模型与实际请求渠道一致；Frame 非法输入在任何上传和 `/prompt` 之前失败；完成但无产物的日志状态为 failed 且提示准确。

### 批次 E：`@` 提及协议

涉及文件：

- `web/src/components/canvas/canvas-prompt-chip-input.tsx`
- `web/src/components/canvas/canvas-config-composer.tsx`
- `web/src/components/canvas/canvas-node-generation.ts`
- `web/src/lib/canvas/canvas-resource-references.ts`

操作步骤：

1. 所有引用 Chip 的持久化值统一为 `@[node:<稳定节点ID>]`。
2. Chip DOM 保存 `data-ref-node-id`；序列化时输出稳定 token，显示时再按当前语言和顺序计算标签。
3. 删除按本地化标签（如“图片参考 1”）或节点标题做 `replaceAll` 的解析路径。
4. 文本节点只在匹配稳定 token 时替换内容；普通提示词中恰好出现节点标题时保持原文。
5. 解析前校验每个 token：节点存在、属于当前可用输入、资源可读取。任一条件不满足即阻止提交并指出节点，不得静默删除 token。
6. 同一个节点被提及多次时，文本可多次展开，媒体参考列表只保留一次且保持首次出现顺序。
7. Config Composer 没有 token 时只提交纯文本；有 token 时只提交被明确提及的媒体。未提及的连接文本继续按既有规则追加，但该规则只在非 Composer 普通节点输入中保留。

当前缺陷定位：

- `CanvasPromptChipInput` 当前把本地化 `reference.label` 写回 prompt。
- `buildNodeGenerationContext` 会把节点标题当替换关键字，可能改写普通句子中的同名词。
- `buildComposerGenerationContext` 遇到不存在或已断开的 token 时直接输出空字符串。

完成条件：插入引用后切换中英文、调整连接顺序，token 仍指向原节点；断开被提及节点后生成被显式拦截；普通文本与节点标题同名时不被替换。

### 批次 F：节点状态、Agent 连线、组资源与音频入口

涉及文件：

- `web/src/pages/canvas/project.tsx`
- `web/src/lib/canvas/canvas-agent-ops.ts`
- `web/src/lib/canvas/canvas-node-geometry.ts`
- `web/src/lib/canvas/canvas-resource-references.ts`
- `web/src/services/api/audio.ts`
- `web/src/components/canvas/canvas-config-node-panel.tsx`
- `canvas-agent/src/canvas/operations.ts`
- `canvas-agent/src/canvas/schemas.ts`

操作步骤：

1. 从已有成功图片、视频、音频或文本派生新结果时，只让新结果进入 loading/error；来源节点继续显示原内容和 success。
2. 抽出 UI 与 Agent 共用的连线校验函数。Agent `connect_nodes` 必须拒绝：缺失节点、自连接、Group 作为目标、Config 到 Config、用户输入把 Config 当来源、重复连线。
3. Agent 建立的普通连线固定为 `input`；`lineage` 只允许内部派生流程创建。
4. `getGroupResourceNodes` 按文档实现递归展开，使用 visited 集合防止异常数据形成循环；按画布/连接顺序去重。
5. 当前 `requestAudioGeneration` 无条件抛错，因此在 ComfyUI 音频工作流真正实现前，隐藏 Config 的“音频生成”模式并让 Agent `canvas_generate_audio` 返回明确的“不支持”能力错误。保留音频节点播放和作为 Omni 视频参考的能力。

当前缺陷定位：

- `project.tsx` 的 `markSourceStatus` 会在视频/音频派生失败时把仍有成功内容的来源节点改成 error，`CanvasNode` 随后隐藏原媒体。
- `applyCanvasAgentOps` 只检查节点存在和重复，没有复用 `normalizeConnection`。
- `getGroupResourceNodes` 只读取一层直属资源，文档却承诺递归。
- `requestAudioGeneration` 是无条件 throw，但界面和 Agent 仍暴露音频生成入口。

完成条件：派生失败不遮住来源媒体；Agent 无法创建 UI 不允许的连接；嵌套组能展开全部资源且循环数据不会死循环；用户看不到必然失败的音频生成入口。

### 批次 G：测试、依赖与文档收口

涉及文件：

- `web/src/services/api/__tests__/comfyui.test.ts`
- `web/src/services/api/__tests__/comfyui-log.test.ts`
- 新增画布生成上下文、重试和 Agent 连线测试
- `web/package.json` 与锁文件
- `canvas-agent/package.json` 与 `package-lock.json`
- `docs/content/docs/development/comfyui-workflow-standard.zh-CN.mdx`
- `CHANGELOG.md`
- `docs/content/docs/progress/todo.mdx`
- `docs/content/docs/progress/pending-test.mdx`

操作步骤：

1. 把仍模拟旧 `/api/v2/jobs` 代理的测试改为原生 ComfyUI：
   - `POST /prompt` 返回 `{ "prompt_id": "job_1" }`。
   - `GET /history/job_1` 返回以 `job_1` 为键的历史对象。
   - 图片/视频下载匹配 `/view?...` 或 `/api/view?...`。
   - 取消测试覆盖 `/queue` 的 `{ "delete": [jobId] }` 以及受保护的 `/interrupt`。
2. `applyBindings` 的未知 `class_type` 用例按项目标准改为“依据候选输入名动态绑定”，不再期待跳过。
3. 新增第 4 节全部验收矩阵的自动化测试；网络边界全部使用确定性 mock。
4. 前端以 Bun 为唯一文档化包管理器：在 `web/package.json` 声明 `packageManager: "bun@1.4.0"`，只保留并更新 `bun.lock`。删除其他前端锁文件前先确认没有 CI 使用它们。
5. `canvas-agent/package-lock.json` 与 `package.json` 重新同步，保证干净环境 `npm ci` 可执行，并在 package 中声明 npm 版本。
6. 删除 ComfyUI 标准文档中仍宣称项目支持 `comfy-api-proxy` 的段落；取消契约写成当前原生 API 行为。
7. 按项目规则更新 Changelog、todo 和 pending-test。不要把本手册中的计划项提前写成“已实现”。

当前基线：

- Web TypeScript 检查通过。
- Web 测试 61 个中 47 个通过、14 个失败；主要原因是测试仍 mock 已移除的旧代理端点。
- Canvas Agent 测试 126/126 通过。
- `web` 的 `npm ci` 因 Ant Design peer 冲突失败；项目文档实际使用 Bun。
- `canvas-agent` 的 `npm ci` 因 lock 与 package 不同步失败。
- 本地 3000 端口的首页、画布库、生图、视频、配置页可以打开；视频页控制台有一个 Drawer `height` 弃用警告。

完成条件：测试代码与原生 ComfyUI 契约一致；锁文件有明确归属；文档不再描述已移除的代理模式；变更记录只陈述实际完成内容。

## 4. 必须覆盖的验收矩阵

执行 Agent 需要为每一项补测试。按项目规则，代码完成后不主动执行构建和测试，由交付人统一执行。

| ID | 场景 | 必须观察到的结果 |
| --- | --- | --- |
| G01 | 文生图成功结果「再次生成」 | 新 `/prompt`；0 张参考图；原节点不变 |
| G02 | 图生图成功结果「再次生成」 | 使用原参考图快照；不包含结果自身 |
| G03 | 文生视频成功结果「再次生成」 | 新 `/prompt`；无媒体参考 |
| G04 | 图生视频成功结果「再次生成」 | 原图/视频/音频参考及顺序不变 |
| G05 | 图片结果「基于当前结果生成」 | 当前图片是第一张参考图 |
| G06 | Omni 视频结果「基于当前结果生成」 | 当前视频是第一段视频参考 |
| G07 | Frame 视频结果尝试以视频派生 | 提交前明确拦截并提示先提取帧 |
| G08 | 任意生成成功 | 原 `input` 连线保留，只新增 `lineage` |
| G09 | 上游再次生成 | 已有下游不自动请求、不变状态 |
| R01 | 普通 ComfyUI 失败后首次重试 | 新 `/prompt`，不查询旧失败 job |
| R02 | 超时且有 jobId 后继续查询 | 无新 `/prompt`，查询原 `/history/jobId` |
| R03 | 超时但 jobId 缺失 | 显示重新提交，不显示继续查询 |
| R04 | 批量 3 图，第 2 图失败 | 第 2 图重试使用第 2 图任务状态，不碰 1/3 |
| C01 | A、B 并发，A 完成 | B 仍显示运行并可停止 |
| C02 | A、B 并发，停止排队中的 B | 删除 B 队列项，不 `/interrupt` A |
| C03 | 主动停止图片/文本/视频 | 节点不进入 error，不显示失败 toast |
| M01 | 节点模型与全局模型在不同渠道 | 请求使用节点所选渠道和 workflow |
| V01 | Frame 连接 3 图 | 上传和提交前拦截 |
| V02 | Frame 连接视频或音频 | 上传和提交前拦截 |
| V03 | ComfyUI 完成但无视频输出 | “无视频输出”失败，不是“已取消” |
| I01 | ComfyUI 完成但无图片输出 | 失败日志且提示无图片输出 |
| A01 | 插入 `@` 后切换语言 | 仍解析到同一 nodeId |
| A02 | 删除被 `@` 的节点 | 提交前报资源缺失，token 不静默消失 |
| A03 | 提示词包含与文本节点标题同名的普通词 | 普通词保持原样 |
| O01 | Agent 自连接、Config→Config、→Group | 操作被拒绝，快照不产生非法边 |
| O02 | 嵌套组包含多模态资源 | 每个资源按稳定顺序只出现一次 |
| S01 | 从成功视频派生失败 | 来源视频仍可播放且保持 success |

## 5. 实施边界

- 生成渠道保持为本地原生 ComfyUI，不引入 OpenAI、Gemini、代理层或新后端。
- 复用当前 Zustand、本地 React State、localforage 和现有服务目录。
- 业务字段继续存放在 `metadata`，不把渲染状态塞入服务层。
- 不做旧本地数据迁移兼容。
- 不顺手重构无关页面，不修改画布主题，不替换状态管理库。
- 每个批次只改其列出的文件和直接受类型变化影响的测试/调用点。
- 遇到业务口径与第 1 节冲突时停止实现，先向用户确认，不自行选择另一套语义。

## 6. 最终交付检查

- [ ] 所有连线都有明确 `kind`。
- [ ] 生成、再次生成、基于结果生成、失败重试、超时续查是五个明确 intent。
- [ ] 四类生成结果再次生成不会改变生成类型或丢参考。
- [ ] 批量任务 ID 按槽位保存。
- [ ] 并发显示、停止和取消互不干扰。
- [ ] 节点模型决定实际请求渠道。
- [ ] `@` 持久化为稳定 nodeId token，失效引用会显式报错。
- [ ] Agent 不能创建非法连接。
- [ ] Frame 模式不静默丢素材。
- [ ] 无产物与取消使用不同错误。
- [ ] 来源成功媒体不会被子任务失败遮住。
- [ ] 音频死入口已隐藏或已有真实 ComfyUI 实现；不得保持“可点击但必失败”。
- [ ] 测试与文档只描述原生 ComfyUI。
- [ ] Changelog、todo、pending-test 与实际完成范围一致。
