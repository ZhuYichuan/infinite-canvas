# CI 与镜像发布踩坑手册

本文记录 GitHub Actions 在「文档站构建、Docker 镜像发布、GitHub Pages」链路上踩过的坑及根因，供复刻 / 发版时对照排查。

本项目的发布类 workflow 统一由**打版本 tag（`v*`）**触发，见 `.github/workflows/`：

| Workflow | 作用 | 触发 |
| --- | --- | --- |
| `docker-image.yml` | 构建主应用镜像并推送 | `push: tags: ["v*"]` / 手动 dispatch |
| `docs-docker-image.yml` | 构建文档站镜像并推送 | 同上 |
| `github-pages.yml` | 构建并部署文档站到 GitHub Pages | 同上 |
| `publish-plugins.yml` | 构建官方插件产物推到孤儿分支 `plugins-dist` | 同上 |

因为只在打 tag 时才跑，**坏内容可以在 main 上沉睡很久，直到发版才被 CI 撞出来**。

---

## 一、MDX 里的裸花括号导致文档站构建失败

### 症状

`docs-docker-image.yml` / `github-pages.yml` 在 `bun run build`（即 `next build`）阶段失败：

```
Error occurred prerendering page "/zh-CN/docs/development/comfyui-workflow-standard"
ReferenceError: filename is not defined
Export encountered an error on /[lang]/docs/[...slug]/page: ..., exiting the build.
error: script "build" exited with code 1
```

把 `filename` 加反引号修掉后，又冒出 `ReferenceError: slot is not defined`，如此反复。

### 根因

文档站是 **Fumadocs + Next.js + MDX**（见 `docs/source.config.ts`、`docs/next.config.mjs` 的 `createMDX()`）。

**MDX 不是 Markdown，而是「Markdown + JSX」超集**：花括号 `{ }` 里的内容会被编译成 **JavaScript 表达式**并在渲染时真正求值。

```mdx
3 × 5 = {3 * 5}      →  渲染为 "3 × 5 = 15"
缺少模型: {filename}  →  编译成 JSX {filename}，执行时 ReferenceError
```

文档里写技术占位符时裸写了 `{filename}`、`{slot}`、`{id}`、`{kind}`、`{slot: value}`，这些都被当成 JS 变量求值，而变量从未定义 → `ReferenceError`。

`next build` 会尝试**预渲染（SSG）每个页面**，预渲染必须真正执行一次 React 渲染，于是构建期就抛错；且**只报第一个撞上的错误就退出**，所以修复时会「一个一个接着冒」。这不是新 bug，是同一批未转义花括号被编译器逐个暴露。

### 修复

把需要显示为字面量的花括号放进**行内代码（反引号）**，它就不会被当表达式求值：

```diff
- | "缺少模型: {filename}，请确认已下载到 models/ 目录" |
+ | "缺少模型: `{filename}`，请确认已下载到 models/ 目录" |
```

同理处理 `{slot}`、`{id}`、`{kind}`、`{slot: value}` 等。另一种写法是转义 `\{filename\}`，但加反引号语义更清晰（它本来就是占位符）。

### 预防

- 写 MDX 时，凡是**要给用户看的花括号字面量**（占位符、模板变量），一律用反引号包起来。
- 改完文档**本地先构建一遍**再提交：

  ```bash
  cd docs
  bun install --frozen-lockfile --ignore-scripts
  bun run postinstall
  bun run build
  ```

  构建成功会输出全部静态页面（如 `Generating static pages (78/78)`），能提前发现预渲染错误，避免白跑 CI。

---

## 二、镜像名写死原作者命名空间导致推送被拒

### 症状

镜像**构建成功、最后 push 被拒**（日志能看到前面的 build 步骤都 OK）：

```
failed to push ghcr.io/basketikun/infinite-canvas: denied:
permission_denied: The requested installation does not exist.
```

### 根因

本项目是**复刻（fork/clone）**自原作者 `basketikun` 的仓库，但两个 workflow 的 `IMAGE_NAME` 仍写死原作者的镜像地址：

- `ghcr.io/basketikun/infinite-canvas`
- `ghcr.io/basketikun/infinite-canvas-docs`

Actions 里用的是 `secrets.GITHUB_TOKEN`，它**只能推本仓库所属账号名下的 GHCR**。往 `basketikun` 的命名空间推 = 往别人家 registry 推 → 被拒（`installation does not exist` 指当前账号下没有该 registry 的安装）。

### 修复

镜像发布改用**自己的 Docker Hub**，登录凭据走独立的 secrets：

1. 改 `.github/workflows/docker-image.yml` 与 `docs-docker-image.yml`：

   ```yaml
   env:
     IMAGE_NAME: 916446339/infinite-canvas        # docs 为 916446339/infinite-canvas-docs

   permissions:
     contents: read          # 推 Docker Hub 不再需要 packages: write

   # 两处 docker/login-action 都改为：
   - uses: docker/login-action@v3
     with:
       registry: docker.io
       username: ${{ secrets.DOCKERHUB_USERNAME }}
       password: ${{ secrets.DOCKERHUB_TOKEN }}
   ```

2. 在仓库 **Settings → Secrets and variables → Actions** 添加：
   - `DOCKERHUB_USERNAME` = Docker Hub 用户名
   - `DOCKERHUB_TOKEN` = Docker Hub 密码或 Access Token（个人账号两者皆可，本地 `docker login` 验证可用后再填）

3. 同步更新引用镜像地址的文件：`docker-compose.yml`、`docs/docker-compose.yml`、`docs/content/docs/overview/docker*.mdx`、`DEPLOY.md`。

### 验证

```bash
# 确认多架构 manifest 已生成
docker buildx imagetools inspect 916446339/infinite-canvas:v0.19.1
# 预期包含 linux/amd64 与 linux/arm64
```

---

## 三、GitHub Pages 未启用 / 环境规则不放行 tag

### 症状

```
Get Pages site failed. Please verify that the repository has Pages enabled
and configured to build using GitHub Actions...
Error: Not Found - .../pages
```

启用后第二次又失败：

```
Tag "v0.19.1" is not allowed to deploy to github-pages
due to environment protection rules.
```

### 根因与修复

1. **Pages 未启用**：仓库 Settings 里没有开启 Pages。可通过 API 启用（`build_type: workflow`）：

   ```bash
   gh api repos/<owner>/<repo>/pages -X POST -f build_type=workflow
   ```

2. **environment protection rules**：启用时自动创建的 `github-pages` 环境，其 deployment branch policy 默认不包含 tag。放行 tag 与分支：

   ```bash
   gh api repos/<owner>/<repo>/environments/github-pages/deployment-branch-policies \
     -X POST -f name='v*' -f type='tag'
   gh api repos/<owner>/<repo>/environments/github-pages/deployment-branch-policies \
     -X POST -f name='main' -f type='branch'
   ```

### 验证

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<owner>.github.io/<repo>/   # 预期 200
```

---

## 发版排查清单

按顺序核对，能覆盖上述全部坑位：

1. 目标分支的 MDX / markdown 改动能**本地 `docs/ bun run build`** 通过。
2. `docker-image.yml` / `docs-docker-image.yml` 的 `IMAGE_NAME` 指向**本仓库账号命名空间**。
3. 仓库已配置 `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`，且本地 `docker login` 验证可用。
4. 仓库已启用 Pages，且 `github-pages` 环境放行了 `v*`（tag）与 `main`（默认分支）。
5. 按 `AGENTS.md` 的「发版本流程」更新 `VERSION` 与 `CHANGELOG.md`，提交后打 tag 并推送 tag。
6. 观察 4 个 workflow：主应用镜像、文档镜像、GitHub Pages、官方插件。

> 注意：`AGENTS.md` 规定发版流程本身不跑编译 / 测试 / 构建，除非用户明确要求；上面第 1 条属于「改文档后」的本地自检，建议在提交前完成，而非发版时补做。
