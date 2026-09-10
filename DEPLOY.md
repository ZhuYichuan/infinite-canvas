# 部署与发布指南

本文档说明 infinite-canvas 项目**部署什么、部署到哪里、如何发布版本、实际的部署流程**，并附带部署结果验证方法。流程基于生产服务器（`root@114.55.54.9`，站点 `canvas.imihoo.com`）上的真实部署习惯整理。

## 1. 部署什么东西

本项目是**纯静态前端**（Vite + React），没有任何服务端 API：

- AI 生成由浏览器**直连用户本机/局域网的 ComfyUI**（默认 `http://127.0.0.1:8188`），服务器不代理、不转发。
- 画布、素材、生成记录、渠道凭据全部保存在浏览器本地（IndexedDB / localStorage）。
- 因此部署物只有一样：`web/` 构建产物 **`web/dist/`** 目录，包含：

| 内容 | 说明 |
| --- | --- |
| `index.html` | SPA 入口，引用带 hash 的 `assets/` |
| `assets/` | 打包后的 JS/CSS |
| `config.js` | 运行期配置（统计开关），构建产物内置为空默认值，禁止缓存 |
| `icons/`、`logo.svg` | 静态图标 |
| `plugins/` | 插件索引 |
| `workflows/` | 内置 ComfyUI 工作流 JSON（/guide 页下载用） |

服务器端不需要 Node、不需要数据库，只需要 **nginx 托管静态目录**。

## 2. 支持的部署形态

| 形态 | 入口 | 适用场景 |
| --- | --- | --- |
| 本地开发 | `cd web && bun install && bun run dev` → `http://localhost:3000` | 开发调试 |
| Docker | 仓库根目录 `docker compose up -d`（官方镜像 `ghcr.io/basketikun/infinite-canvas`），或 `docker-compose.local.yml` 本地构建 | 单机容器部署，详见 `docs/content/docs/overview/docker.zh-CN.mdx` |
| 静态 nginx 服务器 | 本文第 4 节 | **当前生产环境（canvas.imihoo.com）** |
| Vercel / Render | `vercel.json` / `render.yaml` | 一键云部署 |

> Docker 与静态部署的区别：Docker 镜像在容器启动时用 `web/docker-entrypoint.sh` 按环境变量（`ANALYTICS_GA4_ID` / `ANALYTICS_BAIDU_ID`）**生成** `config.js`；静态部署直接使用 `web/public/config.js` 的内置空默认值（不启用任何统计）。

## 3. 发布流程（打版本）

遵循 `AGENTS.md` 的发版本流程：

1. 把 `CHANGELOG.md` 的 `Unreleased` 变更整理成新的版本记录，保留空 `Unreleased` 标题。
2. 提升并更新根目录 `VERSION`（如 `v0.16.0` → `v0.17.0`）。
3. 将当前代码全部提交到 Git。
4. 提交完成后打对应 tag，如 `v0.17.0`。
5. 发版本流程中不执行编译、测试或构建（除非另行手动构建用于部署）。

注意：`web/dist` 会被 `Dockerfile` 打进镜像时重新构建，且 `dist` 已加入 `.gitignore`，**产物不进 Git**，每次部署都从当前工作区重新构建。

## 4. 实际部署流程（静态 nginx 服务器）

生产环境现状（`114.55.54.9`）：

- nginx 1.24（Ubuntu），多站点模式：`/etc/nginx/sites-available/<域名>` 写配置，`/etc/nginx/sites-enabled/<域名>` 软链接启用。
- 站点目录：`/var/www/<域名>/`，属主 `www-data`。
- 每次发布前在 `/var/www/` 下生成时间戳备份 `/<域名>_<YYYYMMDD_HHMMSS>.tar.gz`。

### 4.1 首次部署（已有 nginx 配置可跳过）

在服务器 `/etc/nginx/sites-available/canvas.imihoo.com` 放置站点配置（生产已有，要点如下）：

```nginx
server {
    listen 443 ssl;
    server_name canvas.imihoo.com;

    ssl_certificate     /etc/nginx/ssl/canvas.imihoo.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/canvas.imihoo.com/key.pem;

    root /var/www/canvas.imihoo.com;
    index index.html;

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 运行期配置禁止缓存
    location = /config.js {
        add_header Cache-Control "no-store";
    }

    # 带 hash 的静态资源长缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
}

server {
    listen 80;
    server_name canvas.imihoo.com;
    return 301 https://$host$request_uri;
}
```

启用并检查：

```bash
ln -s /etc/nginx/sites-available/canvas.imihoo.com /etc/nginx/sites-enabled/
nginx -t && nginx -s reload
```

### 4.2 每次发版（本机操作）

```bash
# 1) 构建
cd infinite-canvas/web
bun install
bun run build            # 产物在 web/dist

# 2) 打包（打包 dist 目录内容，不含目录本身）
cd web/dist
zip -r /tmp/canvas-deploy.zip .

# 3) 上传
scp /tmp/canvas-deploy.zip root@114.55.54.9:/tmp/
```

### 4.3 每次发版（服务器操作）

```bash
STAMP=$(date +%Y%m%d_%H%M%S)

# 1) 备份当前线上目录（沿用 /var/www 下时间戳 tar.gz 的习惯）
tar czf /var/www/canvas.imihoo.com_${STAMP}.tar.gz -C /var/www canvas.imihoo.com

# 2) 替换站点目录
rm -rf /var/www/canvas.imihoo.com
mkdir -p /var/www/canvas.imihoo.com
# 注意：该服务器未安装 unzip，用 python3 解压
python3 -c "import zipfile; zipfile.ZipFile('/tmp/canvas-deploy.zip').extractall('/var/www/canvas.imihoo.com')"
rm -f /tmp/canvas-deploy.zip

# 3) 修正属主
chown -R www-data:www-data /var/www/canvas.imihoo.com

# 4) 纯静态发版一般不需要动 nginx；如改过配置再执行
nginx -t && nginx -s reload
```

### 4.4 回滚

```bash
STAMP=20260905_180419   # 换成要回滚的备份时间戳
rm -rf /var/www/canvas.imihoo.com
tar xzf /var/www/canvas.imihoo.com_${STAMP}.tar.gz -C /var/www
chown -R www-data:www-data /var/www/canvas.imihoo.com
```

## 5. 验证部署结果

由于本机公网出口对个别服务器 IP 的 TLS 握手可能不稳定（`curl` 报 `SSL_ERROR_SYSCALL` 时不代表服务器故障），**优先在服务器本机做回环验证**：

```bash
# 1) 首页（HTTP 200，且 index.html 大小与本地 web/dist/index.html 一致）
curl -sk -o /dev/null -w "HTTP %{http_code}  %{size_download}B\n" https://canvas.imihoo.com/

# 2) 首页引用的资源逐一 200（hash 文件名应与本地 web/dist/assets 一致）
for f in $(grep -o 'assets/[^"]*' /var/www/canvas.imihoo.com/index.html); do
  curl -sk -o /dev/null -w "%{http_code}  $f\n" "https://127.0.0.1/$f" -H "Host: canvas.imihoo.com"
done

# 3) 运行期配置
curl -sk -o /dev/null -w "%{http_code}  config.js\n" https://127.0.0.1/config.js -H "Host: canvas.imihoo.com"

# 4) SPA 路由回退：任意前端路由应返回 index.html（含 <title>无限画布</title>）
curl -sk -H "Host: canvas.imihoo.com" https://127.0.0.1/canvas/abc123 | grep -o "<title>[^<]*"

# 5) 内置工作流可下载（/guide 页依赖）
curl -sk -o /dev/null -w "%{http_code}  workflows\n" \
  "https://127.0.0.1/$(ls /var/www/canvas.imihoo.com/workflows/*.json | head -1 | xargs basename)" \
  -H "Host: canvas.imihoo.com"

# 6) 配置合法性
nginx -t
```

全部为 200 且 index.html 引用的 `assets/index-*.js` / `*.css` hash 与本地 `web/dist/assets/` 一致，即部署成功。有公网条件时再从外部访问 `https://canvas.imihoo.com/` 复核一次。

## 6. 注意事项

- 服务器无 `unzip`，解压一律用 `python3 -c "import zipfile; ..."`；也可 `apt install unzip` 后改用 unzip。
- `config.js` 是运行期配置：Docker 部署靠环境变量在容器启动时生成；静态部署如需启用统计，直接改 `/var/www/canvas.imihoo.com/config.js` 中对应 ID 即可（已被配置为 `no-store`，改完即时生效，无需重新构建）。
- `web/dist` 与 `dist.zip` 等产物不进 Git（`.gitignore` 已忽略），每次发版必须重新构建，避免部署到过期产物。
- 发版前保留 `/var/www/<域名>_<时间戳>.tar.gz` 备份是既定习惯，回滚依赖这些备份，清理磁盘时注意保留最近若干份。
