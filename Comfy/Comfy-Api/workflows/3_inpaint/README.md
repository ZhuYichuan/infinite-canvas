# Qwen-Image 局部编辑与重绘工作流

本工作流为系统内置的高性能局部编辑（Inpaint / Mask Edit）流水线，基于千问 **Qwen-Image** 重绘模型与多模态视觉语言模型构建。

## 包含文件

- [API 格式工作流（画布直连执行）](./qwen_image_inpaint_api.json)
- [UI 可视化工作流（ComfyUI 导入查看编辑）](./qwen_image_inpaint_workflow.json)

---

## 模型信息

- **模型名称**: `Qwen-Image Inpaint`
- **模型类型**: 局部重绘扩散模型 + 视觉多模态大模型 (VL)
- **适用场景**: 画布框选区域重绘、图像局部元素擦除/替换、扩图外绘与遮罩修复

### 必要权重文件（存放在 ComfyUI `models/` 目录）

| 模型类别 | 推荐权重文件路径 | 说明 |
| :--- | :--- | :--- |
| **Diffusion Model** | `models/diffusion_models/qwen_image_fp8_e4m3fn.safetensors` | Qwen-Image 重绘主干模型 (FP8 E4M3FN) |
| **LoRA** | `models/loras/Qwen-Image-Lightning-4steps-V1.0.safetensors` | 4 步极速推理蒸馏 LoRA |
| **Text Encoder** | `models/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors` | Qwen 2.5-VL 7B 视觉语言特征提取与编码器 (FP8) |
| **VAE** | `models/vae/qwen_image_vae.safetensors` | 专用高精度图像潜空间编解码器 |

### 依赖扩展插件

- **ComfyUI_LayerStyle**：`https://github.com/chflame163/ComfyUI_LayerStyle`（提供图层样式与遮罩融合节点 `LayerMask: MaskPreview`）。

---

## 技术特点与规格

1. **4 步 Lightning 极速重绘**：
   - 采用 `Qwen-Image-Lightning-4steps` 蒸馏技术，仅需 4 步采样即可完成重绘，重绘体验近乎即时响应。
2. **多模态视觉语言深度理解**：
   - 借助 Qwen 2.5-VL 强大的图像理解能力，能够根据周围图像环境、光照与透视，生成高度协调的局部替换内容。
3. **无缝边缘贴合与羽化过渡**：
   - 配合 LayerStyle 遮罩预处理，避免了传统 Inpaint 常见的边界锯齿、色差断层与拼接接缝。
4. **规范槽位对齐**：
   - 暴露 `prompt`, `seed`, `ref_image_01`（原图底图）, `ref_mask`（重绘遮罩）等核心输入槽位。
