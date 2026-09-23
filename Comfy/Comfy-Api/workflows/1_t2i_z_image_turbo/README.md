# Z-Image-Turbo 文生图工作流

本工作流为系统内置的标准文生图（Text-to-Image）生成流水线，基于高性能 **Z-Image-Turbo** 扩散模型构建。

## 包含文件

- [API 格式工作流（画布直连执行）](./z_image_turbo_api.json)
- [UI 可视化工作流（ComfyUI 导入查看编辑）](./z_image_turbo_workflow.json)

---

## 模型信息

- **模型名称**: `Z-Image-Turbo`
- **模型类型**: 扩散模型（Diffusion Transformer / UNet 架构）
- **适用场景**: 纯文本描述驱动的高画质图像快速生成

### 必要权重文件（存放在 ComfyUI `models/` 目录）

| 模型类别 | 推荐权重文件路径 | 说明 |
| :--- | :--- | :--- |
| **Diffusion Model** | `models/diffusion_models/z_image_turbo_bf16.safetensors` | 核心图像扩散生成主干权重 (BF16) |
| **Text Encoder** | `models/text_encoders/qwen_3_4b.safetensors` | Qwen 3 4B 文本语义编码器 |
| **VAE** | `models/vae/ae.safetensors` | 潜空间编解码器 |
| **LoRA** | *(无)* | 内置直接支持极速推理 |

---

## 技术特点与规格

1. **极速推理（4~8 步出图）**：
   - 经专门的蒸馏与加速训练，步数大幅压缩，标准出图仅需 4 至 8 步。
   - 相比传统 30~50 步扩散模型，单张生成耗时降低 70% 以上。
2. **精准语义遵循**：
   - 搭配 Qwen 3 4B 文本编码器，对复杂中文与英文 prompt 具备强大的构图与元素理解能力。
3. **显存轻量（消费级友好）**：
   - 显存需求：最低 8GB，推荐 12GB+。
   - 在 RTX 3060/4060 等消费级显卡上可实现秒级出图。
4. **规范槽位对齐**：
   - 动态识别并支持 `prompt`（正向提示词）、`width`（宽）、`height`（高）、`seed`（随机种子）等标准标注槽位。
