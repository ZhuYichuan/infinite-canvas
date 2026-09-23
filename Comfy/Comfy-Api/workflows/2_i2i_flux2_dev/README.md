# Flux2.Dev 图生图工作流

本工作流为系统内置的高精度图生图与多图参考编辑（Image-to-Image / Multi-Reference Edit）流水线，基于下一代 **Flux2.Dev** 模型架构构建。

## 包含文件

- [API 格式工作流（画布直连执行）](./flux2_dev_i2i_api.json)
- [UI 可视化工作流（ComfyUI 导入查看编辑）](./flux2_dev_i2i_workflow.json)

---

## 模型信息

- **模型名称**: `Flux2.Dev`
- **模型类型**: Flow Matching Transformer (MMDiT 衍生结构)
- **适用场景**: 提示词控制图生图、多张参考图特征融合、风格迁移与一致性角色重塑

### 必要权重文件（存放在 ComfyUI `models/` 目录）

| 模型类别 | 推荐权重文件路径 | 说明 |
| :--- | :--- | :--- |
| **Diffusion Model** | `models/diffusion_models/flux2_dev_fp8mixed.safetensors` | Flux2.Dev 主干模型（FP8 混合精度，显存优化版） |
| **LoRA** | `models/loras/Flux2TurboComfyv2.safetensors` | Flux2 专属步数压缩与推理加速 LoRA |
| **Text Encoder** | `models/text_encoders/mistral_3_small_flux2_fp8.safetensors` | Mistral 3 Small 多语言指令文本编码器 (FP8) |
| **VAE** | `models/vae/flux2-vae.safetensors` | 高保真 Flux2 VAE 编解码器 |

---

## 技术特点与规格

1. **顶级画面质感与细节刻画**：
   - 采用 Flow Matching 架构，画面光影、质感、人体解剖结构与复杂纹理表现力处于业界第一梯队。
2. **多参考图强一致性融合**：
   - 支持画布传递的多张参考图片输入（`ref_image_01`, `ref_image_02` 等），在保持原图核心元素、主体特征的同时根据 prompt 精准变体。
3. **FP8 混合精度 + Turbo 加速**：
   - 挂载 `Flux2TurboComfyv2` 加速 LoRA，将原生繁重的 30~50 步推理缩减至 8~16 步。
   - 显存需求：最低 12GB，推荐 16GB / 24GB（RTX 4070Ti / 3090 / 4090）。
4. **规范槽位对齐**：
   - 严格遵循 `prompt`, `width`, `height`, `seed`, `ref_image_01..09` 等标准槽位协议，自动识别与自适应适配。
