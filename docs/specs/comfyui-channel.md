# ComfyUI 渠道接入 Spec

> Status: ready-for-agent
> Created: 2026-08-28
> Branch: `feat/comfyui`

---

## Problem Statement

infinite-canvas 当前只对接 OpenAI 兼容协议和 Gemini 两类原生 AI provider。用户希望把本地 ComfyUI 实例接进来作为第三类 provider，与 OpenAI/Gemini 平行，让画布上的 prompt 面板能像调 OpenAI 生图一样调 ComfyUI workflow。

ComfyUI 与 OpenAI 在协议层面差异显著：

- OpenAI：HTTP REST，提交即返回结果（或 SSE 流）
- ComfyUI：异步任务，需要提交 workflow JSON 拿到 `job_id`，轮询 job 状态至完成，再下载输出文件

这意味着如果按 OpenAI 的同构思路去套，会破坏现有画布生成逻辑；需要在 service 层做"协议适配"。

底层库 `tools/comfyui-task/` 已实现 `runWorkflow`（含 binding、轮询、下载），但 Web 端未对接。

## Solution

把 ComfyUI 作为第三种 `apiFormat`，接入到现有"渠道 + 模型"抽象中：

1. 在 `ApiCallFormat` 联合类型加 `"comfyui"` 字面量
2. 在 `ModelChannel` 上加 `comfyuiProxyUrl` / `comfyuiProxyToken` 两个必填字段（指向本地 `comfy-api-proxy` 实例，例如 `http://10.7.8.12:8189`）
3. 在 `ChannelModel` 上加 `comfyuiWorkflow` 字段（一对一绑定一份 workflow JSON 对象）
4. 新增独立 service 层 `requestComfyuiImage(config, prompt, options)`，封装"解析 workflow → 上传 ref → 提交 job → 轮询 → 下载 → 返回 Blob[]"
5. 在现有 `image.ts:requestGeneration/requestEdit` 顶部加 `if (apiFormat === "comfyui") return requestComfyuiImage(...)` 分支
6. 一期预置 3 个 image model：`ComfyUI T2I` / `ComfyUI I2I 1ref` / `ComfyUI I2I 3ref`，全部 `capability: image`
7. i2i 切换由用户在画布 ModelPicker 手动选（不动生成逻辑）
8. 现有 image/video/text/audio 流程一行不改

协议层面：Web → `comfy-api-proxy`（`http://10.7.8.12:8189`）→ 本机 ComfyUI（`http://127.0.0.1:8188`）。

## User Stories

### 用户配置
1. As a ComfyUI user, I want to create a new channel of type "ComfyUI" in the config panel, so that I can connect my local ComfyUI instance.
2. As a ComfyUI user, I want to set the proxy URL (e.g. `http://10.7.8.12:8189`) and token in the channel editor, so that my requests go to the correct proxy.
3. As a ComfyUI user, I want to upload a workflow JSON file to a model, so that the model knows which workflow to run.
4. As a ComfyUI user, I want the channel to come with 3 pre-configured models (T2I / I2I 1ref / I2I 3ref), so that I don't need to add them manually.
5. As a ComfyUI user, I want to rename any of the pre-configured models, so that they match my naming convention.
6. As a ComfyUI user, I want to delete any of the pre-configured models, so that I can remove the ones I don't use.
7. As a ComfyUI user, I want the workflow JSON to be saved with my config, so that it's restored on next browser launch.
8. As a ComfyUI user, I want to see "ComfyUI" as an option in the apiFormat dropdown in the channel editor.

### 文生图（T2I）
9. As a canvas user, I want to select "ComfyUI T2I" model from the ModelPicker, so that I can generate images with my ComfyUI workflow.
10. As a canvas user, I want to enter a text prompt and click generate, so that the T2I workflow runs and the result is shown on canvas.
11. As a canvas user, I want the generated image to appear on the canvas as a new image node, so that I can use it in my project.

### 图生图（I2I）
12. As a canvas user, I want to select "ComfyUI I2I 1ref" model from the ModelPicker, so that I can use a single reference image.
13. As a canvas user, I want to drag an existing image node from the canvas into the generation node, so that it becomes the `ref_image_01` for my workflow.
14. As a canvas user, I want to select "ComfyUI I2I 3ref" model, so that I can use up to 3 reference images.
15. As a canvas user, I want to drag up to 3 existing image nodes into the generation node, so that they become `ref_image_01..03`.

### 进度与控制
16. As a canvas user, I want the image node to show "loading" status while ComfyUI is generating, so that I know the request is in progress.
17. As a canvas user, I want to see the actual image only after ComfyUI finishes, so that I don't see partial results.
18. As a canvas user, I want to manually cancel an in-progress generation, so that I can stop it if I made a mistake.
19. As a canvas user, I want the generation to time out after 10 minutes with a UI message, so that I know if ComfyUI is stuck.
20. As a canvas user, I want the timeout to NOT auto-cancel the job on the proxy, so that the GPU isn't needlessly freed and I can resume by clicking again.

### 默认模型偏好
21. As a canvas user, I want `imageModel` preference to default to "ComfyUI T2I", so that new generations use T2I by default.
22. As a canvas user, I want `videoModel` / `textModel` / `audioModel` preferences to remain empty, so that the preferences dropdown doesn't show broken ComfyUI options for now.

### 错误与日志
23. As a canvas user, I want to see an error toast if ComfyUI returns a failure, so that I know something went wrong.
24. As a canvas user, I want to see an error toast if ComfyUI times out, so that I know to retry.
25. As a canvas user, I want the generation to be logged in `image_generation_logs`, so that I can see it in the workbench history.

### 偏好与默认
26. As a canvas user, I want the `imageModel` preference dropdown to include "ComfyUI T2I" as the default value when a new ComfyUI channel is created.
27. As a canvas user, I want my existing OpenAI / Gemini configurations to be unaffected by adding a ComfyUI channel, so that nothing breaks.

### Export / Import
28. As a multi-device user, I want my ComfyUI config (channel + model workflow) to be exported via `exportAppConfig`, so that I can transfer it.
29. As a multi-device user, I want the workflow JSON to be included in the exported config, so that I don't need to re-upload it on another device.

### 文档与本地化
30. As a first-time ComfyUI user, I want documentation in the project README explaining how to set up ComfyUI as a channel.
31. As a Chinese-speaking user, I want all new UI strings to be translated to Chinese.

## Implementation Decisions

### 1. 数据模型扩展

#### `ApiCallFormat` 联合类型加 `"comfyui"`

```ts
// Before
export type ApiCallFormat = "openai" | "gemini";

// After
export type ApiCallFormat = "openai" | "gemini" | "comfyui";
```

`normalizeApiFormat` 接受 `"comfyui"`，无效值 fallback 到 `"openai"`，确保旧 localStorage 数据 100% 兼容。

#### `ModelChannel` 加 2 个必填字段

```ts
export type ModelChannel = {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    models: ChannelModel[];
    comfyuiProxyUrl?: string;     // 新增：comfy-api-proxy 地址（如 http://10.7.8.12:8189）
    comfyuiProxyToken?: string;    // 新增：Bearer token
};
```

字段 optional，仅当 `apiFormat === "comfyui"` 时必填；旧渠道字段零变化。

#### `ChannelModel` 加 workflow 字段

```ts
export type ChannelModel = {
    name: string;
    capability: ModelCapability;
    script?: string;
    comfyuiWorkflow?: {                // 新增
        name: string;                  // 用户起的名字
        json: Record<string, unknown>; // workflow API JSON
        createdAt: number;
    };
};
```

一对一绑定，无仓、无共享。

#### 默认构造逻辑

`createModelChannel` 在 `apiFormat === "comfyui"` 时自动注入 3 个 model：

```ts
const COMFYUI_DEFAULT_MODELS: ChannelModel[] = [
    { name: "ComfyUI T2I",      capability: "image" },
    { name: "ComfyUI I2I 1ref", capability: "image" },
    { name: "ComfyUI I2I 3ref", capability: "image" },
];
```

`createModelChannel` 接受 `apiFormat` 参数：`apiFormat === "comfyui"` 时 models 预填这 3 个；其他 apiFormat 走原逻辑。

### 2. service 层

#### `web/src/services/api/comfyui.ts` — 主入口

公开函数签名：

```ts
export interface ComfyuiImageRequest {
    config: AiConfig;
    model: string;          // model name
    prompt: string;
    images?: string[];      // ref image URLs (dataUrl or storageKey)
    size?: string;          // "1024x1024" | "1024x1536" | ...
    signal?: AbortSignal;
    onProgress?: (status: string, detail?: Record<string, unknown>) => void;
}

export interface ComfyuiImageResult {
    items: Array<{
        id: string;
        dataUrl: string;
    }>;
    jobId: string;
}

export async function requestComfyuiImage(req: ComfyuiImageRequest): Promise<ComfyuiImageResult>;
```

内部流程：

1. `resolveModelRequestConfig(config, model)` → 拿到 channel（含 proxyUrl/token）和 channelModel
2. `channelModel.comfyuiWorkflow` 必填校验，缺失抛错
3. `parseSize(size)` 解析 `1024x1024` → `{ width: 1024, height: 1024 }`（内置默认 1024x1024）
4. 浅拷贝 workflow JSON，深层定位 `_meta.title === "prompt" | "width" | "height" | "ref_image_01..03"` 的节点，写入 inputs
5. ref 图是 canvas `storageKey` 时，从 localforage `image_files` 取 Blob，转 dataUrl
6. POST `/api/v2/assets`（或类似端点）上传 ref 图，拿到 `asset_id`，写入 workflow 节点的 `inputs.image` 字段（用 ASSET 引用格式）
7. POST `/api/v2/jobs` 提交 workflow → 拿到 `job_id`
8. 注册 `signal.aborted` → `POST /api/v2/jobs/{job_id}/cancel`
9. 轮询 GET `/api/v2/jobs/{job_id}`，status ∈ `pending|in_progress`，每 2s 一次
10. status === `completed` 时从 `outputs[].asset_id` 下载 → Blob → dataUrl
11. timeoutMs = 600_000（10 分钟），超时只 UI 提示不调 cancel
12. 返回 `ComfyuiImageResult`

#### 复用现有 `runModelPlugin` 模板（备用）

`model-plugin.ts:getPluginTemplates()` 增加 `comfyui` 模板字符串，提供给用户在脚本模式下手动覆盖（不作为主路径）。

### 3. 集成点

#### `image.ts` 顶部加分支

```ts
// 在 if (script) 之前
if (requestConfig.apiFormat === "comfyui") {
    return requestComfyuiImage({
        config: requestConfig,
        model: requestConfig.model,
        prompt,
        images: options.images,
        size: requestConfig.size,
        signal: options.signal,
    });
}
```

OpenAI / Gemini 流程 0 影响。

#### `ChannelEditorDrawer` 增加 proxyUrl/token 行

`apiFormat` 下拉加 `"ComfyUI"` 选项。值为 `comfyui` 时展示两个 `Input`：`proxyUrl` + `token`（必填校验）。

#### `ComfyuiWorkflowEditor` 组件

挂在 ModelScriptEditor 旁边（同一 drawer 内或兄弟组件）：
- 显示当前 `comfyuiWorkflow.name`（如有）
- 按钮"上传 workflow JSON" → 选本地 `.json` → `JSON.parse` 校验 → 写回 `channelModel.comfyuiWorkflow`
- 按钮"清空"

不写入 IndexedDB，直接嵌入 `ChannelModel`（随 AiConfig 走 localStorage + exportAppConfig）。

### 4. 数据落地

复用现有路径：
- `image_files` localforage 存 Blob
- `image_generation_logs` 写日志
- `imageMetadata(uploaded)` 转 CanvasNode metadata

不引入新的存储后端。

### 5. i18n

`web/src/i18n/locales/{zh,en}.ts` 加 key：

```
config.channels.comfyuiProxyUrl
config.channels.comfyuiProxyToken
config.models.comfyuiT2I
config.models.comfyuiI2I1ref
config.models.comfyuiI2I3ref
comfyui.uploadWorkflow
comfyui.clearWorkflow
comfyui.noWorkflowAttached
comfyui.timeout
comfyui.cancelled
comfyui.failed
```

### 6. 默认 imageModel

新建 ComfyUI channel 时，若 `config.imageModel` 为空字符串，自动设 `"ComfyUI T2I"`。`videoModel` / `textModel` / `audioModel` 保持空。

## Testing Decisions

### 好的测试标准

- 只测外部行为（输入 → 输出），不测内部实现
- 不 mock 整个 service 层；用 fetch mock 模拟代理响应
- 一个测试一个断言

### 测试模块

`web/src/services/api/__tests__/comfyui.test.ts`（vitest），覆盖：

1. **size 解析**
   - 输入 `"1024x1024"` → `{ width: 1024, height: 1024 }`
   - 输入 `"1024x1536"` → `{ width: 1024, height: 1536 }`
   - 输入空 → 默认 1024x1024

2. **workflow binding**
   - mock 一个简单 workflow（含 `_meta.title="prompt"`/`"width"`/`"height"`）
   - 调用 `requestComfyuiImage`
   - 验证 POST 到 `/api/v2/jobs` 的 body 中 prompt 节点 inputs.text === "a cat"
   - 验证 width/height 节点 inputs.value === 1024

3. **ref 图上传**
   - 输入 2 个 ref 图
   - 验证每个 ref 图走 POST `/api/v2/assets` 上传
   - 验证 workflow 中 ref_image_01 / ref_image_02 的 inputs.image 是上传返回的 asset_id

4. **轮询直到完成**
   - mock `/api/v2/jobs/{id}` 第 1 次返回 `in_progress`，第 2 次返回 `completed`
   - 验证调用了至少 2 次 polling
   - 验证最终 GET `/api/v2/assets/{id}/content` 下载并转 dataUrl

5. **超时**
   - mock `/api/v2/jobs/{id}` 始终 `in_progress`
   - 用 `vi.useFakeTimers()` 推进 10 分钟
   - 验证抛 `ComfyuiTimeoutError`
   - 验证**没有**调 `/api/v2/jobs/{id}/cancel`

6. **取消**
   - 提交后立即 `signal.abort()`
   - 验证调 `/api/v2/jobs/{id}/cancel`
   - 验证抛出 aborted 错误

7. **workflow 缺失**
   - model 没有 `comfyuiWorkflow`
   - 验证抛 `ComfyuiNoWorkflowError`

### Prior art

`canvas-agent/src/**/*.test.ts` 用 `node:test`，但 Web 端需用 vitest（参考 `.claude/memory/web-tests-use-vitest-not-bun-test.md`）。`web/package.json` 当前无 `vitest` 依赖，需新增 `vitest`、`@vitest/ui`（dev）、happy-dom。

`web/vitest.config.ts`：

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
    test: {
        environment: "happy-dom",
        globals: true,
    },
});
```

`web/package.json` scripts 加 `"test": "vitest run"`。

## Out of Scope

- 视频/文本/音频/TTL workflow（只 image，一期）
- WebSocket 实时预览帧（只用轮询）
- 进度条百分比显示（只显示 LOADING 状态）
- 多设备同步 workflow（靠 exportAppConfig 自然带，WebDAV 不做特殊处理）
- proxy 鉴权强化（代理 `--allow` 模式下 token 字段 UI 必填，但 HTTP 层只加 `Authorization: Bearer`）
- 删 / 编辑已有 workflow 之外的 version 管理
- 画布 i2i 自动切换（用户手动切 model）
- model 自动按 ref 图数量推断 workflow
- ComfyUI Cloud（`cloud.comfy.org`）对接，只接本地 `comfy-api-proxy`
- `tools/comfyui-task/src/upload.ts` 改造（web 端用自己的 fetch，不依赖 `Bun.file()`）
- 任何 OpenAI / Gemini 已有行为变更

## Further Notes

### 协议层差异

ComfyUI 与 OpenAI 的根本差异：ComfyUI 是**异步任务**，不是请求-响应。`comfy-api-proxy` 把这一层异步包装成"提交 / 轮询 / 下载"三步，对外像同步 API。本期所有调用都基于这一前提：

- 提交 → `prompt_id`（= `job_id`）
- 轮询 → status
- 下载 → asset content

未来如对接 ComfyUI Cloud，需另写一层 cloud adapter（鉴权用 `X-API-Key`，状态端点不同 `/api/jobs/{id}` vs `/api/job/{id}/status`），不在本期范围。

### `_meta.title` 约定

`tools/comfyui-task/src/binding.ts` 已经定义 `TITLE_TO_INPUT_SLOT` 映射。本期直接复用，不重新发明。

### 调试

调试时可在 `requestComfyuiImage` 中加 `console.log` 输出 submitted job_id 和 polling status。`web/vite.config.ts` 启动 dev server 后浏览器 console 直接看。

### 未来扩展

当用户新建 video workflow 时：
1. 创建一个新的 `ChannelModel`，`name: "ComfyUI T2V"`, `capability: "video"`
2. 上传 workflow JSON 到 `comfyuiWorkflow`
3. 在偏好设置面板把 `videoModel` 改为 `"ComfyUI T2V"`

无需 service 层改动（service 层已支持 capability=video）。

### 性能

ComfyUI workflow 嵌入 `ChannelModel` 后会进 localStorage。3 个 workflow JSON 各 100-500KB，总计 1.5MB 远低于 localStorage 5MB 限制，安全。

导出/导入 AiConfig 时体积会大，但单次操作无影响。