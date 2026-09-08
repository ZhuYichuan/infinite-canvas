# ComfyUI 渠道指南

本项目仅支持浏览器直连本地自建 ComfyUI 原生 API，默认地址为 `http://127.0.0.1:8188`，不需要额外的中间服务。

## 启动 ComfyUI

浏览器直连时，ComfyUI 必须允许来自前端站点的跨域请求。典型启动参数如下：

```bash
python main.py --listen 0.0.0.0 --enable-cors-header "*"
```

如果只在本机访问，渠道地址填写 `http://127.0.0.1:8188`。从其他设备访问时，应填写运行 ComfyUI 的局域网地址，并确保端口可访问。

## 配置渠道

在「配置」中创建或编辑 ComfyUI 渠道：

1. 填写 ComfyUI 地址。
2. 只有在本地 ComfyUI 前另行配置了认证时才填写 Token；标准本地实例通常留空。
3. 为需要的能力选择内置工作流，或上传符合项目规范的 API 格式工作流 JSON。
4. 使用连接测试确认浏览器能访问 ComfyUI。

工作流槽位、`_meta.title` 标注和输入候选名规则见 [ComfyUI 工作流配置指南](COMFYUI_WORKFLOW_GUIDE.md) 与 [ComfyUI 工作流标准](/docs/development/comfyui-workflow-standard)。

## 原生接口契约

| 操作 | 原生端点 | 说明 |
| --- | --- | --- |
| 上传参考资源 | `POST /upload/image` | multipart 上传到 ComfyUI `input` 目录 |
| 提交工作流 | `POST /prompt` | body 为 `{ prompt, client_id }`，返回 `prompt_id` |
| 查询结果 | `GET /history/{prompt_id}` | 读取任务状态与输出文件信息 |
| 下载产物 | `GET /view?...` 或 `GET /api/view?...` | 返回图片、视频、音频或文本产物 |
| 查询队列 | `GET /queue` | 确认目标任务处于排队或运行状态 |
| 删除排队任务 | `POST /queue` | body 为 `{ "delete": [promptId] }` |
| 中断运行任务 | `POST /interrupt` | 仅在确认目标任务正在运行时调用 |

取消采用按任务保护策略：排队任务只删除自己的队列项；只有目标任务确实正在运行时才调用全局中断，避免误伤其他并发生成。

## 生成与恢复

- 每次新生成通过 `/prompt` 获得独立 `prompt_id`。
- 任务超时不会自动重新提交；节点保留任务 ID，可通过「继续查询」恢复 `/history/{prompt_id}` 轮询。
- 普通失败的「重试」会提交新任务，不复用旧失败任务 ID。
- 主动停止只取消对应节点的任务，不应把其他并发节点改为失败。
- ComfyUI 报告完成但没有目标图片或视频产物时，前端会显式报错。

## 常见问题

### 浏览器无法访问 8188

确认 ComfyUI 已使用 `--listen` 启动、端口未被防火墙阻止，并启用了允许当前前端来源的 CORS 配置。

### HTTPS 页面无法请求 HTTP ComfyUI

这是浏览器的混合内容限制。按界面提示为本地地址放行，或在同一安全上下文中访问前端与 ComfyUI。

### 提交后立即报节点错误

检查上传的是 ComfyUI 的 API 格式工作流，并确认必需模型已安装、保留槽位没有重复、槽位节点存在兼容输入。系统会直接展示 `/prompt` 返回的 `node_errors`。

### 任务完成但没有产物

确认工作流包含对应的保存节点，并能在 `/history/{prompt_id}` 的 `outputs` 中看到目标类型文件。图片流程需要图片输出，视频流程需要视频输出。
