# MiniMax H3 首尾帧视频工作流

本工作流为系统内置的首尾帧定向插值视频（First-and-Last Frame Video）生成流水线，基于 **MiniMax H3 fl2va** 模型架构构建。

## 包含工作流规格与文件

| 规格类型 | API 工作流（画布直连） | 适用环境与特点 |
| :--- | :--- | :--- |
| **INT8 6步 SelfLift (系统默认 / 渐进超分版)** | [minimax_H3_i2v&t2v_int8_SelfLift_api.json](./minimax_H3_i2v&t2v_int8_SelfLift_api.json) | INT8 Singularity 底模 + **SelfLift 渐进式超分采样**（`SelfLiftH3Sampler` 结合 `minimax_h3_latent_upscaler_3d_conv_v1_fp32.pth`，前期低分辨率快速构建运动轨迹，跃升后全分辨率精修）+ **双 LoRA 协同**（`pika_h3_flex_fl2va_v1_bf16` + `H3-Licon-VBVR-I2V`）+ EasyCache，6 步采样（由 `step` 节点控制），在低显存下输出平滑细腻的高清首尾过渡 |
| **INT8 6步 Pika (质感版)** | [minimax_h3_fl2va_int8_convrot_6step_pika_api.json](./minimax_h3_fl2va_int8_convrot_6step_pika_api.json) | INT8 旋转量化底模 + **Pika Flex 蒸馏 LoRA**（`pika_h3_flex_fl2va_v1_bf16`，约 1.96 GB），采样 6 步（由新增的 `step` 节点控制），首尾帧插槽与参数同 4 步 PDMD，换更充分的细节与平滑过渡 |
| **INT8 4步 PDMD (无 FP8 硬件版)** | [minimax_h3_fl2va_int8_convrot_4step_pdmd_api.json](./minimax_h3_fl2va_int8_convrot_4step_pdmd_api.json) | INT8 旋转量化底模（`int8_convrot`，全量未剪枝，约 34 GB）替换 FP8 裁剪底模，挂载 PDMD 4步蒸馏 LoRA，首尾帧插值参数与 FP8 4步 PDMD 完全一致，用于未启用 FP8 硬件加速的运行环境 |
| **FP8 4步 PDMD (极致极速版)** | [minimax_h3_fl2va_fp8_4step_pdmd_api.json](./minimax_h3_fl2va_fp8_4step_pdmd_api.json) | 显存优化底模，挂载 PDMD 4步蒸馏 LoRA，仅需 4 步极速出片，大幅缩短生成耗时 |
| **FP8 20步 (消费级推荐)** | [minimax_h3_fl2va_fp8_20step_api.json](./minimax_h3_fl2va_fp8_20step_api.json) | 显存优化版，适合 RTX 3090/4090 或 16G~24G 消费级显卡 |
| **BF16 8步 Turbo (极速版)** | [minimax_h3_fl2va_bf16_8step_turbo_api.json](./minimax_h3_fl2va_bf16_8step_turbo_api.json) | 挂载 Turbo LoRA 加速，8 步极速出片，适合专业卡 / 高性能 GPU |
| **BF16 20步 (全量高精度)** | [minimax_h3_fl2va_bf16_20step_api.json](./minimax_h3_fl2va_bf16_20step_api.json) | 完整精度 20 步标准采样 |
| **UI 可视化工作流** | [minimax_H3_i2v&t2v_int8_SelfLift_workflow.json](./minimax_H3_i2v&t2v_int8_SelfLift_workflow.json)<br/>[minimax_h3_fl2va_fp8_4step_pdmd_workflow.json](./minimax_h3_fl2va_fp8_4step_pdmd_workflow.json)<br/>[minimax_h3_fl2va_int8_convrot_4step_pdmd_workflow.json](./minimax_h3_fl2va_int8_convrot_4step_pdmd_workflow.json)<br/>[minimax_h3_fl2va_int8_convrot_6step_pika_workflow.json](./minimax_h3_fl2va_int8_convrot_6step_pika_workflow.json)<br/>[minimax_h3_fl2va_workflow.json](./minimax_h3_fl2va_workflow.json) | ComfyUI 拖拽查看与调试用的完整节点图（含 SelfLift、4 步 PDMD、INT8 4 步 PDMD、INT8 6 步 Pika 与标准版） |

---

## 模型信息

- **模型名称**: `MiniMax H3 fl2va`
- **模型类型**: 首尾帧插值视频与音频联合生成扩散模型
- **适用场景**: 分镜首尾过渡连接、精准时空闭环叙事、动态变身与场景转场

### 必要权重文件（存放在 ComfyUI `models/` 目录）

#### 1. 核心扩散模型 (`models/diffusion_models/`)
- **INT8 Singularity 规格 (用于 SelfLift)**: `models/diffusion_models/Minimax-h3_Singularity_ref2va_v1.3_int8.safetensors`
- **INT8 Convrot 规格 (无 FP8 硬件加速)**: `models/diffusion_models/minimax_h3_fl2va_int8_convrot.safetensors`（全量未剪枝，约 34 GB）
- **FP8 规格**: `models/diffusion_models/minimax_h3_fl2va_pruned_fp8_scaled.safetensors`
- **BF16 规格**: `models/diffusion_models/minimax_h3_fl2va_bf16.safetensors`

#### 2. 文本与多模态编码器 (`models/text_encoders/`)
- **FP8 / 显存优化**: `models/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`
- **BF16 / 专业级**: `models/text_encoders/qwen3vl_32b_minimax_h3_bf16.safetensors`

#### 3. 编解码器 (`models/vae/`)
- **视频 VAE**: `models/vae/minimax_h3_video_vae_fp16.safetensors`
- **音频 VAE**: `models/vae/minimax_h3_audio_vae_fp32.safetensors`

#### 4. 潜空间上采样模型 (`models/latent_upscaler/` 或 `models/upscale_models/`)
- **SelfLift 潜空间 3D 上采样器**: `minimax_h3_latent_upscaler_3d_conv_v1_fp32.pth`

#### 5. 加速与微调 LoRA (`models/loras/`)
- **SelfLift 辅助 LoRA**: `models/loras/H3-Licon-VBVR-I2V.safetensors`
- **6 步 Pika 规格**: `models/loras/pika_h3_flex_fl2va_v1_bf16.safetensors`（约 1.96 GB）
- **4 步 PDMD 规格**: `models/loras/minimax_h3_pdmd_4step_lora_avg_rank_57_bf16.safetensors`
- **8 步 Turbo 规格**: `models/loras/minimax_h3_ref2v_lightx2v_turbo_4step_v0.1_resized_avg_rank_20_bf16.safetensors`

### 依赖扩展插件

1. **comfyui-SelfLift**：`https://github.com/facok/comfyui-SelfLift`（提供 `SelfLiftH3Sampler` 节点）
2. **ComfyLiterals**：`https://github.com/M1kep/ComfyLiterals`（提供字面量输入支持 `PrimitiveInt` 等）
3. **EasyCache**：ComfyUI 原生核心内置特征缓存机制（用于去噪特征缓存加速）

---

## 技术特点与规格

1. **精准首尾画面锚定**：
   - 输入起始帧（`first_frame`）与终止目标帧（`last_frame`），模型在潜空间中自动构建物理合理的动态演化轨迹与相机运镜。
2. **多档规格自由切换**：
   - 支持 INT8 6步 SelfLift（渐进超分版）、INT8 6步 Pika（质感）、INT8 4步 PDMD 极速版（无 FP8 硬件加速）、FP8 4步 PDMD 极速版、FP8 轻量 20 步、BF16 Turbo 8 步与 BF16 全精度 20 步，兼顾速度与精度。
3. **原生声画同步**：
   - 伴随首尾帧画面过渡同步生成环境音频音效。
4. **严格硬件锁死分辨率矩阵**：
   - 遵循规范，视频尺寸严格锁定在 0.4M~2.0M 的 12 档硬件对齐预设中（16:9 与 9:16 对称对调，默认中位数档位 0.98 MP `1344x768` / `768x1344`）。
5. **规范槽位对齐**：
   - 包含 `prompt`, `seed`, `width`, `height`, `duration`, `first_frame`, `last_frame` 等标准化识别槽位。
6. **步数由工作流内节点控制**：
   - 采样步数抽出为标题为 `step` 的 `PrimitiveInt` 节点（接到调度器 `steps` 输入），改步数无需重连图。
