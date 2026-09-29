# 云端镜像免本地配置指南

为了让没有高性能显卡（如 RTX 4090 / 4080 等）或不想在本地繁琐安装 Python、CUDA、PyTorch 及下载数十 GB 大模型的开发者与创作者能够立即体验无限画布，本项目已在 **LightCC** 和 **AutoDL** 官方镜像市场提供了**开箱即用的一键预装镜像**。

预装镜像中已经配置好 ComfyUI 运行环境、必备核心插件（`Comfyui-kktools`、`ComfyUI-KJNodes`、`ComfyLiterals`、`ComfyUI-UniversalToolkit`、`ComfyUI_LayerStyle` 等）与常用模型，开机后仅需将访问地址填入画布即可直接使用。

---

## 镜像地址一览

| 平台 | 镜像一键启动地址 | 推荐度与平台特点 |
| :--- | :--- | :--- |
| **LightCC** | [LightCC 官方镜像入口](https://www.lightcc.cloud/imageDetail?id=75064&invitationCode=yKBHXCJF108947) | **⭐ 官方首选推荐** · 按量计费、极速启动、一键跳转 Web 应用；推荐 RTX 4080 / 4090 等 |
| **AutoDL** | [AutoDL 官方镜像入口](https://www.autodl.art/app/market/305?v=932) | 备选支持 · 算力资源丰富、多卡型可选、稳定可靠；推荐 RTX 4090 / 5090D 等 |

---

## 3 步极速接入指引

核心流程仅需 3 步：**开机运行镜像 -> 复制 ComfyUI 访问地址 -> 粘贴到画布渠道配置**。

### 步骤 1：到云端平台找到镜像并开机

根据你选择的平台进行操作（首选推荐 LightCC）：

#### 方案 A：LightCC 平台（首选推荐）

1. 点击打开 [LightCC 镜像页面](https://www.lightcc.cloud/imageDetail?id=75064&invitationCode=yKBHXCJF108947)，选择机器开机。
2. 在左侧菜单进入「我的应用」，在「ComfyUI无限画布」卡片中点击 **「进入应用 →」**。

![LightCC 开机并进入应用](../assets/cloud-mirror/lightcc-1.png)

#### 方案 B：AutoDL 平台

1. 点击打开 [AutoDL 镜像页面](https://www.autodl.art/app/market/305?v=932)，选择算力机器并开机。
2. 待实例状态变为「运行中」后，在「访问应用服务」一栏中，点击 **WebUI-6006** 按钮。

![AutoDL 开机并点击 WebUI-6006](../assets/cloud-mirror/autodl-1.png)

---

### 步骤 2：复制浏览器中的 ComfyUI 访问地址

点击进入应用后，浏览器会打开一个新的标签页进入 ComfyUI 界面。请**直接从浏览器顶部地址栏复制完整的访问 URL**：

#### LightCC 地址复制示例（推荐）
复制形如 `https://ljr6nfbxnmboxxxx.swiftlink54.lightcc.cloud` 的完整地址：

![复制 LightCC 浏览器地址](../assets/cloud-mirror/lightcc-2.png)

#### AutoDL 地址复制示例
复制形如 `https://u595231-xxxx.weste.seetacloud.com:8443` 的完整地址：

![复制 AutoDL 浏览器地址](../assets/cloud-mirror/autodl-2.png)

---

### 步骤 3：在画布页面配置 ComfyUI 地址

1. 打开无限画布页面（可直接访问在线版 [https://canvas.imihoo.com/](https://canvas.imihoo.com/)，或使用本地开发启动的 `http://localhost:3000`）。
2. 点击画布右上角设置图标打开 **「配置与用户偏好」** 弹窗。
3. 在渠道列表中点击新建或编辑 ComfyUI 渠道：
   - **渠道名称**：自定义填写，例如 `autodl` 或 `lightcc`。
   - **协议**：选择 `ComfyUI`。
   - **ComfyUI 接口地址**：将步骤 2 中复制出来的完整地址粘贴到此处。
   - **Token / 访问凭据**：官方云镜像直连接口默认无需填写，留空即可。
4. 点击 **「测试连接」**，提示成功后点击 **「保存」**。

![在画布中配置 ComfyUI 渠道地址](../assets/cloud-mirror/canvas-config-3.png)

5. 保存后回到画布，在文生图、图生图或全能视频节点中，将生成渠道切换为刚才添加的渠道名称（如 `autodl`），即可畅享云端 GPU 极速生成！

---

## 注意事项与常见问题

1. **关机防扣费**：云端算力按使用时长计费。使用完毕后，请记得回到云平台控制台对实例执行「关机」或「停机」，避免产生不必要的算力费用。
2. **测试连接失败排查**：
   - 确认云端实例处于「运行中」状态。
   - 确认复制的地址完整无误（包含 `https://` 协议头以及端口号）。
   - 可先在浏览器直接打开该地址，确认能否正常进入 ComfyUI 原生工作台界面。
3. **工作流兼容性**：预装镜像已预装本项目官方内置的核心工作流与依赖插件；如需上传自定义工作流，请参考 [ComfyUI 工作流配置指南](COMFYUI_WORKFLOW_GUIDE.md)。
