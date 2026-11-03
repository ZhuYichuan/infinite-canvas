# 0002. 生成进度只走 WebSocket，且同一标签页的 clientId 必须固定

- 状态：已采纳
- 日期：2026-11-03

## 背景

画布节点在生成期间只能显示「排队位次」或「执行中」，没有百分比。梳理本地 ComfyUI 8188 的接口面后确认：

- HTTP 侧没有任何进度。`GET /queue` 只给队列数组，`GET /history/{prompt_id}` 只给终态，`GET /prompt` 只给 `exec_info.queue_remaining`，`GET /api/jobs/{job_id}`（v0.6.0+）只给 `pending` / `in_progress` / `completed` / `failed` / `cancelled` 枚举，全文没有任何 `value` / `max` 字段。
- Comfy API v2 的 `GET /api/v2/jobs/{id}` 与 `/events` SSE 确实提供 `value`（0~1 整体分数）、`nodes_done` / `nodes_total`、`step` / `steps`，但该 spec 的 server 只有 `comfy-api-proxy:8189`、Comfy Cloud 与 serverless 部署，本地 8188 直连没有 `/api/v2` 路由，而代理层已废弃。
- 真进度只在 WebSocket `/ws` 上：`progress` 给单节点 `value` / `max`，`progress_state`（v0.3.45+）给全节点状态快照。服务端**不提供整体百分比**。

而这条 WebSocket 的推送是定向的，不是广播：`PromptServer.client_id` 是全局单值，每个 prompt 开始执行时从提交 body 的 `client_id` 覆盖一次，跑完不重置；`progress`、`progress_state`、`executing`、`executed`、`execution_start`、`execution_success`、`execution_error` 全部只发给这一个 sid，只有 `status` 与 `execution_interrupted` 广播给所有连接。

## 决策

进度只走 WebSocket。

每个浏览器标签页对每个 ComfyUI 渠道维持一条模块级单例连接，其 `clientId` 固定（按 baseUrl 持久化），该标签页的所有提交沿用同一个 `clientId`，消息按 `prompt_id` 分流到具体任务。HTTP 轮询保留为终态与产物的唯一权威，WebSocket 只是增强层。

整体百分比在前端自行估算：分母取提交时 workflow 的节点总数；分子为 `progress_state` 中 finished 节点数加当前 running 节点的 `value` / `max` 比例，`execution_cached` 命中的节点计入 finished；结果单调不减并封顶 99，只有 `/history` 确认成功才置 100。

连接断开即静默降级为纯轮询，百分比置为未知，UI 显示不确定态。

## 备选方案与取舍

**继续纯 HTTP 轮询**：改动最小，但拿不到任何百分比，问题本身不解决。放弃。

**每个任务一条 WebSocket、clientId 每次提交新生成（当前提交逻辑）**：看似连接数可控，但定向规则下任务切换时 `client_id` 被换成新值，旧连接立刻收不到任何进度，等于每执行一个任务就失聪一次。放弃。

**提交时不带 `client_id`，蹭广播**：`progress` 与 `progress_state` 确实会广播给所有连接，但 `executing`、`executed`、`execution_start`、`execution_error` 在 `client_id` 为空时根本不发送，等于用一半事件换广播；且多标签页或官方前端同时在用时，广播与否取决于当前执行的那个 prompt 是谁提交的。放弃。

**改走 Comfy API v2 + SSE，直接拿服务端算好的 Progress**：字段最全、语义最准，但只有代理层与云端提供，本地 8188 无此路由，而本项目已明确废弃代理层。放弃。

**用 `/api/jobs/{id}` 轮询替换现有 `/queue` + `/history`**：状态枚举更干净，取消也能按 id 精准执行，但仍无进度，且需要 v0.6.0+，与「不锁 ComfyUI 版本」冲突。记为待办，不进本次。

## 后果

- 百分比是本地估算而非服务端真值。动态提示展开会让实际执行节点数超过提交的 workflow 节点数，分母偏小；靠「单调不减 + 封顶 99 + 成功才置 100」兜底，因此会看到长时间停在 99%。
- `clientId` 一旦持久化就不能随意更换：换了之后提交与连接两端 sid 不匹配，进度立刻中断。更换 `clientId` 必须与重建连接同时进行。
- 同一 `clientId` 只能存在一条活连接。服务端在 sid 重复时会把旧 socket 从映射中 pop 掉，旧连接在客户端侧仍是 OPEN 的僵尸连接，因此连接必须是模块级单例，React 严格模式的双挂载不得新建第二条。
- `https` 页面无法连接 `ws://`，这是与现有 `ComfyuiMixedContentError` 同源的限制；这类渠道永远只有轮询态，进度条只能显示不确定态。
- 重连不补发当前节点的 `value` / `max`（服务端只补一条 `executing`），重连后当前节点进度必须重置为未知，不能沿用断开前的值。
- WebSocket 事件缺失不影响终态判定：`/history` 轮询始终能独立得出 success / error / cancelled / lost。
