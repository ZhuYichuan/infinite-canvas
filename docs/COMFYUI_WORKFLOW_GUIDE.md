# Infinite Canvas · ComfyUI 工作流配置指南 / ComfyUI Workflow Configuration Guide

[中文版](#中文版) | [English Version](#english-version)

---

<a id="中文版"></a>
# 📖 中文版说明

## 1. 项目简介与架构演进

无限画布（Infinite Canvas）是一款面向 AI 创作的开源可视化工作台。本项目采用**纯前端无服务器架构**，所有画板工程、节点、连线、素材资产和配置均保存在浏览器本地（IndexedDB / LocalStorage）。

### 架构演进说明：直连原生 ComfyUI（端口 8188）
- **早期架构**：曾依赖 `comfy-api-proxy`（8189 端口中间代理服务）；
- **当前现状**：**已彻底移除 `comfy-api-proxy`**！系统现已全面改为**浏览器前端直连本地自建原生 ComfyUI（默认 `http://127.0.0.1:8188`）**，接口链路完全收敛为 ComfyUI 官方原生 HTTP REST / WebSocket 端点，无需任何中间代理。

```
浏览器前端 (Infinite Canvas Web)
       ↓ HTTP 直连
原生 ComfyUI (默认 http://127.0.0.1:8188)
```

### 核心特性
- **工作流驱动 UI**：画布节点的输入控件（正向提示词、分辨率宽高、随机种子、视频时长、参考素材端口）完全由你绑定的 ComfyUI 工作流动态决定；工作流中标记了什么槽位，画布节点就呈现什么控件（**未标记 = 不在 UI 上显示**）。
- **动态级联修剪（Dynamic Pruning）**：工作流可预设多达 9 张参考图、3 段视频、3 段音频，当你实际只连线了部分资源（或纯文本生图/视频）时，系统在向 ComfyUI 提交前会**自动彻底抹除未指派资产的参考节点及下游输入引用**，杜绝因悬挂空节点或默认测试图残留引发 ComfyUI `FileNotFoundError`。
- **开箱即用内置工作流**：系统已内置 6 大常用 API 工作流（文生图、图生图、局部重绘、文本/反推、全能参考视频、首尾帧视频），无需手动上传即可直接体验；上传自定义工作流后也可随时一键恢复内置。

---

## 2. 如何在画布中配置 ComfyUI 渠道

整个配置流程非常简单：**在 ComfyUI 导出 API 格式 JSON** ➔ **在画布设置中添加 ComfyUI 渠道** ➔ **上传自定义工作流（可选）**。

### 第一步：从 ComfyUI 导出 API 格式 JSON

无限画布需要的是 ComfyUI 的 **API 格式工作流**（包含节点 `inputs`、`class_type` 与 `_meta`），而非普通的界面图布局工作流。

1. 打开本地 ComfyUI 网页界面（通常为 `http://127.0.0.1:8188`）。
2. 点击右上角齿轮图标打开 **Settings（设置）**。
3. 勾选 **Enable Dev mode Options（启用开发者模式选项）**。
4. 返回主界面，在侧边控制面板中点击 **Save (API Format)** 或 **Export (API)**。
5. 保存导出的 `.json` 文件。

> ⚠️ **注意**：如果直接点击普通的“Save”保存工作流（包含 `nodes`、`links` 等界面绘图坐标的 JSON），上传到画布时会提示解析失败。

---

### 第二步：在画布中配置 ComfyUI 渠道

1. 打开无限画布网页，点击顶部导航栏右上角的 **「设置」图标**（⚙️）。
2. 在弹出面板中切换到 **「模型渠道」**（Channels）标签页。
3. 点击 **「新增渠道」**（或编辑现有渠道）：
   - **渠道名称**：自定义名称（如 `本地 ComfyUI`）。
   - **API 格式**：下拉选择 **`ComfyUI`**。
   - **Proxy URL / 服务地址**：填入你的原生 ComfyUI 地址，默认即为 **`http://127.0.0.1:8188`**（如通过局域网访问，填写对应局域网 IP，如 `http://192.168.1.100:8188`）。
   - **Proxy Token**：本地标准 ComfyUI 默认**无鉴权，留空即可**（仅在你在 ComfyUI 前方搭建了需要 Bearer Token 的反向代理时填写）。
4. 点击保存。

---

### 第三步：上传工作流并绑定能力（可选）

默认情况下，系统已经自动为以下常用模型预置了系统内置工作流：
- **ComfyUI T2I**：文生图工作流
- **ComfyUI I2I**：图生图工作流
- **ComfyUI Inpaint**：局部重绘 / 修图工作流
- **ComfyUI Video**：全能参考视频工作流（如 MiniMax H3）
- **ComfyUI Frame Video**：首尾帧视频生成工作流
- **ComfyUI Text**：多模态文本生成 / LLM 工作流

如果你有自调的模型或特定 LoRA 工作流：
1. 点击渠道编辑抽屉中的目标模型；
2. 点击 **「上传工作流」**，选择第一步导出的 API 格式 `.json` 文件；
3. 保存渠道后，画布即可直接调用你的专属工作流；如果想切回默认，随时点击 **「恢复默认」** 即可。

---

## 3. 工作流 `_meta.title` 标注规范

在 ComfyUI 中，系统通过各节点的标题（对应导出的 `_meta -> title`）来识别哪些输入参数需要由无限画布来动态填充和连线驱动。

### 如何在 ComfyUI 中修改节点标题
- 选中目标节点，**右键点击节点 ➔ 选择「Title」**（或双击节点标题重命名）。
- 将标题重命名为对应的**保留槽位关键词**（建议全小写）。

### 核心保留槽位词汇表

| 保留槽位名 (`_meta.title`) | 语义说明 | 推荐节点类型示例 | 匹配的目标输入字段 (`inputs`) |
| :--- | :--- | :--- | :--- |
| **`prompt`** | 正向生成提示词（节点自身提示词 + 上游文本连线内容） | `PrimitiveStringMultiline`, `CLIPTextEncode`, `PrimitiveString` | `value`, `text`, `prompt` |
| **`seed`** | 随机噪波种子（画布留空或 0 为随机，生成后实际 seed 自动写回节点） | `PrimitiveInt`, `KSampler`, `KSamplerAdvanced` | `value`, `seed`, `noise_seed` |
| **`width`** | 产出图像/视频的宽度（像素） | `PrimitiveInt`, `EmptyLatentImage` | `value`, `width`, `Number` |
| **`height`** | 产出图像/视频的高度（像素） | `PrimitiveInt`, `EmptyLatentImage` | `value`, `height`, `Number` |
| **`duration`** | 视频生成时长（秒数或帧数） | `PrimitiveFloat`, `PrimitiveInt` | `value`, `duration`, `frames`, `Number` |
| **`ref_image_01` ~ `09`** | 参考图片 1 至 9（按连线先后 FIFO 顺序分配纯文件名字符串） | `LoadImage`, `LoadImageMask` | `image` |
| **`ref_mask`** (或 `mask`) | 局部重绘遮罩（画布上涂抹生成的白色 Mask 掩码图） | `LoadImage`, `LoadImageMask` | `image` |
| **`first_frame`** | 视频起始帧（首帧参考图） | `LoadImage` | `image` |
| **`last_frame`** | 视频结束帧（尾帧参考图） | `LoadImage` | `image` |
| **`ref_video_01` ~ `03`** | 参考视频 1 至 3 | `LoadVideo`, `VHS_LoadVideo` | `file`, `video`, `path` |
| **`ref_audio_01` ~ `03`** | 参考音频 1 至 3 | `LoadAudio` | `audio`, `file` |
| **`output_image`** | 最终图像产出节点（**必须标在保存节点上**，不要标在预览节点） | `SaveImage` | - |
| **`output_video`** | 最终视频产出节点（**必须标在保存节点上**） | `SaveVideo`, `VHS_VideoCombine` | - |
| **`output_text`** | 最终文本生成产出节点 | `SaveText`, `ShowText` | - |

> 💡 **设计建议**：推荐在 ComfyUI 工作流中使用 **`Primitive` 基础参数节点**（如 `PrimitiveStringMultiline`、`PrimitiveInt`）将 `prompt`、`seed`、`width`、`height` 拆为独立的参数输入节点，并将这几个基础节点的标题直接重命名为 `prompt`、`seed`、`width`、`height`。

---

## 4. 标准标注代码示例

### 示例 1：标准文生图（T2I）工作流 API JSON 片段

```json
{
  "10": {
    "class_type": "PrimitiveStringMultiline",
    "inputs": {
      "value": "a cute orange cat sitting on a wooden bench"
    },
    "_meta": {
      "title": "prompt"
    }
  },
  "11": {
    "class_type": "PrimitiveInt",
    "inputs": {
      "value": 1024
    },
    "_meta": {
      "title": "width"
    }
  },
  "12": {
    "class_type": "PrimitiveInt",
    "inputs": {
      "value": 1024
    },
    "_meta": {
      "title": "height"
    }
  },
  "13": {
    "class_type": "PrimitiveInt",
    "inputs": {
      "value": 42
    },
    "_meta": {
      "title": "seed"
    }
  },
  "20": {
    "class_type": "SaveImage",
    "inputs": {
      "filename_prefix": "InfiniteCanvas",
      "images": ["19", 0]
    },
    "_meta": {
      "title": "output_image"
    }
  }
}
```

### 示例 2：局部重绘（Inpaint）工作流 API JSON 片段

```json
{
  "5": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "source_image.png"
    },
    "_meta": {
      "title": "ref_image_01"
    }
  },
  "6": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "mask_layer.png"
    },
    "_meta": {
      "title": "ref_mask"
    }
  },
  "7": {
    "class_type": "PrimitiveStringMultiline",
    "inputs": {
      "value": "wearing black sunglasses"
    },
    "_meta": {
      "title": "prompt"
    }
  },
  "8": {
    "class_type": "PrimitiveInt",
    "inputs": {
      "value": 0
    },
    "_meta": {
      "title": "seed"
    }
  }
}
```

### 示例 3：全能参考视频（MiniMax H3 等）工作流 API JSON 片段

```json
{
  "1": {
    "class_type": "PrimitiveStringMultiline",
    "inputs": { "value": "a cinematic camera pan around a neon cyber street" },
    "_meta": { "title": "prompt" }
  },
  "2": {
    "class_type": "PrimitiveInt",
    "inputs": { "value": 960 },
    "_meta": { "title": "width" }
  },
  "3": {
    "class_type": "PrimitiveInt",
    "inputs": { "value": 544 },
    "_meta": { "title": "height" }
  },
  "4": {
    "class_type": "PrimitiveFloat",
    "inputs": { "value": 6.0 },
    "_meta": { "title": "duration" }
  },
  "5": {
    "class_type": "LoadImage",
    "inputs": { "image": "ref1.png" },
    "_meta": { "title": "ref_image_01" }
  },
  "6": {
    "class_type": "LoadImage",
    "inputs": { "image": "ref2.png" },
    "_meta": { "title": "ref_image_02" }
  },
  "7": {
    "class_type": "LoadVideo",
    "inputs": { "file": "ref_motion.mp4" },
    "_meta": { "title": "ref_video_01" }
  },
  "8": {
    "class_type": "LoadAudio",
    "inputs": { "audio": "bgm.mp3" },
    "_meta": { "title": "ref_audio_01" }
  }
}
```

---

## 5. 原生接口链路与常见排错

### 原生 API 交互链路（8188 端口）
1. **参考资源上传**：直连 `POST /upload/image`（multipart/form-data）上传参考图/音视频到 ComfyUI 的 `input/` 目录，获取服务端返回的真实安全文件名；
2. **任务入队**：直连 `POST /prompt`（请求体为 `{ "prompt": <填好参数与文件名的 JSON>, "client_id": "<uuid>" }`），获取任务 `prompt_id`；
3. **轮询状态**：轮询 `GET /history/{prompt_id}`，任务完成后提取各节点的 outputs 产物文件名；
4. **获取结果文件**：通过 `GET /view?filename=...&subfolder=...&type=output` 获取二进制 Blob 并写入本地 IndexedDB；
5. **用户中断**：点击停止时直接调用 `POST /interrupt`，立即释放 GPU 算力。

### 常见问题与排错（FAQ）
1. **报错 `node_errors`**：
   - 检查 ComfyUI 控制台，通常说明工作流中引用的模型权重文件（如 Checkpoint、LoRA、VAE）未下载放置在 ComfyUI 对应的 `models/` 目录下。
2. **画布节点上缺少分辨率或时长调节框**：
   - 工作流中没有标记 `_meta.title = "width"` / `"height"` 或 `"duration"`。工作流驱动原则下，未标注即代表工作流内部锁死参数，UI 不开放调整。
3. **上传时报 `Workflow JSON must be an object`**：
   - 导出的不是 API 格式，请确认开启了 ComfyUI 的 Dev Mode 并使用 **Save (API Format)** 导出。

---

<br />
<br />

---

<a id="english-version"></a>
# 📖 English Version Guide

## 1. Introduction & Architecture Evolution

Infinite Canvas is an open-source visual workbench for creative AI workflows. It is architected as a **pure client-side static application** where all canvas boards, nodes, connections, asset blobs, and configurations are persisted locally in the browser (IndexedDB / LocalStorage).

### Architecture Evolution: Direct Connection to Native ComfyUI (Port 8188)
- **Legacy Architecture**: Previously relied on `comfy-api-proxy` (port 8189 intermediate proxy service).
- **Current Architecture**: **`comfy-api-proxy` is completely removed!** Infinite Canvas now **connects directly to your native self-hosted ComfyUI instance (default `http://127.0.0.1:8188`)**. All communication flows straight through standard ComfyUI REST and WebSocket endpoints without any middleware proxy.

```
Browser Frontend (Infinite Canvas Web)
       ↓ Direct HTTP
Native ComfyUI (Default http://127.0.0.1:8188)
```

### Core Capabilities
- **Schema-Driven UI**: Controls on canvas node cards (prompts, resolution presets, random seed, duration, reference asset input slots) are rendered dynamically based on the uploaded ComfyUI workflow (**unlabeled slot = hidden from UI**).
- **Dynamic Pruning**: Workflows may declare up to 9 reference images, 3 reference videos, and 3 reference audios. When fewer references (or none, e.g., pure text-to-video) are connected, unassigned reference loader nodes and intermediate bridge nodes are **automatically pruned before submission**, preventing ComfyUI runtime `FileNotFoundError` caused by placeholder filenames.
- **Built-In Workflows**: Pre-bundled with 6 production-ready API workflows (T2I, I2I, Inpaint, Text/VLM, Full Reference Video, First/Last Frame Video). You can start immediately without uploading custom JSONs, or restore built-in presets at any time.

---

## 2. How to Configure ComfyUI Workflows

Setup requires three straightforward steps: **Export API JSON from ComfyUI** ➔ **Add ComfyUI Channel in Settings** ➔ **Upload Custom Workflow (Optional)**.

### Step 1: Export Workflow in API Format from ComfyUI

Infinite Canvas requires ComfyUI's **API Format JSON** (which contains node `inputs`, `class_type`, and `_meta` records), rather than the visual graph layout JSON.

1. Open your local ComfyUI web UI (usually `http://127.0.0.1:8188`).
2. Click the gear icon in the menu to open **Settings**.
3. Check **Enable Dev mode Options**.
4. In the side control panel, click **Save (API Format)** or **Export (API)**.
5. Save the resulting `.json` file.

> ⚠️ **Note**: Standard workflow JSONs containing `nodes`, `links`, and canvas layout coordinates will fail validation when uploaded.

---

### Step 2: Configure ComfyUI Channel in Settings

1. In Infinite Canvas, click the **Settings icon** (⚙️) in the top-right header.
2. Navigate to the **Model Channels** tab.
3. Click **Add Channel** (or edit an existing channel):
   - **Channel Name**: Custom name (e.g., `Local ComfyUI`).
   - **API Format**: Select **`ComfyUI`**.
   - **Proxy URL / Server Endpoint**: Enter your native ComfyUI address, default is **`http://127.0.0.1:8188`** (or your LAN IP, e.g., `http://192.168.1.100:8188`).
   - **Proxy Token**: Native ComfyUI has **no authentication by default; leave blank** (only fill if you run ComfyUI behind a reverse proxy requiring Bearer tokens).
4. Click Save.

---

### Step 3: Upload and Bind Custom Workflows (Optional)

By default, the system already provisions built-in workflows for standard capabilities:
- **ComfyUI T2I**: Text-to-Image
- **ComfyUI I2I**: Image-to-Image
- **ComfyUI Inpaint**: Mask-guided inpainting
- **ComfyUI Video**: Multimodal reference video (MiniMax H3)
- **ComfyUI Frame Video**: First & Last frame video generation
- **ComfyUI Text**: Multimodal LLM / VLM

To bind your custom checkpoint or LoRA workflow:
1. Click the target model in the channel drawer;
2. Click **Upload Workflow** and select the API-format `.json` file;
3. Save the channel. Click **Reset to Default** anytime if you want to restore built-in workflows.

---

## 3. Workflow `_meta.title` Annotation Standards

Infinite Canvas uses the title of ComfyUI nodes (stored in `_meta -> title` within the API JSON) to match and populate dynamic inputs.

### How to Rename Node Titles in ComfyUI
- Right-click the target node ➔ select **Title** (or double-click the title bar).
- Change the title to the exact **reserved slot keyword** (lowercase recommended).

### Reserved Slots Vocabulary Table

| Reserved Slot (`_meta.title`) | Description | Example Node Types | Target Input Keys (`inputs`) |
| :--- | :--- | :--- | :--- |
| **`prompt`** | Positive prompt (combines node prompt + upstream text connections) | `PrimitiveStringMultiline`, `CLIPTextEncode`, `PrimitiveString` | `value`, `text`, `prompt` |
| **`seed`** | Random seed (empty or 0 = random; actual seed recorded after execution) | `PrimitiveInt`, `KSampler`, `KSamplerAdvanced` | `value`, `seed`, `noise_seed` |
| **`width`** | Output width in pixels | `PrimitiveInt`, `EmptyLatentImage` | `value`, `width`, `Number` |
| **`height`** | Output height in pixels | `PrimitiveInt`, `EmptyLatentImage` | `value`, `height`, `Number` |
| **`duration`** | Video duration in seconds or frames | `PrimitiveFloat`, `PrimitiveInt` | `value`, `duration`, `frames`, `Number` |
| **`ref_image_01` ~ `09`** | Reference images 1 to 9 (assigned via FIFO connection order) | `LoadImage`, `LoadImageMask` | `image` |
| **`ref_mask`** (or `mask`) | Inpainting mask (drawn on canvas) | `LoadImage`, `LoadImageMask` | `image` |
| **`first_frame`** | First frame image for video generation | `LoadImage` | `image` |
| **`last_frame`** | Last frame image for video generation | `LoadImage` | `image` |
| **`ref_video_01` ~ `03`** | Reference videos 1 to 3 | `LoadVideo`, `VHS_LoadVideo` | `file`, `video`, `path` |
| **`ref_audio_01` ~ `03`** | Reference audios 1 to 3 | `LoadAudio` | `audio`, `file` |
| **`output_image`** | Output image node (**must be placed on saving nodes**, not preview nodes) | `SaveImage` | - |
| **`output_video`** | Output video node (**must be placed on saving nodes**) | `SaveVideo`, `VHS_VideoCombine` | - |
| **`output_text`** | Output text node | `SaveText`, `ShowText` | - |

> 💡 **Best Practice**: Use **`Primitive` nodes** (such as `PrimitiveStringMultiline` or `PrimitiveInt`) in ComfyUI for `prompt`, `seed`, `width`, and `height`, and name their titles directly as `prompt`, `seed`, `width`, and `height`.

---

## 4. Annotation Examples

### Example 1: Text-to-Image (T2I) Workflow API JSON

```json
{
  "10": {
    "class_type": "PrimitiveStringMultiline",
    "inputs": {
      "value": "a cinematic landscape at sunset"
    },
    "_meta": {
      "title": "prompt"
    }
  },
  "11": {
    "class_type": "PrimitiveInt",
    "inputs": {
      "value": 1024
    },
    "_meta": {
      "title": "width"
    }
  },
  "12": {
    "class_type": "PrimitiveInt",
    "inputs": {
      "value": 1024
    },
    "_meta": {
      "title": "height"
    }
  },
  "13": {
    "class_type": "PrimitiveInt",
    "inputs": {
      "value": 12345678
    },
    "_meta": {
      "title": "seed"
    }
  },
  "20": {
    "class_type": "SaveImage",
    "inputs": {
      "filename_prefix": "InfiniteCanvas",
      "images": ["19", 0]
    },
    "_meta": {
      "title": "output_image"
    }
  }
}
```

### Example 2: Inpainting Workflow API JSON

```json
{
  "5": {
    "class_type": "LoadImage",
    "inputs": { "image": "input_base.png" },
    "_meta": { "title": "ref_image_01" }
  },
  "6": {
    "class_type": "LoadImage",
    "inputs": { "image": "input_mask.png" },
    "_meta": { "title": "ref_mask" }
  },
  "7": {
    "class_type": "PrimitiveStringMultiline",
    "inputs": { "value": "red leather jacket" },
    "_meta": { "title": "prompt" }
  },
  "8": {
    "class_type": "PrimitiveInt",
    "inputs": { "value": 0 },
    "_meta": { "title": "seed" }
  }
}
```

### Example 3: Full Reference Video (MiniMax H3) Workflow API JSON

```json
{
  "1": {
    "class_type": "PrimitiveStringMultiline",
    "inputs": { "value": "slow cinematic drone view" },
    "_meta": { "title": "prompt" }
  },
  "2": {
    "class_type": "PrimitiveInt",
    "inputs": { "value": 960 },
    "_meta": { "title": "width" }
  },
  "3": {
    "class_type": "PrimitiveInt",
    "inputs": { "value": 544 },
    "_meta": { "title": "height" }
  },
  "4": {
    "class_type": "PrimitiveFloat",
    "inputs": { "value": 6.0 },
    "_meta": { "title": "duration" }
  },
  "5": {
    "class_type": "LoadImage",
    "inputs": { "image": "ref_character.png" },
    "_meta": { "title": "ref_image_01" }
  },
  "6": {
    "class_type": "LoadVideo",
    "inputs": { "file": "ref_motion.mp4" },
    "_meta": { "title": "ref_video_01" }
  },
  "7": {
    "class_type": "LoadAudio",
    "inputs": { "audio": "ref_bgm.mp3" },
    "_meta": { "title": "ref_audio_01" }
  }
}
```

---

## 5. Native Endpoints & Troubleshooting

### Direct API Protocol (Port 8188)
1. **Asset Upload**: `POST /upload/image` (multipart/form-data) uploads media into ComfyUI's `input/` directory and returns the sanitized filename string;
2. **Queue Prompt**: `POST /prompt` with `{ "prompt": <JSON>, "client_id": "<uuid>" }` queues the job and returns `prompt_id`;
3. **Poll Status**: `GET /history/{prompt_id}` checks completion and retrieves node output filenames;
4. **Fetch Output**: `GET /view?filename=...&subfolder=...&type=output` streams binary blobs directly to browser IndexedDB;
5. **Abort/Cancel**: `POST /interrupt` immediately halts GPU sampling when user cancels a task.
