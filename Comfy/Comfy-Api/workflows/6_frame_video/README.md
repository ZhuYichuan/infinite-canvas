# MiniMax H3 首尾帧视频工作流

本工作流为系统内置的首尾帧定向插值视频（First-and-Last Frame Video）生成流水线，基于 **MiniMax H3 fl2va** 模型架构构建。

## 包含工作流规格与文件

| 规格类型 | API 工作流（画布直连） | 适用环境与特点 |
| :--- | :--- | :--- |
| **FP8 20步 (默认推荐)** | [minimax_h3_fl2va_fp8_20step_api.json](./minimax_h3_fl2va_fp8_20step_api.json) | 显存优化版，适合 RTX 3090/4090 或 16G~24G 消费级显卡 |
| **BF16 8步 Turbo (极速版)** | [minimax_h3_fl2va_bf16_8step_turbo_api.json](./minimax_h3_fl2va_bf16_8step_turbo_api.json) | 挂载 Turbo LoRA 加速，8 步极速出片，适合专业卡 / 高性能 GPU |
| **BF16 20步 (全量高精度)** | [minimax_h3_fl2va_bf16_20step_api.json](./minimax_h3_fl2va_bf16_20step_api.json) | 完整精度 20 步标准采样 |
| **UI 可视化工作流** | [minimax_h3_fl2va_workflow.json](./minimax_h3_fl2va_workflow.json) | ComfyUI 拖拽查看与调试用的完整节点图 |

---

## 模型信息

- **模型名称**: `MiniMax H3 fl2va`
- **模型类型**: 首尾帧插值视频与音频联合生成扩散模型
- **适用场景**: 分镜首尾过渡连接、精准时空闭环叙事、动态变身与场景转场

### 必要权重文件（存放在 ComfyUI `models/` 目录）

#### 1. 核心扩散模型 (`models/diffusion_models/`)
- **FP8 规格**: `models/diffusion_models/minimax_h3_fl2va_pruned_fp8_scaled.safetensors`
- **BF16 规格**: `models/diffusion_models/minimax_h3_fl2va_bf16.safetensors`

#### 2. 文本与多模态编码器 (`models/text_encoders/`)
- **FP8 / 显存优化**: `models/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`
- **BF16 / 专业级**: `models/text_encoders/qwen3vl_32b_minimax_h3_bf16.safetensors`

#### 3. 编解码器 (`models/vae/`)
- **视频 VAE**: `models/vae/minimax_h3_video_vae_fp16.safetensors`
- **音频 VAE**: `models/vae/minimax_h3_audio_vae_fp32.safetensors`

#### 4. 加速 LoRA (`models/loras/`，仅 8 步 Turbo 规格必须)
- `models/loras/minimax_h3_ref2v_lightx2v_turbo_4step_v0.1_resized_avg_rank_20_bf16.safetensors`

### 依赖扩展插件

- **ComfyLiterals**：`https://github.com/M1kep/ComfyLiterals`（提供字面量输入支持 `PrimitiveInt` 等）

---

## 技术特点与规格

1. **精准首尾画面锚定**：
   - 输入起始帧（`first_frame`）与终止目标帧（`last_frame`），模型在潜空间中自动构建物理合理的动态演化轨迹与相机运镜。
2. **FP8 20步、BF16 8步 Turbo 与 BF16 20步三档配置**：
   - 支持 FP8 轻量 20 步、BF16 Turbo 8 步与 BF16 全精度 20 步，在保证动作流畅无撕裂的前提下自由选择速度或精度。
3. **原生声画同步**：
   - 伴随首尾帧画面过渡同步生成环境音频音效。
4. **规范槽位对齐**：
   - 包含 `prompt`, `seed`, `width`, `height`, `duration`, `first_frame`, `last_frame` 等标准化识别槽位。
