# 高清放大工作流 (AI Upscale)

本工作流为图片节点「放大 (upscale)」工具选配的 ComfyUI 高清增强管线，用于在纯前端快速插值之外，提供基于扩散模型的潜空间高精重绘与 Tile 放大能力。

## 包含文件

- `upscale_api.json`（ComfyUI 导出的 API 格式工作流，供前端直连执行）
- `upscale_workflow.json`（ComfyUI 可视化工作流，供在 ComfyUI Web 界面中导入调试编辑）

---

## 推荐模型与方案

1. **分块分阶放大 (Tile Upscale)**：`Ultimate SD Upscale` + `ControlNet Tile` 保持原图构图并重绘丰富微观细节。
2. **潜空间放大 (Latent Upscale)**：`VAE Encode` -> `LatentUpscale` -> 低降噪比（0.2~0.4）`KSampler` -> `VAE Decode`。
3. **混合多级放大**：模型超分放大（如 4x-UltraSharp）后叠加轻微扩散平滑与去噪。

---

## 槽位契约规范（`_meta.title` 标注规范）

工作流必须严格遵循本项目的 ComfyUI 标准协议，将对应节点标题标注如下：

| 槽位类型 | 变量名 (`_meta.title`) | 对应 ComfyUI 节点类型 | 说明 | 必填/可选 |
| :--- | :--- | :--- | :--- | :---: |
| **参考图像输入** | `ref_image_01` | `LoadImage` | 画布传入的待放大原图 | **必填** |
| **生成图像输出** | `output_image` | `SaveImage` | 高清放大完成后的结果图 | **必填** |
| **补充提示词** | `prompt` | `CLIPTextEncode` / 文本节点 | 辅助补充细节纹理提示词 | 可选 |
| **随机种子** | `seed` | `KSampler` / `PrimitiveInt` | 采样随机种子 | 可选 |
