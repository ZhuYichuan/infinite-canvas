# 1. 文生图工作流目录 (Text to Image)

本目录收录系统内置的标准文生图生成工作流，支持纯文本描述直接驱动高画质图像生成。包含以下两款核心模型工作流：

---

## 包含工作流清单

| 工作流名称 | 对应文件 | 核心模型 | 采样步数 | 核心特性 |
| :--- | :--- | :--- | :---: | :--- |
| **Z-Image-Turbo 文生图 (默认)** | [`z_image_turbo_api.json`](./z_image_turbo_api.json) | `Z-Image-Turbo` (BF16) | 4~8 步 | 蒸馏极速推理、Qwen3-4B 文本编码、秒级出图 |
| **Qwen-Image-2.1 文生图** | [`qwen_image_21_api.json`](./qwen_image_21_api.json) | `Qwen-Image-2.1` (BF16) | 25 步 | Qwen3-VL 8B 视觉语言大模型引导、深度多模态理解、超写实画质、天然两栖（无参考图时纯文生图） |

可视化工程文件：
- [`z_image_turbo_workflow.json`](./z_image_turbo_workflow.json)：ComfyUI 可视化拖拽查看编辑图

---

## 模型一：Z-Image-Turbo (极速版)

- **模型名称**: `Z-Image-Turbo`
- **适用场景**: 纯文本描述驱动的高画质图像快速生成，追求秒级即时出图反馈。
- **必要权重文件（存放在 ComfyUI `models/` 目录）**:
  - `diffusion_models/z_image_turbo_bf16.safetensors`
  - `text_encoders/qwen_3_4b.safetensors`
  - `vae/ae.safetensors`
- **特点**: 4~8 步出图，显存最低 8GB，消费级显卡极速生成。

---

## 模型二：Qwen-Image-2.1 (旗舰大模型版)

- **模型名称**: `Qwen-Image-2.1`
- **适用场景**: 追求极致光影、细腻质感与复杂提示词深度理解的电影级文生图。
- **工作流文件**: [`qwen_image_21_api.json`](./qwen_image_21_api.json)
- **必要权重文件（存放在 ComfyUI `models/` 目录）**:
  - `diffusion_models/qwen_image_2.1_bf16.safetensors`（UNet 主干扩散模型）
  - `clip/qwen3vl_8b_bf16.safetensors`（Qwen3-VL 8B 多模态视觉语言大模型，加载器类型 `qwen_image`）
  - `vae/qwen_image_2.1_vae_bf16.safetensors`（专用 VAE 潜空间编解码器）
- **核心技术特点**:
  1. **大语言模型级提示词遵循**：依托 8B 级多模态大模型 CLIP，对古风、复杂长句、多主体关系、艺术风格与微小细节具备理解力；
  2. **内置加速缓存**：采用 `QwenImage21Cache` 专用加速机制，25 步即可获得饱满收敛的成图质量；
  3. **天然两栖架构**：内置 10 个参考图槽位（`ref_image_01` ~ `ref_image_10`）；当画布节点**未连接任何参考图**时，系统自动剪除参考图分支，无缝作为**纯文生图**工作流运行；
  4. **标准槽位**：动态绑定 `prompt`、`seed`、`width`、`height`，输出槽位为标准 `output_image`（SaveImageAdvanced 节点）。
