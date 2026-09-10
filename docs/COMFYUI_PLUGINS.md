# Infinite Canvas · ComfyUI 核心依赖插件全景说明与安装指南

本文档将本项目所有官方工作流所依赖的 **5 大 ComfyUI 核心扩展插件** 进行统一集中整理与深度说明，提供一键安装命令、工作流对应矩阵、关键节点解析与常见排错方法。

---

## 1. 核心插件速查清单

运行 Infinite Canvas 官方预置的 6 大核心工作流，需在 ComfyUI 的 `custom_nodes/` 目录下安装以下 5 个核心插件：

| 序号 | 插件名称 | GitHub 仓库地址 | 维护作者 | 依赖此插件的工作流 | 核心功能 / 关键节点 |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Comfyui-kktools** | [`zhiwendesign/Comfyui-kktools`](https://github.com/zhiwendesign/Comfyui-kktools) | zhiwendesign | **文本生成 / 反推工作流** (`llm_qwen3_5_text_gen_workflow.json`) | 端侧大语言模型多模态文本生成、提示词润色扩写与反推 (`kkSomethingToAny`) |
| **2** | **ComfyUI-KJNodes** | [`kijai/ComfyUI-KJNodes`](https://github.com/kijai/ComfyUI-KJNodes) | kijai | **全能参考视频工作流** (`minimax_h3_ref2v_workflow.json`) | 高级逻辑流控制、多模态音视频组件解包提取 (`SetNode`, `GetVideoComponents`) |
| **3** | **ComfyLiterals** | [`M1kep/ComfyLiterals`](https://github.com/M1kep/ComfyLiterals) | M1kep | **首尾帧视频** / **全能参考视频** (`minimax_H3_i2v&t2v_workflow.json`, `minimax_h3_ref2v_workflow.json`) | 基础字面量常数与参数暴露端口 (`Int`, `Float`, `String`, `Boolean`) |
| **4** | **ComfyUI-UniversalToolkit** | [`whmc76/ComfyUI-UniversalToolkit`](https://github.com/whmc76/ComfyUI-UniversalToolkit) | whmc76 | **文本生成 / 反推工作流** (`llm_qwen3_5_text_gen_workflow.json`) | 通用数据类型转换工具箱与多类型参数转接桥接 (`ShowAny_UTK`) |
| **5** | **ComfyUI_LayerStyle** | [`chflame163/ComfyUI_LayerStyle`](https://github.com/chflame163/ComfyUI_LayerStyle) | chflame163 | **局部编辑 (Inpaint) 工作流** (`mask_edit_workflow.json`) | 图层样式合成与局部重绘遮罩处理 (`LayerMask: MaskPreview`, `LayerMask: MaskGrow`) |

---

## 2. 一键安装命令

打开终端进入你的 ComfyUI 根目录下的 `custom_nodes/` 文件夹执行以下命令：

### Linux / macOS / AutoDL 云主机

```bash
cd custom_nodes
git clone https://github.com/zhiwendesign/Comfyui-kktools.git
git clone https://github.com/kijai/ComfyUI-KJNodes.git
git clone https://github.com/M1kep/ComfyLiterals.git
git clone https://github.com/whmc76/ComfyUI-UniversalToolkit.git
git clone https://github.com/chflame163/ComfyUI_LayerStyle.git
```

### Windows (PowerShell)

```powershell
cd custom_nodes
git clone https://github.com/zhiwendesign/Comfyui-kktools.git
git clone https://github.com/kijai/ComfyUI-KJNodes.git
git clone https://github.com/M1kep/ComfyLiterals.git
git clone https://github.com/whmc76/ComfyUI-UniversalToolkit.git
git clone https://github.com/chflame163/ComfyUI_LayerStyle.git
```

> ⚠️ **提示**：克隆完成后，**必须完全重启 ComfyUI** 服务，新节点才会注册加载到 ComfyUI 运行环境中。

---

## 3. 工作流与依赖插件对应关系矩阵

| 官方工作流文件 | 工作流名称 | kktools | KJNodes | ComfyLiterals | UniversalToolkit | LayerStyle |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `image_z_image_turbo_workflow.json` | 文生图 (T2I) | - | - | - | - | - |
| `image_flux2.dev_mult_image_edit_workflow.json` | 图生图 (I2I) | - | - | - | - | - |
| `mask_edit_workflow.json` | 局部编辑 (Inpaint) | - | - | - | - | ✅ |
| `llm_qwen3_5_text_gen_workflow.json` | 文本生成 / 反推 (LLM) | ✅ | - | - | ✅ | - |
| `minimax_H3_i2v&t2v_workflow.json` | 首尾帧视频 (Frame Video) | - | - | ✅ | - | - |
| `minimax_h3_ref2v_workflow.json` | 全能参考视频 (Omni Video) | - | ✅ | ✅ | - | - |

> 💡 **说明**：
> - **文生图**与**图生图**采用 ComfyUI 原生基础节点构建，无需第三方扩展插件即可直接开箱运行。
> - **局部编辑**专为无限画布的画笔涂抹遮罩设计，依赖 `LayerStyle` 处理遮罩融合。
> - **文本生成/反推**依靠 `kktools` + `UniversalToolkit` 驱动本地轻量端侧大模型。
> - **视频生成**依靠 `ComfyLiterals` 与 `KJNodes` 接收前端动态参数并解包音视频组件。

---

## 4. 插件深度解析与工作原理

### 4.1 Comfyui-kktools
- **仓库**：`https://github.com/zhiwendesign/Comfyui-kktools`
- **核心功能**：端侧轻量化 LLM（如 Qwen3.5-4B / 7B）在 ComfyUI 中的多模态文本生成、提示词润色扩写与画面反推。
- **关键节点**：`kkSomethingToAny`
- **作用机制**：
  在无限画布中，用户可在文本生成节点输入文字或连接参考图片。`kkSomethingToAny` 负责将多模态大语言模型的输出解析转换为系统下游节点统一接受的文本与数据结构，支持流式与单次完整产物输出。

### 4.2 ComfyUI-KJNodes
- **仓库**：`https://github.com/kijai/ComfyUI-KJNodes`
- **核心功能**：高级工作流控制流、逻辑分支与多模态音视频组件解包。
- **关键节点**：`SetNode`、`GetNode`、`GetVideoComponents`
- **作用机制**：
  全能参考视频生成（MiniMax H3 ref2va）架构支持最多 9 张参考图 + 3 段参考视频 + 3 段参考音频。KJNodes 用于解包传入视频中的画面关键帧与音频流。
  - **动态级联修剪配合**：若用户未连满 3 段视频或 3 段音频，无限画布在向 ComfyUI 提交前会**自动彻底抹除未连线的参考输入及其对应的 KJNodes 级联桥接节点**，杜绝 ComfyUI 因悬挂空引用而报 `FileNotFoundError`。

### 4.3 ComfyLiterals
- **仓库**：`https://github.com/M1kep/ComfyLiterals`
- **核心功能**：提供原生的基础类型常数（Integer、Float、String、Boolean）输入端口。
- **关键节点**：`Int`、`Float`
- **作用机制**：
  用于在工作流中以原生槽位形式暴露动态参数（例如 `_meta.title = "width"`、`_meta.title = "height"`、`_meta.title = "duration"`）。无限画布前端解析到这些槽位后，会自动将固定大模型表单替换为硬件对齐的 9 档分辨率与预设时长下拉菜单，提交时将数值直接注入到 Literal 节点中。

### 4.4 ComfyUI-UniversalToolkit
- **仓库**：`https://github.com/whmc76/ComfyUI-UniversalToolkit`
- **核心功能**：多类型通用数据转换、桥接与数据流查看工具箱。
- **关键节点**：`ShowAny_UTK`
- **作用机制**：
  在文本生成与多模态反推工作流中，用于桥接大模型输出的文本并传递给系统保存节点，确保前端能够通过 `/history` 接口完整抓取生成的文本内容。

### 4.5 ComfyUI_LayerStyle
- **仓库**：`https://github.com/chflame163/ComfyUI_LayerStyle`
- **核心功能**：图层样式合成、遮罩预处理、边缘羽化与反转。
- **关键节点**：`LayerMask: MaskPreview`、`LayerMask: MaskGrow`
- **作用机制**：
  在画布中进行「局部遮罩编辑」时，前端会将用户涂抹的白色 Mask 图片上传并绑定到 `ref_mask` 槽位。`ComfyUI_LayerStyle` 节点负责将遮罩与原图进行尺寸校验、图层对齐与预处理，确保 ControlNet 与重绘采样器精准作用于目标区域。

---

## 5. 两种安装方式指引

### 方式一：终端 Git Clone（推荐，最快捷稳定）
1. 确认系统已安装 `git` 工具；
2. 打开终端，执行 `cd <ComfyUI根目录>/custom_nodes`；
3. 复制上方第 2 节的 5 条克隆命令并回车执行；
4. 检查每个插件目录下是否存在 `requirements.txt`。若有且缺少依赖，执行对应环境的 `pip install -r requirements.txt`；
5. 重启 ComfyUI。

### 方式二：通过 ComfyUI-Manager 界面安装
1. 打开 ComfyUI 网页界面；
2. 点击右侧悬浮菜单中的 **Manager**；
3. 点击 **Custom Nodes Manager**；
4. 在搜索框中分别搜索以下关键词并点击 **Install**：
   - `kktools` ➔ 找到 **Comfyui-kktools**
   - `KJNodes` ➔ 找到 **ComfyUI-KJNodes**
   - `ComfyLiterals` ➔ 找到 **ComfyLiterals**
   - `UniversalToolkit` ➔ 找到 **ComfyUI-UniversalToolkit**
   - `LayerStyle` ➔ 找到 **ComfyUI_LayerStyle**
5. 点击 Manager 弹窗下方的 **Restart** 重启 ComfyUI 服务。

---

## 6. 常见问题与排错（FAQ）

### 6.1 导入工作流提示 `When loading the graph, the following node types were not found`
- **原因**：缺少对应插件，或者插件已克隆但未重启 ComfyUI。
- **排查步骤**：
  1. 查看红字提示中缺失的节点类型（例如 `SetNode` 代表缺少 `ComfyUI-KJNodes`，`ShowAny_UTK` 代表缺少 `UniversalToolkit`）；
  2. 确认 `custom_nodes/` 目录下对应插件文件夹是否完整存在；
  3. 查看 ComfyUI 终端启动日志，确认启动时是否有该插件的 `ImportError`（若有说明缺少 Python 依赖库，需 `pip install` 对应依赖）；
  4. 重启 ComfyUI 后刷新网页重新导入。

### 6.2 国内网络下 Git Clone 超时失败
- 可使用 GitHub 加速镜像进行克隆，例如：
  ```bash
  git clone https://ghfast.top/https://github.com/zhiwendesign/Comfyui-kktools.git
  git clone https://ghfast.top/https://github.com/kijai/ComfyUI-KJNodes.git
  git clone https://ghfast.top/https://github.com/M1kep/ComfyLiterals.git
  git clone https://ghfast.top/https://github.com/whmc76/ComfyUI-UniversalToolkit.git
  git clone https://ghfast.top/https://github.com/chflame163/ComfyUI_LayerStyle.git
  ```

### 6.3 视频生成提示组件节点报错
- 确认安装的 `ComfyUI-KJNodes` 为最新版本，老版本可能缺少部分视频解包处理节点。进入 `custom_nodes/ComfyUI-KJNodes` 目录下执行 `git pull` 更新即可。
