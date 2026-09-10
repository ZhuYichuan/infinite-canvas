<p align="center">
  <img src="web/public/logo.svg" width="96" alt="infinite-canvas logo">
</p>

<h1 align="center">无限画布 (infinite-canvas)</h1>

<p align="center">
  <a href="https://github.com/ZhuYichuan/infinite-canvas"><img src="https://img.shields.io/github/stars/ZhuYichuan/infinite-canvas?style=flat-square&logo=github" alt="GitHub stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-f97316?style=flat-square" alt="License"></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-7-646cff?style=flat-square&logo=vite&logoColor=white" alt="Vite"></a>
  <a href="https://reactrouter.com/"><img src="https://img.shields.io/badge/React_Router-7-ca4245?style=flat-square&logo=reactrouter&logoColor=white" alt="React Router"></a>
  <a href="https://comfyui.com/"><img src="https://img.shields.io/badge/ComfyUI-本地直连-8188?style=flat-square" alt="ComfyUI"></a>
</p>

<p align="center">
  <a href="docs/content/docs/overview/features.zh-CN.mdx">功能介绍</a> · <a href="docs/content/docs/overview/quick-start.zh-CN.mdx">快速开始</a> · <a href="DEPLOY.md">部署与发布</a> · <a href="docs/COMFYUI_WORKFLOW_GUIDE.md">ComfyUI 工作流配置指南</a> · <a href="docs/comfyui-channel.md">ComfyUI 渠道说明</a> · <a href="docs/content/docs/development/comfyui-workflow-standard.zh-CN.mdx">工作流标准规范</a> · <a href="docs/content/docs/progress/todo.mdx">待办事项</a>
</p>

## 关于本项目

本项目基于原项目 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas) fork 而来，在此向原作者 [basketikun](https://github.com/basketikun) 致以诚挚的感谢！

本项目是一个专注于 **ComfyUI** 的分支版本，与原项目的主要区别：

- **仅支持 ComfyUI**：生成渠道已全面收敛为本地自建 ComfyUI（默认 `http://127.0.0.1:8188`），浏览器前端直连 ComfyUI 官方 REST / WebSocket 端点，已移除 OpenAI、Gemini 等外部商用大模型 API 及早期 `comfy-api-proxy` 中间代理。
- **工作流驱动 UI**：画布节点的参数控件完全由绑定的 ComfyUI 工作流槽位（`_meta.title`）动态决定，未标记的槽位不在 UI 上显示。
- **内置开箱即用工作流**：内置文生图、图生图、局部重绘、文本/反推、全能参考视频、首尾帧视频等常用工作流，也可随时上传自定义工作流。

无限画布是一款面向 AI 创作的开源可视化工作台：画布编排、AI 生图 / 视频生成、参考图编辑、Agent 智能助手、提示词库与素材管理都集中在同一个界面里，适合连续探索与迭代视觉方案。

> [!CAUTION]
> 项目处于开发阶段，不保证本地存储的历史数据兼容；项目尚未上线，存储格式可能直接调整。需要稳定分支请自行 fork 后独立开发。

## 核心功能

- 无限画布：多画布项目、节点拖拽缩放、连线、小地图、撤销重做、导入导出。
- ComfyUI 生成：文生图（T2I）、图生图（I2I）、局部重绘、全能参考视频、首尾帧视频等，能力由工作流槽位决定。
- 画布助手：围绕选中节点与上游节点对话、生成，并把结果插回画布。
- 本地 Agent：通过本机 Canvas Agent 连接 Codex / Claude Code，让 Agent 通过 MCP 操作当前画布；提供 Codex App 插件。
- 插件系统：支持通过 URL 动态安装 / 启用 / 更新 / 卸载远程节点插件，并提供 TypeScript SDK 开发画布节点插件。
- 提示词库：浏览器前端直连多个 GitHub 开源项目，并缓存到 IndexedDB。
- 纯前端架构：画布、素材、生成记录与 ComfyUI 访问凭据（如可选 Token）均保存在浏览器本地，无服务端依赖。

完整功能说明见 [功能介绍](docs/content/docs/overview/features.zh-CN.mdx)。

## 快速开始

### 前置条件

- 本机（或局域网）已运行 ComfyUI，默认地址 `http://127.0.0.1:8188`。
- 浏览器能访问该地址（CORS / 网络策略需放通，详见渠道文档）。

### 本地开发

```bash
git clone git@github.com:ZhuYichuan/infinite-canvas.git
cd infinite-canvas/web
bun install
bun run dev
```

启动后访问 `http://localhost:3000`。

### Docker 运行

```bash
git clone git@github.com:ZhuYichuan/infinite-canvas.git
cd infinite-canvas
docker compose up -d
```

运行后默认端口 3000，可访问 `http://localhost:3000`。

## ComfyUI 配置

首次打开后进入右上角「配置」，新建一个 `API 格式` 为 **ComfyUI** 的渠道，填写 ComfyUI 地址（默认 `http://127.0.0.1:8188`）与凭据，即可在画布中使用内置工作流；也可以上传自定义工作流。

- [ComfyUI 工作流配置指南（用户上传工作流必读）](docs/COMFYUI_WORKFLOW_GUIDE.md)：槽位词汇表、`_meta.title` 标注约定、上传与排错。
- [ComfyUI 渠道说明](docs/comfyui-channel.md)：架构、协议、限制与调试技巧。
- [工作流标准规范（开发向）](docs/content/docs/development/comfyui-workflow-standard.zh-CN.mdx)：能力矩阵、槽位契约、输入探测规则。
- [多模态参考视频规格](docs/content/docs/development/multimodal-video-workflow-spec.zh-CN.mdx)：全能参考视频（MiniMax H3）尺寸锁死与资源连线规则（最多 9 图 + 3 视频 + 3 音频）。

## 效果展示

<table width="100%">
  <tr>
    <td width="50%"><img src="https://i.ibb.co/TDFvGWDT/image.png" alt="image" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/zVwJq3YS/image.png" alt="image" border="0"></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://i.ibb.co/PvY3qhhK/image.png" alt="image" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/7D04LwN/image.png" alt="image" border="0"></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://i.ibb.co/bj30FtS5/5.png" alt="5" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/hxRvjw51/image.png" alt="image" border="0"></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://i.ibb.co/jkWsF8q1/image.png" alt="image" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/XrnfXHx7/image.png" alt="image" border="0"></td>
  </tr>
</table>

## 联系方式

| | 联系方式 |
| --- | --- |
| 本分支维护者 | 邮箱：916446339@qq.com · 电话：18656460515 · 抖音：<img src="assets/douyin-qrcode.png" width="110" alt="抖音二维码"> |

## 开源协议

本项目使用 [MIT License](LICENSE)，感谢原作者的开源贡献；二次开发与 PR 请保留原作者信息和前端页面标识。
