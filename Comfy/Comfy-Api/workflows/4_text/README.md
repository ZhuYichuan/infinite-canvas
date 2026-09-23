# Qwen3.5 4B 文本生成与反推工作流

本工作流为系统内置的本地端侧大语言模型（LLM）与多模态反推流水线，基于阿里巴巴通义千问 **Qwen3.5 4B** 构建。

## 包含文件

- [API 格式工作流（画布直连执行）](./qwen3_5_text_api.json)
- [UI 可视化工作流（ComfyUI 导入查看编辑）](./qwen3_5_text_workflow.json)

---

## 模型信息

- **模型名称**: `Qwen3.5 4B`
- **模型类型**: 端侧大语言模型 / 视觉多模态语言模型 (LLM / VLM)
- **适用场景**: 提示词扩写、灵感激发、多轮文本润色、以及上传图片反推生图/生视频 Prompt

### 必要权重文件（存放在 ComfyUI `models/` 目录）

| 模型类别 | 推荐权重文件路径 | 说明 |
| :--- | :--- | :--- |
| **Diffusion / LLM Model** | `models/diffusion_models/qwen3.5_4b_bf16.safetensors` | Qwen3.5 4B 端侧大语言模型权重 (BF16) |

### 依赖扩展插件

1. **Comfyui-kktools**：`https://github.com/zhiwendesign/Comfyui-kktools`（提供文本与反推核心节点 `kkSomethingToAny`）
2. **ComfyUI-UniversalToolkit**：`https://github.com/whmc76/ComfyUI-UniversalToolkit`（提供类型转接输出桥接节点 `ShowAny_UTK`）

---

## 技术特点与规格

1. **轻量端侧 4B 架构**：
   - 4B 级别模型在保证强大逻辑与中文语境理解的前提下，大幅削减显存占用。
   - 仅需 4GB~6GB 显存，单卡与生图模型并存时无显存爆仓压力。
2. **纯本地离线保密**：
   - 前端直连 ComfyUI 本地执行，无需调用任何第三方闭源商业 API，提示词与反推数据完全保密。
3. **文本扩写与图生文双用**：
   - 输入简短核心词（如“海边少女”），可自动扩写为包含光影、细节、构图的专业扩散模型 Prompt。
   - 结合多模态输入槽位时，可自动对参考图像进行深度画面解构并输出反推提示词。
