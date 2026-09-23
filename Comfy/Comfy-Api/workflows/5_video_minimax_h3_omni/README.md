# MiniMax H3 全能参考视频工作流

本工作流为系统内置的多模态全能参考视频（Omni-Reference Video）生成流水线，基于先进的 **MiniMax H3 ref2va** 视频与音频联合生成模型架构构建。

## 包含工作流规格与文件

| 规格类型 | API 工作流（画布直连） | 适用环境与特点 |
| :--- | :--- | :--- |
| **FP8 20步 (默认推荐)** | [minimax_h3_ref2va_fp8_20step_api.json](./minimax_h3_ref2va_fp8_20step_api.json) | 显存优化版，适合 RTX 3090/4090 或 16G~24G 单卡消费级与常规云端 |
| **BF16 8步 Turbo (极速版)** | [minimax_h3_ref2va_bf16_8step_turbo_api.json](./minimax_h3_ref2va_bf16_8step_turbo_api.json) | 挂载 Turbo LoRA 加速，8 步极速出片，适合 24G+ / A100 / H100 专业显卡 |
| **BF16 20步 (全量高精度)** | [minimax_h3_ref2va_bf16_20step_api.json](./minimax_h3_ref2va_bf16_20step_api.json) | 完整精度的 20 步标准采样，画质上限最高 |
| **UI 可视化工作流** | [minimax_h3_ref2va_workflow.json](./minimax_h3_ref2va_workflow.json) | ComfyUI 拖拽查看与调试用的完整节点图 |

---

## 模型信息

- **模型名称**: `MiniMax H3 ref2va`
- **模型类型**: 多模态视频与音频联合生成扩散模型 (DiT + Audio Diffusion)
- **适用场景**: 多参考图角色一致性、参考视频运镜与动作迁移、音画同步电影级视频生成

### 必要权重文件（存放在 ComfyUI `models/` 目录）

#### 1. 核心扩散模型 (`models/diffusion_models/`)
- **FP8 规格**: `models/diffusion_models/minimax_h3_ref2va_pruned_fp8_scaled.safetensors`
- **BF16 规格**: `models/diffusion_models/minimax_h3_ref2va_bf16.safetensors`

#### 2. 文本与多模态编码器 (`models/text_encoders/`)
- **FP8 / 显存优化**: `models/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`
- **BF16 / 专业级**: `models/text_encoders/qwen3vl_32b_minimax_h3_bf16.safetensors`

#### 3. 编解码器 (`models/vae/`)
- **视频 VAE**: `models/vae/minimax_h3_video_vae_fp16.safetensors`
- **音频 VAE**: `models/vae/minimax_h3_audio_vae_fp32.safetensors`

#### 4. 加速 LoRA (`models/loras/`，仅 8 步 Turbo 规格必须)
- `models/loras/minimax_h3_ref2v_lightx2v_turbo_4step_v0.1_resized_avg_rank_20_bf16.safetensors`

### 依赖扩展插件

1. **ComfyUI-KJNodes**：`https://github.com/kijai/ComfyUI-KJNodes`（用于音视频组件多模态解包 `GetVideoComponents`）
2. **ComfyLiterals**：`https://github.com/M1kep/ComfyLiterals`（提供尺寸与步数字面量参数 `PrimitiveInt`, `PrimitiveFloat`）

---

## 技术特点与规格

1. **多模态强特征参考路由（最多 9 图 + 3 视频 + 3 音频）**：
   - 支持从画布任意连线组合：最多 9 张图片参考、3 个参考视频、3 个音频参考，系统提交前会自动动态按 FIFO 映射插槽并抹除未连满的插槽。
2. **原生声画同步联合生成**：
   - 区别于传统“先生成无声视频再后配音”，MiniMax H3 扩散过程同时生成音画潜空间，音效与画面动作具有精准的原生节奏同步。
3. **严格硬件锁死分辨率矩阵**：
   - 遵循规范，视频尺寸严禁手动输入数字，严格锁定在 0.2M~0.98M 的 9 档硬件对齐预设中（16:9 与 9:16 对称对调，上限 0.98 MP）。
4. **两档规格自由切换**：
   - 前端画布节点可在「FP8 20步」与「BF16 8步 Turbo」工作流之间一键无缝切换，兼顾个人电脑单卡运行与专业服务器算力最大化。
