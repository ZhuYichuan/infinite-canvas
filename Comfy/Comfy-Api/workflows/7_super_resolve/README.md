# AI 超分工作流 (Super Resolution)

本工作流为图片节点「AI 超分 (superResolve)」工具对应的 ComfyUI 执行管线，用于低分辨率画质增强、纹理细节深度修复与超分辨率重建。

## 包含文件

- `super_resolve_api.json`（ComfyUI 导出的 API 格式工作流，供前端直连执行）
- `super_resolve_workflow.json`（ComfyUI 可视化工作流，供在 ComfyUI Web 界面中导入调试编辑）

---

## 推荐模型与算法方案

根据你的硬件显存与场景要求，可选择以下任一方案构建工作流：

1. **轻量通用级（快速出图 / 推荐显存 4G~8G）**：
   * **算法/模型**：`RealESRGAN_x4plus.pth` / `4x-UltraSharp.pth` / `DAT-2`
   * **核心节点**：`UpscaleModelLoader` + `ImageUpscaleWithModel`
2. **深度生成级（质感重绘 / 推荐显存 12G~24G）**：
   * **算法/模型**：`SUPIR` / `CCSR` / `SDXL Tile + ControlNet`
   * **核心节点**：支持以图生图潜空间重绘扩散方式重构高精细节

---

## 槽位契约规范（`_meta.title` 标注规范）

工作流必须严格遵循本项目的 ComfyUI 标准协议，将对应节点标题标注如下：

| 槽位类型 | 变量名 (`_meta.title`) | 对应 ComfyUI 节点类型 | 说明 | 必填/可选 |
| :--- | :--- | :--- | :--- | :---: |
| **参考图像输入** | `ref_image_01` | `LoadImage` | 画布传入的待超分原图 | **必填** |
| **生成图像输出** | `output_image` | `SaveImage` | 超分重建完成后的高清结果图 | **必填** |
| **微调提示词** | `prompt` | `CLIPTextEncode` / 文本节点 | （仅限生成级超分）引导画面细节倾向 | 可选 |
| **随机种子** | `seed` | `KSampler` / `PrimitiveInt` | 采样随机种子 | 可选 |
