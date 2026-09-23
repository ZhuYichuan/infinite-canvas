# 系统内置 ComfyUI 渠道与工作流资产全景

本项目全面采用**原生 ComfyUI 原生 API 直连架构**（纯前端浏览器直连，默认地址 `http://127.0.0.1:8188`，可自由配置为本地机器或云端 GPU 实例 IP）。

系统将所有出厂核心生成能力收敛统一为**「系统内置 ComfyUI 渠道」**，涵盖 6 大生成能力，并在视频等长耗时能力下提供消费级（FP8 20步）与极速性能级（BF16 8步 Turbo）双档工作流供自由切换。

---

## 6 大核心能力模型对照矩阵

| 序号 | 业务分类 | 工作流名称 | 模型名称 | 核心模型权重路径（ComfyUI `models/` 目录） | 采样步数 | 推荐显存 | 核心技术特点 |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **1** | **文生图 (T2I)** | [文生图工作流](./workflows/1_t2i/) | `Z-Image-Turbo` | `diffusion_models/z_image_turbo_bf16.safetensors`<br/>`text_encoders/qwen_3_4b.safetensors`<br/>`vae/ae.safetensors` | 4~8 步 | 8G ~ 12G | 蒸馏极速推理、Qwen3-4B 高效文本理解、消费级显卡秒级出图 |
| **2** | **图生图 (I2I)** | [图生图工作流](./workflows/2_i2i/) | `Flux2.Dev` | `diffusion_models/flux2_dev_fp8mixed.safetensors`<br/>`loras/Flux2TurboComfyv2.safetensors`<br/>`text_encoders/mistral_3_small_flux2_fp8.safetensors`<br/>`vae/flux2-vae.safetensors` | 8~16 步 | 12G ~ 24G | Flow Matching 架构、顶级质感与复杂构图、支持多参考图特征与风格强一致性迁移 |
| **3** | **局部编辑 (Inpaint)** | [局部编辑工作流](./workflows/3_inpaint/) | `Qwen-Image Inpaint` | `diffusion_models/qwen_image_fp8_e4m3fn.safetensors`<br/>`loras/Qwen-Image-Lightning-4steps-V1.0.safetensors`<br/>`text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors`<br/>`vae/qwen_image_vae.safetensors` | 4 步 | 8G ~ 12G | Qwen2.5-VL 视觉理解、4 步 Lightning 极速重绘、LayerStyle 平滑边缘无缝融入 |
| **4** | **文本生成 / 反推 (Text)** | [文本生成工作流](./workflows/4_text/) | `Qwen3.5 4B` | `diffusion_models/qwen3.5_4b_bf16.safetensors` | 自回归 | 4G ~ 6G | 轻量端侧 4B 语言模型、支持提示词自动扩写与图像反推提示词、数据纯本地离线保密 |
| **5** | **全能参考视频 (Omni Video)** | [全能参考视频工作流](./workflows/5_omni_video/) | `MiniMax H3 ref2va` | **FP8版**: `diffusion_models/minimax_h3_ref2va_pruned_fp8_scaled.safetensors`<br/>**BF16版**: `diffusion_models/minimax_h3_ref2va_bf16.safetensors`<br/>**LoRA**: `loras/minimax_h3_ref2v_lightx2v_turbo_4step_v0.1...safetensors`<br/>**Text**: `text_encoders/qwen3vl_32b_minimax_h3...safetensors`<br/>**VAE**: `minimax_h3_video_vae_fp16`, `minimax_h3_audio_vae_fp32` | 20步 (FP8)<br/>8步 (Turbo) | 16G ~ 24G+ | 首创多模态参考（最多 9 图 + 3 视频 + 3 音频）、原生音画潜空间联合生成、0.98 MP 电影画质 |
| **6** | **首尾帧视频 (Frame Video)** | [首尾帧视频工作流](./workflows/6_frame_video/) | `MiniMax H3 fl2va` | **FP8版**: `diffusion_models/minimax_h3_fl2va_pruned_fp8_scaled.safetensors`<br/>**BF16版**: `diffusion_models/minimax_h3_fl2va_bf16.safetensors`<br/>**LoRA**: `loras/minimax_h3_ref2v_lightx2v_turbo_4step_v0.1...safetensors`<br/>辅助模型同全能视频 | 20步 (FP8)<br/>8步 (Turbo) | 16G ~ 24G+ | 精准锚定起始帧与结束帧、运镜与动作平滑插值过渡、音画同步生成 |

---

## 目录结构

所有内置工作流与说明统一收敛在 `workflows/` 目录下：

```text
Comfy/Comfy-Api/
├── README.md                               # 本全景说明文档
└── workflows/
    ├── 1_t2i/                              # 1. 文生图工作流 (Text to Image)
    │   ├── README.md
    │   ├── z_image_turbo_api.json          # 画布直连 API 格式
    │   └── z_image_turbo_workflow.json     # ComfyUI 可视化工作流
    ├── 2_i2i/                              # 2. 图生图工作流 (Image to Image)
    │   ├── README.md
    │   ├── flux2_dev_i2i_api.json
    │   └── flux2_dev_i2i_workflow.json
    ├── 3_inpaint/                          # 3. 局部编辑工作流 (Inpaint)
    │   ├── README.md
    │   ├── qwen_image_inpaint_api.json
    │   └── qwen_image_inpaint_workflow.json
    ├── 4_text/                             # 4. 文本生成/反推工作流 (Text / LLM)
    │   ├── README.md
    │   ├── qwen3_5_text_api.json
    │   └── qwen3_5_text_workflow.json
    ├── 5_omni_video/                       # 5. 全能参考视频工作流 (Omni-modal Video)
    │   ├── README.md
    │   ├── minimax_h3_ref2va_fp8_20step_api.json      # 消费级 20 步
    │   ├── minimax_h3_ref2va_bf16_8step_turbo_api.json# 极速 Turbo 8 步
    │   ├── minimax_h3_ref2va_bf16_20step_api.json     # 全量 20 步
    │   └── minimax_h3_ref2va_workflow.json            # UI 工作流
    └── 6_frame_video/                      # 6. 首尾帧视频工作流 (First-Last Frame Video)
        ├── README.md
        ├── minimax_h3_fl2va_fp8_20step_api.json       # 消费级 20 步
        ├── minimax_h3_fl2va_bf16_8step_turbo_api.json # 极速 Turbo 8 步
        ├── minimax_h3_fl2va_bf16_20step_api.json      # 全量 20 步
        └── minimax_h3_fl2va_workflow.json             # UI 工作流
```

---

## 运行必备 5 大 ComfyUI 核心插件

运行本项目全部内置工作流，必须在 ComfyUI 的 `custom_nodes/` 目录下安装以下 5 个扩展插件：

| 序号 | 插件名称 | GitHub 仓库 | 依赖工作流 | 作用说明 |
| :---: | :--- | :--- | :--- | :--- |
| 1 | **Comfyui-kktools** | `https://github.com/zhiwendesign/Comfyui-kktools` | 文本生成 / 反推 | 大语言模型文本生成与提示词扩写反推 (`kkSomethingToAny`) |
| 2 | **ComfyUI-KJNodes** | `https://github.com/kijai/ComfyUI-KJNodes` | 全能参考视频 | 高级控制流与音视频多模态组件解包 (`GetVideoComponents`) |
| 3 | **ComfyLiterals** | `https://github.com/M1kep/ComfyLiterals` | 首尾帧 / 全能视频 | 基础字面量与尺寸/时长参数动态暴露 (`PrimitiveInt`, `PrimitiveFloat`) |
| 4 | **ComfyUI-UniversalToolkit** | `https://github.com/whmc76/ComfyUI-UniversalToolkit` | 文本生成 / 反推 | 通用多类型转接桥接工具箱 (`ShowAny_UTK`) |
| 5 | **ComfyUI_LayerStyle** | `https://github.com/chflame163/ComfyUI_LayerStyle` | 局部编辑 (Inpaint) | 图层样式合成与局部遮罩预处理 (`LayerMask: MaskPreview`) |

### 一键克隆命令（在 ComfyUI `custom_nodes/` 目录执行）

```bash
cd custom_nodes
git clone https://github.com/zhiwendesign/Comfyui-kktools.git
git clone https://github.com/kijai/ComfyUI-KJNodes.git
git clone https://github.com/M1kep/ComfyLiterals.git
git clone https://github.com/whmc76/ComfyUI-UniversalToolkit.git
git clone https://github.com/chflame163/ComfyUI_LayerStyle.git
```

> 详细说明与排错请参考完整指南：[docs/COMFYUI_PLUGINS.md](../../docs/COMFYUI_PLUGINS.md)