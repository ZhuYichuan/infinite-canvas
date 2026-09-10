# 系统内置渠道本地 ComfyUI
- ComfyUI 根目录：`D:\ComfyUI`
- [本地内建工作流](./local_channel/)

# 系统内置渠道云端 ComfyUI
- ComfyUI 根目录：`/root/autodl-tmp/ComfyUI`
- [云端内建工作流](./yun_chaneel/)

---

# 运行必备 5 大 ComfyUI 核心插件

运行本项目全部内置工作流，必须在 ComfyUI 的 `custom_nodes/` 目录下安装以下 5 个扩展插件：

| 序号 | 插件名称 | GitHub 仓库 | 依赖工作流 | 作用说明 |
| :---: | :--- | :--- | :--- | :--- |
| 1 | **Comfyui-kktools** | `https://github.com/zhiwendesign/Comfyui-kktools` | 文本生成 / 反推 | 大语言模型文本生成与提示词扩写反推 (`kkSomethingToAny`) |
| 2 | **ComfyUI-KJNodes** | `https://github.com/kijai/ComfyUI-KJNodes` | 全能参考视频 | 高级控制流与音视频多模态组件解包 (`GetVideoComponents`) |
| 3 | **ComfyLiterals** | `https://github.com/M1kep/ComfyLiterals` | 首尾帧 / 全能视频 | 基础字面量与尺寸/时长参数动态暴露 (`Int`, `Float`) |
| 4 | **ComfyUI-UniversalToolkit** | `https://github.com/whmc76/ComfyUI-UniversalToolkit` | 文本生成 / 反推 | 通用多类型转接桥接工具箱 (`ShowAny_UTK`) |
| 5 | **ComfyUI_LayerStyle** | `https://github.com/chflame163/ComfyUI_LayerStyle` | 局部编辑 (Inpaint) | 图层样式合成与局部遮罩预处理 (`LayerMask: MaskPreview`) |

### 一键克隆命令（在 `custom_nodes/` 目录执行）

```bash
cd custom_nodes
git clone https://github.com/zhiwendesign/Comfyui-kktools.git
git clone https://github.com/kijai/ComfyUI-KJNodes.git
git clone https://github.com/M1kep/ComfyLiterals.git
git clone https://github.com/whmc76/ComfyUI-UniversalToolkit.git
git clone https://github.com/chflame163/ComfyUI_LayerStyle.git
```

> 详细说明与排错请参考完整指南：[docs/COMFYUI_PLUGINS.md](../docs/COMFYUI_PLUGINS.md)