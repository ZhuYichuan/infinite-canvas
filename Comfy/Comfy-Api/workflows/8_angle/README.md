# 多角度生成工作流 (Multi-Angle Generation)

本工作流为图片节点「多角度 (angle)」工具对应的 ComfyUI 执行管线，用于根据相机环绕、俯仰、旋转视角参数，生成主体多视角衍生图。

## 包含文件

- `angle_api.json`（ComfyUI 导出的 API 格式工作流，供前端直连执行）
- `angle_workflow.json`（ComfyUI 可视化工作流，供在 ComfyUI Web 界面中导入调试编辑）

---

## 推荐模型与方案

1. **多视角扩散大模型**：`Qwen-Image-2.1` 多视角微调版 / 3D-Aware Diffusion
2. **多模态图生图 + 相机控制 LoRA**：基于 Flux 或 SDXL 的 View-Consistent / Camera Control LoRA
3. **ControlNet / Zero123 方案**：输入相机俯仰角 (Pitch) 与方位角 (Yaw) 控制新视角生成

---

## 槽位契约规范（`_meta.title` 标注规范）

工作流必须严格遵循本项目的 ComfyUI 标准协议，将对应节点标题标注如下：

| 槽位类型 | 变量名 (`_meta.title`) | 对应 ComfyUI 节点类型 | 说明 | 必填/可选 |
| :--- | :--- | :--- | :--- | :---: |
| **参考图像输入** | `ref_image_01` | `LoadImage` | 画布传入的基准主体原图 | **必填** |
| **生成图像输出** | `output_image` | `SaveImage` | 多角度生成的目标图 | **必填** |
| **视角控制提示词** | `prompt` | `CLIPTextEncode` / 文本节点 | 由前端角度面板自动组合的角度提示词 | **必填** |
| **随机种子** | `seed` | `KSampler` / `PrimitiveInt` | 采样随机种子 | 可选 |
