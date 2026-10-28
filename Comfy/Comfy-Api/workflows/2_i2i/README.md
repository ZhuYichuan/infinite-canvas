# 2. 图生图工作流目录 (Image to Image)

本目录收录系统内置的高精度图生图与多图参考编辑工作流，支持提示词引导下的垫图生成、多图特征融合、风格迁移与一致性角色重塑。包含以下两款核心模型工作流：

---

## 包含工作流清单

| 工作流名称 | 对应文件 | 核心模型 | 采样步数 | 核心特性 |
| :--- | :--- | :--- | :---: | :--- |
| **Flux2.Dev 图生图 (默认)** | [`flux2_dev_i2i_api.json`](./flux2_dev_i2i_api.json) | `Flux2.Dev` (FP8 + Turbo LoRA) | 8~16 步 | Flow Matching 架构、顶级画面质感与细节刻画、多图特征融合 |
| **Qwen-Image-2.1 多图参考 (BF16)** | [`qwen_image_21_api.json`](./qwen_image_21_api.json) | `Qwen-Image-2.1` (BF16) | 25 步 | 支持最多 10 张参考图输入、Qwen3-VL 8B 视觉特征提取、无参考图时自动平滑回退纯文生图 |
| **Qwen-Image-2.1 多图参考 (Int8)** | [`qwen_image_21_int8_api.json`](./qwen_image_21_int8_api.json) | `Qwen-Image-2.1` (Int8) | 25 步 | 支持最多 10 张参考图输入、Qwen3-VL 8B (Int8) 视觉特征提取、显存减半消费级友好、天然两栖 |

可视化工程文件：
- [`flux2_dev_i2i_workflow.json`](./flux2_dev_i2i_workflow.json)：ComfyUI 可视化拖拽查看编辑图
- [`qwen_image_21_workflow.json`](./qwen_image_21_workflow.json)：Qwen-Image-2.1 BF16 可视化工作流图
- [`qwen_image_21_int8_workflow.json`](./qwen_image_21_int8_workflow.json)：Qwen-Image-2.1 Int8 可视化工作流图

---

## 模型一：Flux2.Dev (经典版)

- **模型名称**: `Flux2.Dev`
- **适用场景**: 提示词控制图生图、参考图特征融合、风格迁移与一致性角色重塑。
- **必要权重文件（存放在 ComfyUI `models/` 目录）**:
  - `diffusion_models/flux2_dev_fp8mixed.safetensors`
  - `loras/Flux2TurboComfyv2.safetensors`
  - `text_encoders/mistral_3_small_flux2_fp8.safetensors`
  - `vae/flux2-vae.safetensors`
- **特点**: Flow Matching 架构，8~16 步 Turbo 加速，显存推荐 16GB / 24GB。

---

## 模型二：Qwen-Image-2.1 (多图超大容量版)

- **模型名称**: `Qwen-Image-2.1`
- **适用场景**: 复杂多角色、多道具或多风格的综合参考生图，最大容量支持 10 张图片联合垫图。
- **工作流文件**: [`qwen_image_21_api.json`](./qwen_image_21_api.json)
- **必要权重文件（存放在 ComfyUI `models/` 目录）**:
  - `diffusion_models/qwen_image_2.1_bf16.safetensors`（UNet 主干扩散模型）
  - `clip/qwen3vl_8b_bf16.safetensors`（Qwen3-VL 8B 多模态视觉语言大模型）
  - `vae/qwen_image_2.1_vae_bf16.safetensors`（专用 VAE 潜空间编解码器）
- **核心技术特点**:
  1. **最多 10 张参考图插槽**：显式提供 `ref_image_01` 至 `ref_image_10` 插槽，经 `TextEncodeQwenImage21` 节点多通道注入；
  2. **智能自适应剪枝**：当用户在画布上仅连接 1~9 张图片时，未连满的参考图节点及其级联输入会在任务提交时自动剪除并清理，保证 ComfyUI 安全执行；
  3. **零图自动回退文生图**：当画布完全没有连线参考图时，节点直接退化为纯文生图执行，无需额外切换工作流；
  4. **标准槽位**：动态绑定 `prompt`、`seed`、`width`、`height`、`ref_image_01` ~ `ref_image_10`，输出槽位为标准 `output_image`。

---

## 模型三：Qwen-Image-2.1 (Int8 多图轻量版)

- **模型名称**: `Qwen-Image-2.1 (Int8)`
- **适用场景**: 消费级显卡（12GB~16GB）上的多图参考、多角色/风格融合与垫图生图，支持最多 10 张图片联合垫图。
- **工作流文件**: [`qwen_image_21_int8_api.json`](./qwen_image_21_int8_api.json)
- **可视化工程文件**: [`qwen_image_21_int8_workflow.json`](./qwen_image_21_int8_workflow.json)
- **必要权重文件（存放在 ComfyUI `models/` 目录）**:
  - `diffusion_models/qwen_image_2.1_turbo_int8_convrot.safetensors`（UNet 主干扩散模型 Int8 量化版）
  - `clip/qwen3vl_8b_int8_convrot.safetensors`（Qwen3-VL 8B 多模态视觉语言大模型 Int8 量化版，加载器类型 `qwen_image`）
  - `vae/qwen_image_2.1_vae_bf16.safetensors`（专用 VAE 潜空间编解码器）
- **核心技术特点**:
  1. **低显存消费级友好**：UNet 与 CLIP 均采用 Int8 量化，显存占用较 BF16 降低近半，使得 12GB~16GB 显存设备也能流畅执行多图联合垫图；
  2. **最多 10 张参考图插槽**：显式提供 `ref_image_01` 至 `ref_image_10` 插槽，经 `TextEncodeQwenImage21` 节点多通道注入；
  3. **智能自适应剪枝**：当用户在画布上仅连接 1~9 张图片时，未连满的参考图节点及其级联输入会在任务提交时自动剪除并清理，保证 ComfyUI 安全执行；
  4. **零图自动回退文生图**：当画布完全没有连线参考图时，节点直接退化为纯文生图执行，无需额外切换工作流；
  5. **标准槽位**：动态绑定 `prompt`、`seed`、`width`、`height`、`ref_image_01` ~ `ref_image_10`，输出槽位为标准 `out_image`。
