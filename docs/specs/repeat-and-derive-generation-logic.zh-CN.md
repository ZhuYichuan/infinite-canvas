# 画布节点「再次生成」与「基于当前结果生成」操作逻辑文档

> **架构更新提示**：  
> 本功能已经过重构演进：**「基于当前结果生成 (Derive)」已全面移除**。所有成功生成的节点统一收敛为单一的**「再次生成 (Repeat)」**操作。  
> 移除原因：之前「基于当前结果生成」强行将上一轮输出作为隐式输入插槽，导致文生图意外变成图生图、视频首尾帧报错等非预期行为。无限画布遵循“显式连线”原则，如需使用产物作为下游参考，由用户在画布上直接拉线连接。同时，「再次生成」升级为支持在恢复干净快照参考的同时直接采纳提示词输入框中的微调内容。

> **对应 DOM 路径 (XPath)**：`/html/body/div/div/div/div[1]/div/main/section/div[2]/div[2]/div[10]/div[5]/div/div[3]/div[2]`  
> **对应前端组件**：[`web/src/components/canvas/canvas-node-prompt-panel.tsx`](file:///Users/group/Documents/coder/claude_code/infinite-canvas/web/src/components/canvas/canvas-node-prompt-panel.tsx)  
> **核心调度实现**：[`web/src/pages/canvas/project.tsx`](file:///Users/group/Documents/coder/claude_code/infinite-canvas/web/src/pages/canvas/project.tsx) 之 `handleGenerateNode`

---

## 1. 概述与组件定位

在无限画布中，当用户点击并选中一个**已经成功生成过内容**的节点（图片、视频、文本等）时，节点下方会唤起**提示词悬浮面板（Prompt Panel）**。

在面板右下角的操作按钮区域（即您提供的 XPath 对应容器）：
```html
<div className="flex shrink-0 items-center gap-1">
    <!-- 按钮 1: 再次生成 -->
    <Button type="text" onClick={() => submit("repeat")}>再次生成</Button>
    <!-- 按钮 2: 基于当前结果生成 -->
    <Button type="primary" onClick={() => submit("derive")}>基于当前结果生成</Button>
</div>
```

---

## 2. 按钮呈现的前置条件（什么时候会出现？）

组件内部通过 `canRepeat` 属性判定是否展示这两个操作：

```ts
const canRepeat =
    node.metadata?.status === "success" &&
    node.metadata.effectivePrompt !== undefined &&
    Array.isArray(node.metadata.generationReferences);
```

### 充要条件解析：
1. **节点必须处于成功状态**（`status === "success"`）：节点必须已经有了实际产物（图片、视频、文本）；
2. **持有有效提示词快照**（`effectivePrompt !== undefined`）：该节点在生成时已经保存了解析/宏替换后的最终有效提示词；
3. **持有上游资源引用快照**（`Array.isArray(generationReferences)`）：该节点生成时引用的所有上游资产（图片 ID、文本、视频等）均被持久化保存成了快照数组。

如果上述条件不满足（比如一个全新的空节点），该区域只会展示单箭头的普通「生成」按钮（`submit("new")`）。

---

## 3. 核心差异对照表

| 比较维度 | 「再次生成」(Repeat) | 「基于当前结果生成」(Derive) |
| :--- | :--- | :--- |
| **设计定位** | **历史请求重放 / 再次抽卡**<br/>（对本次生成结果不满意，换随机种子再试一次） | **衍生演进 / 下一阶段迭代**<br/>（当前结果很好，以此为底图/底料继续深加工） |
| **生成意图标识** | `intent = "repeat"` | `intent = "derive"` |
| **提示词来源 (Prompt)** | **强制还原历史快照**：<br/>取原生成时的 `sourceNode.metadata.prompt`，无视当前输入框编辑的内容 | **取当前输入框最新内容**：<br/>使用用户刚刚输入的提示词 `submittedPrompt`（不能为空） |
| **参考资源 (References)** | **严格还原当时的依赖快照**：<br/>通过 `restoreGenerationContext` 还原上次连线的资源，**不包含当前节点产物** | **当前节点产物作为第一参考核心**：<br/>自动提取当前节点内容（图片/视频/文本）注入为新的输入参考 |
| **工作流路由类型** | **沿用原能力**：<br/>上次是文生图 (T2I)，本次仍调用文生图 | **智能升级为图生图/视频衍生**：<br/>生图自动分流为图生图 (I2I) 工作流 |
| **产物节点形态** | 在原节点右侧偏移 96px 创建新的同类型独立产物节点 | 在原节点右侧偏移 96px 创建新的同类型独立产物节点 |
| **连线关系 (Connection)** | 建立血缘关系线：`原节点 ──(lineage)──> 新节点` | 建立血缘关系线：`原节点 ──(lineage)──> 新节点` |
| **对原节点的影响** | 原节点内容与成功状态完全保留，无任何污染 | 原节点内容与成功状态完全保留，无任何污染 |

---

## 4. 「再次生成 (Repeat)」的操作与底层逻辑

### 4.1 核心诉求
当用户对某次生成的结果不满意（或希望基于最新连线重新抽卡），希望**基于当前节点在画布上连接的线，更换随机 seed 重新提交生成**。

### 4.2 执行时序与底层逻辑
1. **提示词动态获取**：
   - 优先采纳用户当前在提示词输入框中微调的内容；若输入框为空则沿用上一轮提示词：
     ```ts
     const prompt = intent === "repeat" ? (submittedPrompt.trim() || sourceNode?.metadata?.prompt || "") : submittedPrompt;
     ```
2. **基于当前节点连接的线构建上下文（最新架构）**：
   - 系统调用 `buildNodeGenerationContext(nodeId, nodesRef.current, connectionsRef.current, prompt)`：
     - **严格基于当前节点在画布上实时连接的输入连线**收集参考图片、文本、视频等素材；
     - 用户如果中途新增、断开或更换了连线，再次生成时立即感知生效；
     - 彻底解除了对旧快照保存状态的强依赖，避免出现“缺少原始生成快照”的报错。
3. **更换 Seed 重新提交**：
   - 系统通过 `generateNextSeed(previousSeed)` 生成一个与上一次完全不同的全新随机种子；
   - 种子完整透传至图片（KSampler `seed`）、视频（`videoSeed`）及文本（`textSeed`）生成管道；
   - 彻底避免 ComfyUI 命中相同缓存导致生成出完全相同的重试结果。
4. **节点与连线创建**：
   - 保持原节点不变，在原节点右侧偏置 96px 的位置新建一个产物节点（`rootNode`）；
   - **连接父节点而非当前节点**：调用 `buildGeneratedNodeConnections`，将当前节点连接的上游父节点（输入素材与血缘来源）连线复制连接至新节点；若当前节点无上游连线，则平稳回退连接当前节点。彻底避免多次再次生成串联成单链，形成平行的兄弟拓扑结构；
   - 新节点初始为 `status: "loading"`，将新 seed 记录至新节点的元数据中。

---

## 5. 「基于当前结果生成 (Derive)」的操作与底层逻辑

### 5.1 核心诉求
用户觉得当前生成的产物非常好（比如生成了一个满意的角色模型），现在想要**以这张图为基底，进行下一步修改**（例如：“换成夜晚背景”、“给角色加上太阳镜”、“基于该动作做视频”等）。

### 5.2 执行时序与底层逻辑
1. **提示词采用最新输入**：
   - 校验当前 PromptPanel 输入框中的文字不能为空（为空时按钮自动被 `disabled`）；
   - 取用户最新输入的变更描述（例如“让人物微笑并穿上黑色外套”）。
2. **自动提取并注入当前节点产物为上游参考（多模态自适应）**：
   - **图片节点（`mode === "image"`）**：
     - 将当前节点的图片产物（`sourceNode.metadata.content`）自动封装成 `sourceReference` 对象；
     - 作为 `ref_image_01` 注入参考图片列表，并与其它已连线的参考图合并；
     - **工作流自动升级**：即使之前是“文生图”生成的图片，现在因为有了参考图，系统自动将其路由给 **ComfyUI 图生图（I2I）工作流**。
   - **视频节点（`mode === "video"`）**：
     - 将当前节点的视频内容封装为 `sourceVideo`，注入到 `referenceVideos` 中作为全能视频生成的视频参考源；
     - *防呆保护*：首尾帧视频模式由于硬件与工作流限制不支持视频输入，会显式弹窗提示“首尾帧模式不能直接使用视频结果，请先提取视频帧”。
   - **文本节点（`mode === "text"`）**：
     - 将原文本内容作为上下文，自动拼接为改写指令：
       ```text
       请根据要求修改以下文本。
       原文：
       {原文本内容}
       修改要求：
       {新提示词}
       ```
       提交大模型进行定向微调。
3. **新建产物节点与血缘追溯**：
   - 在右侧新建目标子节点；
   - 建立 `kind: "lineage"` 连线（`当前原图 ──> 衍生新图`）；
   - 新节点的生成快照 `generationReferences` 中会明确记录以原节点作为输入参考，形成完整的创作脉络。

---

## 6. 异常与边界保护机制

1. **原节点只读保护（Fail-safe）**：
   无论是再次生成还是基于结果生成，若 ComfyUI 执行报错或网络超时，只有新创建的子节点会显示错误状态，**原节点的内容、状态和元数据 100% 保持完好，绝不覆盖**；
2. **连线语义隔离**：
   两个按钮生成的新连线类型均为 `kind: "lineage"`，纯粹用于表达衍生脉络，不会被当成普通的输入参数线，避免在后续画布操作中造成循环依赖；
3. **输入防呆**：
   - 「基于当前结果生成」强依赖新提示词，输入为空时按钮自动置灰；
   - 「再次生成」由于完全重放历史，允许输入框留空直接点击。
