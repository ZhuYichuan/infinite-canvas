# MiniMax Music 3 音乐与音频生成工作流

本工作流为系统内置的端到端高质量音乐与音频生成流水线，基于 MiniMax 开源的 **MiniMax Music 03** 音频扩散大模型（Diffusion Transformer，DiT）构建，支持纯前端浏览器直连自建 ComfyUI 原生 API 运行。

## 包含文件

- [API 格式工作流（画布直连执行）](./audio_minimax_music_3_api.json)
- [UI 可视化工作流（ComfyUI 导入查看编辑）](./audio_minimax_music_3_workflow.json)

---

## 模型信息

- **模型名称**: `MiniMax Music 03`
- **模型架构**: Audio Diffusion Transformer (DiT) + 专用音频声学编码器 / VAE
- **适用场景**: 
  - 完整人声歌曲创作（流行、摇滚、Lo-fi、R&B、电子、民谣、古风等全风格覆盖）
  - 影视/游戏/视频背景音乐 (BGM) 与纯伴奏器乐生成
  - 自动化音频生成与音乐创意原型制作

### 必要权重文件（存放在 ComfyUI `models/` 目录）

| 模型类别 | 推荐权重文件路径 | 下载来源与说明 |
| :--- | :--- | :--- |
| **Diffusion Model (DiT)** | `models/diffusion_models/minimax_music3_dit_fp16.safetensors`<br/>*(低显存可选: `minimax_music3_dit_int8_convrot.safetensors`)* | [HuggingFace: Comfy-Org/MiniMax-Music-3](https://huggingface.co/Comfy-Org/MiniMax-Music-3/tree/main/diffusion_models) |
| **Text Encoder** | `models/text_encoders/minimax_music3_text_encoder_pruned_int8_convrot.safetensors`<br/>*(全量可选: `minimax_music3_text_encoder_bf16.safetensors`)* | [HuggingFace: Comfy-Org/MiniMax-Music-3](https://huggingface.co/Comfy-Org/MiniMax-Music-3/tree/main/text_encoders) |
| **Audio VAE** | `models/vae/minimax_music3_dav.safetensors` | [HuggingFace: Comfy-Org/MiniMax-Music-3](https://huggingface.co/Comfy-Org/MiniMax-Music-3/resolve/main/vae/minimax_music3_dav.safetensors) |

> **目录结构参考**：
> ```text
> 📂 ComfyUI/
> └── 📂 models/
>     ├── 📂 diffusion_models/
>     │   ├── minimax_music3_dit_fp16.safetensors
>     │   └── minimax_music3_dit_int8_convrot.safetensors  # 低显存推荐
>     ├── 📂 text_encoders/
>     │   └── minimax_music3_text_encoder_pruned_int8_convrot.safetensors
>     └── 📂 vae/
>         └── minimax_music3_dav.safetensors
> ```

### 依赖环境与扩展插件

1. **ComfyUI 核心版本**：需更新至 **v0.31.0+**（ComfyUI 原生集成了 MiniMax Music 3 核心节点 `MiniMaxMusic3TextEncode`、`VAEDecodeAudio`、`VAEDecodeAudioTiled`、`SaveAudioAdvanced` 等）。
2. **ComfyLiterals**：`https://github.com/M1kep/ComfyLiterals`（提供时长与基础常数外置的 `Float` / `Primitive` 节点）。

---

## 槽位契约与参数映射

工作流已严格按照系统的 `_meta.title` 槽位规范进行标注，前端通过画布音频节点直连时自动映射以下插槽：

| 槽位名 (`_meta.title`) | 节点类别 (`class_type`) | 内部输入名 | 作用与数据流 |
|:---|:---|:---|:---|
| **`output_audio`** | `SaveAudioAdvanced` | `audio` | 目标音频产物输出端口，生成完成后前端自动提取 MP3 文件并存入本地存储回放 |
| **`caption`** | `PrimitiveStringMultiline` | `value` | 音乐风格、流派、配器与氛围三段式描述 |
| **`lyrics`** | `PrimitiveStringMultiline` | `value` | 歌词文本与曲式控制标签（`[intro]`、`[verse]`、`[chorus]`、`[bridge]`、`[outro]`、`[inst]`） |
| **`duration`** | `Float` | `Number` | 目标音乐时长（秒），支持 30s ~ 300s（最长 5 分钟） |
| **`seed`** | `PrimitiveInt` | `value` | 随机种子，同时作用于文本条件编码与 K 采样器 |

---

## 技术特点与使用建议

1. **双文本驱动架构**：
   - **`caption` (风格编曲)**：决定音乐的基调与声学表现。推荐包含：
     - *Global Metadata*：流派（如 Lo-fi、Synthwave）、速度（BPM）、调性、情绪氛围。
     - *Vocal Details*：人声音色、男女声倾向、混响质感。
     - *Arrangement*：主奏与伴奏乐器、段落配器起伏。
   - **`lyrics` (歌词与曲式)**：曲式标签是该模型控制音乐结构的**唯一执行性指令**。
2. **纯器乐 (Instrumental) / 纯伴奏模式**：
   - 当无需人声时，`lyrics` 仅需保留曲式骨架标签（如 `[intro]\n\n[inst]\n\n[outro]`），模型将自动抑制人声输出高品质纯器乐。
3. **低显存切块解码保护 (Tiled Decode)**：
   - 工作流内建了 `VAEDecodeAudioTiled` 与切换器，针对 2 分钟以上的长音乐，在 8GB~16GB 消费级显卡上可有效避免音频 VAE 解码时的 OOM 显存溢出。
4. **生成步数与时长平衡**：
   - 默认采样器配置为 30 步（`euler` / `simple`，CFG 1.7）。
   - 推荐生成时长梯度：`30s` (片段灵感) / `60s` (标准短曲) / `120s` (完整曲目) / `300s` (长篇完整作品)。
