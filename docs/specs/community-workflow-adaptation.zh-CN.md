# 无限画布「社区」模块架构调研与工作流适配工坊设计规范
## Community Architecture & Workflow Porting Hub Specification

> **文档状态**: `Draft / Under Review`  
> **编写日期**: 2026-10-25  
> **关联模块**: 社区中心 (`/community`)、工作流管理 (`/workflows`)、工作流适配引擎 (`web/src/services/api/comfyui-adapter.ts`)  
> **目标**: 构建纯前端无服务器（Local-First & Serverless）的社区生态系统，首发推出**「工作流转换与适配工坊（Workflow Adaptation Studio）」**，打通从“外部 ComfyUI 工作流”到“无限画布原生工具预设”的端到端桥梁。

---

## 1. 需求与愿景背景 (Vision & Strategic Context)

### 1.1 为什么无限画布需要「社区」？
无限画布（Infinite Canvas）是一个本地优先（Local-First）、纯浏览器直连自建 ComfyUI（端口 8188）的 AI 创作工作台。目前系统内建了文生图、图生图、局部编辑、全能参考视频、首尾帧视频、音乐生成、人脸精修、深度视频等 9 大类出厂工作流。

然而，开源 AI 社区（Civitai、Liblib、OpenArt、GitHub、ComfyUI Discord）每日涌现出数以千计的全新架构与顶尖工作流（如 Wan2.1、HunyuanVideo、CogVideoX、FLUX.1-ControlNet、PuLID 风格化、AnimateDiff 复杂运镜等）。
- **痛点一（普通用户）**：普通创作者在社区看到惊艳的效果，下载了 ComfyUI 工作流文件，却无法在无限画布中将其当作可视化节点灵活连线组合；
- **痛点二（高级创作者）**：高级工作流开发者调配出了高质量的模型流水线，想要分享给使用无限画布的朋友，却不知道如何把工作流改造成能被画布参数控件、连线管道驱动的标准形态；
- **痛点三（生态孤岛）**：当前工作流主要保存在用户本地浏览器（IndexedDB），缺乏一套公开、透明、开箱即用的工作流分发与一键安装渠道。

### 1.2 为什么社区的首发核心模块是「工作流转换工坊」？
一个只有“静态下载列表”的社区是没有生命力的。社区生态的核心在于**“人人皆可将自己的工作流适配到画布中”**。
首发模块**「工作流转换工坊（Workflow Adaptation Studio）」**旨在提供一个**可视化、零门槛、自动诊断与沙箱验证的工作台**：
任何创作者只要把在 ComfyUI 调试好的任意 JSON 或生成样张拖入工坊，系统自动完成拓扑分析、槽位打标、模型挂载、环境依赖体检和试跑验证，并一键生成标准化的社区包或直接安装到画布中。

---

## 2. 架构模式选型：纯前端无服务器去中心化设计 (Serverless & Local-First)

严格遵循本项目的核心架构原则（参见 `AGENTS.md`）：**纯前端浏览器运行，不假设存在项目专有后端，认证与业务数据留在浏览器本地**。

```
┌────────────────────────────────────────────────────────────────────────┐
│                   GitHub 开源工作流仓库 (Decentralized Hub)             │
│        (例如: https://github.com/ZhuYichuan/infinite-canvas-community) │
│                                                                        │
│   ├── index.json                 (工作流市场全量元数据索引)               │
│   └── workflows/                                                       │
│       ├── wan2.1_t2v_speed/                                            │
│       │   ├── manifest.json      (作者、标签、插件依赖、模型清单)         │
│       │   ├── workflow.json      (经适配器规范化后的 API 工作流)         │
│       │   └── cover.webp         (效果预览缩略图)                        │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │ HTTPS (Raw JSON / GitHub API) │
                 ▼                               ▼
┌──────────────────────────────────┐ ┌──────────────────────────────────┐
│      社区工作流市场 (/community)    │ │      工作流转换工坊 (/community/studio) │
├──────────────────────────────────┤ ├──────────────────────────────────┤
│ 1. 浏览/检索社区优质工作流卡片      │ │ 1. 拖拽任意非标 JSON / 图片自诊断   │
│ 2. 一键安装到本地渠道 (Localforage) │ │ 2. 交互式拓扑与插槽可视化映射与微调 │
│ 3. 插件一键复制 Git Clone 指令    │ │ 3. 依赖体检 (ComfyUI 缺失节点/模型) │
│ 4. 模型权重直链与一键下载指引      │ │ 4. 本地 ComfyUI (8188) 沙箱试跑     │
│                                  │ │ 5. 一键导出社区包 / 提 PR 贡献社区  │
└──────────────────────────────────┘ └──────────────────────────────────┘
                 │                               │
                 └───────────────┬───────────────┘
                                 │ 写入本地存储 (useConfigStore)
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      无限画布运行时 (Infinite Canvas)                   │
│         画布主界面连线调度 ──(8188直连)──> 本地原生自建 ComfyUI         │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 社区元数据分发方案
借鉴现有 `web/src/pages/prompts/` 的第三方 GitHub 仓库同步机制（参见 `docs/content/docs/overview/third-party-prompt-repositories.zh-CN.mdx`）：
- 社区工作流索引以纯静态 JSON 文件托管于 GitHub 仓库中；
- 浏览器前端直连 GitHub Raw 或 jsDelivr CDN 拉取索引目录与封面图片；
- 用户亦可在设置中添加自己的私有/团队工作流仓库 URL，无缝实现企业内部私有工作流市场。

---

## 3. 核心模块设计：工作流转换工坊 (Workflow Adaptation Studio)

转换工坊的访问路由规划为 `/community/studio`（或在 `/community` 页面中作为核心标签页呈现）。它由 5 大递进式功能构成：

### 3.1 功能一：全格式零门槛导入与自动转译
- **支持导入形态**：
  1. **ComfyUI API 格式 JSON**（开发者模式导出的纯执行字典）；
  2. **ComfyUI 界面工作流 JSON**（包含 `nodes` 和 `links` 绘图布局的原始工程文件）；
  3. **ComfyUI 生成样张图片**（WebP / PNG）：通过解析图片二进制 Header 中的 `tEXt` / `zTXt` 数据块，直接提取嵌入的 `prompt` 与 `workflow` 元数据；
- **底层引擎驱动**：
  直接复用刚实现的深模块 [`web/src/services/api/comfyui-adapter.ts`](file:///Users/group/Documents/coder/claude_code/infinite-canvas/web/src/services/api/comfyui-adapter.ts) 之 `ingestWorkflow(rawInput)`：
  - 自动执行 UI 图 $\rightarrow$ API 执行图的格式编译；
  - 自动识别工作流所属的 9 大模态能力；
  - 自动溯源 `prompt`、`seed`、`width`/`height`、`output_*` 以及 Loader 的 `select_models_*` 标签。

### 3.2 功能二：交互式拓扑与插槽可视化映射面板
- **可视化流图展示**：
  复用并扩展 [`web/src/components/workflow-graph/comfy-flow-graph.tsx`](file:///Users/group/Documents/coder/claude_code/infinite-canvas/web/src/components/workflow-graph/comfy-flow-graph.tsx)：
  - 节点卡片右上角醒目渲染徽章：已识别为保留槽位的节点以彩色胶囊展示（如 `[正向提示词 (prompt)]`、`[采样种子 (seed)]`、`[输出图像 (output_image)]`、`[模型库挂载 (select_models_diffusion_models)]`）；
- **交互式点击指派与微调（Slot Override）**：
  - 当工作流结构复杂或自动推断存在多候选（`ambiguities.length > 0`）时，用户直接在流图上点击任意节点，弹出气泡菜单：
    - 「设为画布主提示词 (prompt)」
    - 「设为随机种子 (seed)」
    - 「设为主参考底图 (ref_image_01)」
    - 「设为视频首帧 (first_frame)」/「设为视频尾帧 (last_frame)」
    - 「设为最终输出端点 (output_image/output_video)」
  - 点选后即时重写该节点的 `_meta.title`，流图徽章与右侧插槽列表实时联动刷新，彻底告别底层 JSON 编辑。

### 3.3 功能三：运行环境体检医生 (Pre-flight Environment Doctor)
转换工坊直接调用本地自建 ComfyUI（默认 `http://127.0.0.1:8188`）提供的自省端点进行实时体检：
1. **必备插件自检**：
   - 调用 `GET /object_info` 获取当前 ComfyUI 已注册的全部节点类列表；
   - 对比当前工作流中用到的所有 `class_type`；
   - 若发现未注册类（例如使用了 `GetVideoComponents` 但未装 `ComfyUI-KJNodes`），精准罗列缺失节点列表，并提供一键复制命令：
     ```bash
     cd custom_nodes && git clone https://github.com/kijai/ComfyUI-KJNodes.git
     ```
2. **权重文件自检**：
   - 提取工作流中所有 Loader 的文件名参数（如 `flux1-dev.safetensors`、`qwen_2.5_vl_7b.safetensors`）；
   - 调用 `GET /api/experiment/models/{folder}` 检索对应本地目录中是否存在该模型文件；
   - 状态标识：已安装（绿色对勾）、未找到（黄色警告并附带 HuggingFace/Civitai 建议下载直链）。

### 3.4 功能四：本地 ComfyUI 一键沙箱试跑 (Sandbox Test Run)
- 工坊内置极简的**调试控制台（Sandbox Runner）**：
  - 根据适配推断出的槽位，动态生成测试表单（例如：如果识别出 `prompt` 和 `ref_image_01`，则仅渲染一个文本输入框和一个图片上传框）；
  - 点击 **「在本地 ComfyUI 试跑验证」**：
    - 调用 `submitJob` / `pollJob` 提交真实测试推理；
    - 实时订阅 `/ws` 展示进度条与当前运行节点；
    - 执行成功后，在右侧展示生成的图片或视频。
- **一键封面沉淀**：
  试跑成功的图像/视频可直接勾选为“工作流封面效果图（Cover Image）”，自动生成用于社区展示的 WebP 缩略图。

### 3.5 功能五：一键导出社区包与 GitHub 贡献引导
- **一键安装到本地画布**：
  点击「保存到我的画布」，调用 `useConfigStore.saveWorkflowGlobally`，无需离开页面即可立即在主画布或渠道配置中使用该工作流；
- **一键导出标准社区分享包 (ZIP)**：
  自动打包以下规范文件：
  - `workflow.json`: 已经过 AST 规范化打标、可直接执行的 ComfyUI API 工作流；
  - `manifest.json`: 机器可读的标准化社区元信息清单（见第 4 节）；
  - `cover.webp`: 效果预览图；
  - `README.md`: 自动生成的中文/英文使用指引与模型下载指南；
- **一键贡献至官方社区 (GitHub PR Flow)**：
  点击「提交至官方社区」，自动根据填写的信息生成 GitHub Issue / PR 的 Markdown 模板，并附带直达 GitHub PR 页面的快捷链接，极大繁荣开源生态。

---

## 4. 社区工作流元数据规范 (Community Manifest Specification)

为确保第三方开发者贡献的工作流能够被无限画布 100% 自动化解析与呈现，定义标准的 `manifest.json` 架构：

```json
{
  "$schema": "https://canvas.imihoo.com/schemas/community-workflow-v1.json",
  "id": "wan2.1-t2v-speed-720p",
  "name": "Wan2.1 极速文生视频 (720P)",
  "version": "1.0.0",
  "author": {
    "name": "CommunityCreator",
    "github": "https://github.com/creator",
    "homepage": "https://civitai.com/user/creator"
  },
  "category": "omniVideo",
  "description": "基于 Wan2.1 4-Step 蒸馏加速的超流畅 720P 电影感文生视频工作流，带高动态运镜增强。",
  "tags": ["Wan2.1", "Video", "Turbo", "720P", "Cinematic"],
  "license": "Apache-2.0",
  "hardware": {
    "minVramGb": 12,
    "recommendedVramGb": 16
  },
  "slots": {
    "inputs": [
      { "slot": "prompt", "label": "正向视觉描述", "type": "string", "required": true },
      { "slot": "seed", "label": "随机种子", "type": "int", "required": false },
      { "slot": "duration", "label": "视频时长(秒)", "type": "int", "default": 5, "options": [3, 5] },
      { "slot": "ref_image_01", "label": "首帧/垫图参考", "type": "image", "required": false }
    ],
    "outputs": [
      { "slot": "output_video", "label": "最终合成视频", "type": "video" }
    ]
  },
  "dependencies": {
    "customNodes": [
      {
        "name": "ComfyUI-KJNodes",
        "repository": "https://github.com/kijai/ComfyUI-KJNodes"
      },
      {
        "name": "ComfyLiterals",
        "repository": "https://github.com/M1kep/ComfyLiterals"
      }
    ],
    "models": [
      {
        "category": "diffusion_models",
        "filename": "wan2.1_t2v_1.3B_bf16.safetensors",
        "sizeBytes": 2800000000,
        "downloadUrl": "https://huggingface.co/Wan-AI/Wan2.1-T2V-1.3B/blob/main/wan2.1_t2v_1.3B_bf16.safetensors"
      },
      {
        "category": "text_encoders",
        "filename": "umt5_xxl_fp8_e4m3fn.safetensors",
        "sizeBytes": 4900000000,
        "downloadUrl": "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/blob/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn.safetensors"
      }
    ]
  }
}
```

---

## 5. 社区工作流市场集成与互通交互设计

### 5.1 页面路由与顶部导航
- **顶部主导航**：在 [`web/src/constant/navigation-tools.ts`](file:///Users/group/Documents/coder/claude_code/infinite-canvas/web/src/constant/navigation-tools.ts) 中增加：
  ```ts
  {
      slug: "community",
      icon: Users, // 或 Share2 / Compass
  }
  ```
- **路由分配** (`/web/src/router.tsx`)：
  - `/community`: 社区工作流市场（浏览、搜索、一键安装）；
  - `/community/studio`: 工作流转换工坊（导入转换、诊断调优、沙箱试跑、打包导出）。

### 5.2 市场卡片与一键安装交互
1. **分类胶囊与多维筛选**：
   - 顶部提供 9 大模态标签切换（文生图、图生图、局部编辑、全能视频、首尾帧、音乐、人脸精修、深度视频）；
   - 支持按模型架构过滤（Flux, SDXL, Qwen-Image, MiniMax, Wan, Hunyuan）；
2. **工作流详情抽屉**：
   - 点击卡片唤起侧边抽屉，顶部播放封面视频/展示大图；
   - 嵌入 `ComfyFlowGraph` 交互式节点流图预览；
   - 底部展示「必要模型权重列表」与「必要插件列表」；
3. **一键安装到我的画布（One-Click Install）**：
   - 点击「安装到画布」按钮：
     - 若本地环境检测通过，直接写入 `useConfigStore` 并弹出成功提示；
     - 若本地检测到缺少插件或模型，以警告弹层提示：“检测到你的 ComfyUI 缺少以下 1 个插件与 1 个模型”，提供一键复制命令，安装完成后随时生效。

---

## 6. 分阶段实施路线图 (Implementation Roadmap)

| 阶段 | 交付物 | 核心工作内容 | 验证接缝 (Seam) |
| :--- | :--- | :--- | :--- |
| **Phase 1: 转换工坊核心搭建** | `/community/studio` 页面 | 1. 拖拽 JSON/图片解析接入 `ingestWorkflow`<br/>2. 扩展 `ComfyFlowGraph` 支持点击覆盖槽位<br/>3. 一键「保存到本地画布」与「导出规范 JSON」 | 单元测试验证拖入各类非标工作流后的 AST 重写与槽位绑定准确性 |
| **Phase 2: 环境自检与沙箱试跑** | 插件/模型体检 + 本地试跑 | 1. 调用 `/object_info` 对比缺失节点<br/>2. 调用 `/api/experiment/models/*` 检查权重缺失<br/>3. 表单化试跑调度器与 WS 进度订阅 | 通过 Mock ComfyUI API 验证缺失节点检测与试跑提交正确性 |
| **Phase 3: 社区市场与生态联动** | `/community` 市场页面 | 1. 建立社区 GitHub 仓库与索引同步逻辑<br/>2. 社区工作流瀑布流、详情抽屉与「一键安装」<br/>3. 社区包导出 (ZIP) 与提 PR 模板引导 | 端到端验证从社区市场一键安装至渠道并在画布正常执行全流程 |

---

## 7. 结论与总结

将“工作流转换工坊”作为无限画布社区的首发模块，精准击中了开源 AI 领域最大的结构性痛点：**非标工作流进入门槛高、社区资产无法直接在可视化画布中联动使用**。
通过复用刚刚落地的 `WorkflowIngestionAdapter` 深模块，配合直连本地 ComfyUI 的环境体检与沙箱试跑机制，创作者不仅能用 1 分钟将任何 ComfyUI 工作流适配为画布工具，还能一键打包贡献给整个无限画布社区，从而构筑起极具生命力的高粘性创作者生态。
