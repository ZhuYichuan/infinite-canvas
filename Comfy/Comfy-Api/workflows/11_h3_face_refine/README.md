# MiniMax H3 视频人脸追踪精修工作流 (H3 Face Refine Auto Select)

本工作流为系统内置的高性能视频人脸追踪与局部高清精修流水线，基于 **MiniMax H3 ref2va** 视频扩散大模型与专用人脸时序追踪裁剪-动态去噪-无缝缝合架构构建，支持纯前端浏览器直连自建 ComfyUI 原生 API 运行。

专为解决 AI 生成视频中常见的**远景小脸崩坏、五官模糊扭曲、人物动态眨眼失真、运镜晃动中面部抽搐闪烁**等痛点设计。

---

## 包含文件

- [API 格式工作流（画布直连执行）](./H3_Face_Refine_Auto_Select_Api.json)
- [UI 可视化工作流（ComfyUI 导入查看编辑）](./H3_Face_Refine_Auto_Select_workflow.json)

---

## 模型信息

- **模型名称**: `MiniMax H3 ref2va` + `MiniMax H3 FL2V Turbo LoRA`
- **模型架构**: 视频与音频多模态联合扩散模型 (DiT + Audio Diffusion) + YOLO 目标分割追踪器 + 动态按帧去噪控制器
- **适用场景**:
  - 视频远景/中景角色小脸高清修复与五官细节重构
  - 动作、运镜与长镜头下的人物面部防抖与高斯轨迹平滑
  - 角色身份（Identity）特征锁定与多参考图一致性增强
  - 说话/对白人物的原生口型保持与音画同步保真

### 必要权重文件（存放在 ComfyUI `models/` 目录）

| 模型类别 | 推荐权重文件路径 | 说明与作用 |
| :--- | :--- | :--- |
| **Diffusion Model** | `models/diffusion_models/minimax_h3_ref2va_pruned_fp8_scaled.safetensors`<br/>*(全量精度可选: `minimax_h3_ref2va_bf16.safetensors`)* | MiniMax H3 参考视频生成主干扩散模型 |
| **Turbo LoRA** | `models/loras/minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` | 8 步极速采样蒸馏 LoRA，大幅提升局部采样推理速度 |
| **Text & Vision Encoder** | `models/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`<br/>*(全量可选: `qwen3vl_32b_minimax_h3_bf16.safetensors`)* | Qwen3-VL 32B 视觉多模态与文本编码器 |
| **Video VAE** | `models/vae/minimax_h3_video_vae_fp16.safetensors` | MiniMax H3 专用视频潜空间编解码器 |
| **Audio VAE** | `models/vae/minimax_h3_audio_vae_fp32.safetensors` | MiniMax H3 专用音频潜空间编解码器 |
| **Detection & Seg Model** | `models/ultralytics/segm/person_yolov8m-seg.pt`<br/>*(或 `models/segm/person_yolov8m-seg.pt`)* | 人体主体检测与实例分割模型（主检测器） |
| **Fallback Face Detector** | `models/ultralytics/bbox/face_yolov8m.pt`<br/>*(或 `models/bbox/face_yolov8m.pt`)* | 人脸/头部边界框检测模型（备用回退检测器） |

> **目录结构参考**：
> ```text
> 📂 ComfyUI/
> └── 📂 models/
>     ├── 📂 diffusion_models/
>     │   └── minimax_h3_ref2va_pruned_fp8_scaled.safetensors
>     ├── 📂 loras/
>     │   └── minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors
>     ├── 📂 text_encoders/
>     │   └── qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors
>     ├── 📂 vae/
>     │   ├── minimax_h3_video_vae_fp16.safetensors
>     │   └── minimax_h3_audio_vae_fp32.safetensors
>     └── 📂 ultralytics/ (或 yolo / segm / bbox)
>         ├── 📂 segm/
>         │   └── person_yolov8m-seg.pt
>         └── 📂 bbox/
>             └── face_yolov8m.pt
> **跨平台兼容性提示**：
> 工作流标准统一使用正斜杠格式（`segm/person_yolov8m-seg.pt` 与 `bbox/face_yolov8m.pt`）。画布系统在向 ComfyUI 提交任务时，会自动探查目标主机系统类型（Windows 或 Linux），并在 Windows (`\`) 与 Linux (`/`) 之间全自动无感转换，同时内置异常翻转重试兜底机制，无论本地 Windows 还是云端 Linux 环境均可开箱即用。

---

## 依赖扩展插件

运行本工作流需要在 ComfyUI 的 `custom_nodes/` 目录下安装以下核心扩展：

1. **ComfyUI-H3-FaceRefine**（提供人脸追踪、小脸智能裁剪与闭环精修套件）：
   - 仓库地址: `https://github.com/Carasibana/ComfyUI-H3-FaceRefine`
2. **ComfyUI-MiniMaxH3-Myang**（提供人脸追踪裁剪、潜空间注入、音频口型锁、逐帧动态去噪与人脸无缝缝合节点）：
   - 仓库地址: `https://github.com/civilcoco/ComfyUI-MiniMaxH3-Myang`
   - 核心节点: `H3FaceTrackCrop`、`H3InjectVideoLatent`、`MiniMaxH3NativeAudioLock`、`H3PerFrameDenoise`、`H3FaceStitch`
3. **ComfyUI-KJNodes**（提供音视频组件多模态解包）：
   - 仓库地址: `https://github.com/kijai/ComfyUI-KJNodes`
   - 核心节点: `GetVideoComponents`
4. **ComfyUI-VideoHelperSuite (VHS)**（提供视频加载与音画封装输出）：
   - 仓库地址: `https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite`
   - 核心节点: `LoadVideo`、`VHS_VideoCombine`
5. **ComfyLiterals**（提供基础字面量与多行文本输入）：
   - 仓库地址: `https://github.com/M1kep/ComfyLiterals`
   - 核心节点: `PrimitiveStringMultiline`

---

## 槽位契约与参数映射

工作流已严格遵循系统的 `_meta.title` 槽位命名规范，在向 ComfyUI 原生 API 发起调度时自动完成以下插槽映射：

| 槽位名 (`_meta.title`) | 节点类别 (`class_type`) | 内部输入名 | 作用与数据流说明 |
| :--- | :--- | :--- | :--- |
| **`ref_video_01`** | `LoadVideo` | `file` | 待精修的目标基础原视频（MP4/MOV） |
| **`prompt`** | `PrimitiveStringMultiline` | `value` | 人物主体外貌定义、场景与光影质感引导提示词 |
| **`ref_image_01` ~ `ref_image_08`** | `LoadImage` | `image` | 角色身份与五官细节参考图（支持最多 8~9 张多模态参考图，确保精修前后身份一致） |
| **`Noise (fix while testing)`** | `RandomNoise` | `noise_seed` | 采样随机噪声种子，控制微观纹理与表情生成变化 |
| **`10. Save (ORIGINAL audio)`** | `VHS_VideoCombine` | `images`, `audio` | 产物输出端口，无缝贴合精修面部并合并原始音轨导出最终高画质 MP4 |

---

## 核心技术机制与工作原理

整个精修流程采用**闭环流水线**架构，完整串联以下 8 个核心处理阶段：

```text
[待精修视频 ref_video_01]
       ↓ (GetVideoComponents: 拆分视频帧 + 原始音频)
[H3FaceTrackCrop: YOLO 智能追踪裁剪] ─────────────┐ (保留 transform 几何变换矩阵)
       ↓ (自适应分辨率裁剪序列)                    │
[H3InjectVideoLatent: 编码并注入潜空间]             │
       ↓                                          │
[MiniMaxH3NativeAudioLock: 锁定音频潜空间保口型]    │
       ↓                                          │
[H3PerFrameDenoise: 依据面部像素尺寸动态按帧去噪]   │
       ↓                                          │
[Turbo 8步采样: er_sde + simple]                  │
       ↓                                          │
[VAEDecode: 解码局部高精人脸帧]                     │
       ↓                                          │
[H3FaceStitch: 逆投影羽化色彩融合] <───────────────┘
       ↓ (重组原始底片)
[VHS_VideoCombine: 封包原声导出 MP4]
```

1. **智能面部追踪与自适应裁剪 (`H3FaceTrackCrop`)**：
   - 使用 YOLOv8m 分割模型自动检测画面中的最大人脸（`select: "largest_face"`）；
   - 启用 CLIP Vision 身份追踪（`identity_track: true`，阈值 0.28），在镜头移动中稳定锁定同一人物；
   - 结合 11 帧高斯轨迹平滑（`smooth_window: 11`）与 69 帧尺寸平滑，杜绝裁剪框抽搐抖动；
   - 输出局部人脸序列与逆映射空间几何变换矩阵（`transform`）。
2. **潜空间注入 (`H3InjectVideoLatent`)**：
   - 将裁剪的人脸图像经由视频 VAE 编码并注入到 MiniMax H3 潜空间，作为局部重绘的 Img2Img 初始态。
3. **原生口型音频锁 (`MiniMaxH3NativeAudioLock`)**：
   - 将原视频音频轨与 Audio VAE 连接到底层 DiT 模型，在潜空间强行锚定音频节奏，**确保面部精修时唇形动态（Lipsync）严格吻合说话原声**，避免重绘导致对口型失效。
4. **基于面部像素绝对尺寸的逐帧动态去噪 (`H3PerFrameDenoise`)**：
   - 解决传统全局固定 Denoise 无法适配长镜头机位变化的难题：
     - **远景小脸 (≤30px)**：去噪乘数提升至 `1.0`，依靠扩散模型强力重建缺失的五官结构；
     - **近景大脸 (≥120px)**：去噪乘数自动衰减至 `0.35`，仅优化皮肤微观质感，严防过度重绘导致面相失真；
   - 配合 13 帧平滑窗口，消除帧间降噪强度跃变带来的闪烁。
5. **Turbo 8 步极速采样**：
   - 挂载 `minimax_h3_fl2v_turbo_8step` LoRA，结合 `er_sde` 采样器与基准去噪值 `0.4`，仅需 8 步即可完成高质量局部收敛。
6. **无缝边缘羽化缝合 (`H3FaceStitch`)**：
   - 依据初始记录的 `transform` 矩阵将精修帧反投影回原始画幅；
   - 配合 24px 遮罩扩张与羽化、100% 色彩自适应匹配（`colour_match: 1`），使精修边缘与原片背景光影完全融为一体，消除拼接接缝与色差断层。
7. **原声同步封装 (`VHS_VideoCombine`)**：
   - 自动回填原片音频轨，以 24fps、H.264 CRF 16 高规格输出高画质成品视频。

---

## 使用建议与调参指南

1. **去噪基准值调节 (`denoise`)**：
   - 在 `BasicScheduler` 节点中，默认基准去噪值为 `0.4`。
   - 若原视频面部崩坏严重、五官完全模糊，可适度上调至 `0.45 ~ 0.55`；
   - 若原片面部已有较好轮廓、仅需消除噪点或轻度微调，可下调至 `0.3 ~ 0.35`。
2. **参考图搭配技巧**：
   - 建议在 `ref_image_01` ~ `ref_image_03` 填入目标人物的清晰正脸特写与不同角度照片，有助于 MiniMax H3 多模态视觉条件精准还原真实容貌。
3. **多人场景处理**：
   - 工作流默认配置为 `largest_face`，优先精修画面中最近、最清晰的主体人物；若画面中有多位主角，可根据需要在 `H3FaceTrackCrop` 中调整 `select_index` 或选择模式。
