# Nginx 目录与配置说明（生产服务器）

本文档记录生产服务器 `114.55.54.9` 上 nginx 的**真实目录结构、配置文件分工与多站点部署习惯**，作为部署（见根目录 `DEPLOY.md`）时的参照。

- 服务器系统：Ubuntu，nginx **1.24.0 (Ubuntu)**
- 站点全部采用 **多站点（sites-available / sites-enabled）** 模式管理
- 静态站点目录统一为 `/var/www/<域名>/`

## 1. 目录总览

```text
/etc/nginx/
├── nginx.conf                 # 主配置：全局指令 + 事件 + http 块
├── mime.types                 # MIME 类型映射
├── fastcgi.conf / fastcgi_params / scgi_params / uwsgi_params / proxy_params  # 各类上游通用参数
├── modules-available/         # 动态模块（.so），需软链到 modules-enabled 才加载
├── modules-enabled/           # 已启用模块（nginx.conf 通过 modules-enabled/*.conf 引入）
├── conf.d/                    # 全局 http 级配置片段（当前为空）
├── snippets/                  # 可复用配置片段（fastcgi-php.conf、snakeoil.conf）
├── sites-available/           # 所有站点配置（源文件，不生效）
├── sites-enabled/             # 已启用站点（软链 → sites-available，/etc/nginx/sites-enabled/* 被 include）
└── ssl/
    ├── 3dcalc.imihoo.com/     # cert.pem / fullchain.pem / key.pem
    ├── canvas.imihoo.com/     # fullchain.pem / key.pem
    └── umami.imihoo.com/      # fullchain.pem / key.pem

/var/www/
├── canvas.imihoo.com/         # canvas 主应用静态产物（属主 www-data）
├── canvas.imihoo.com_<时间戳>.tar.gz   # 每次发版前的备份
├── 3dcalc.imihoo.com/         # 3dcalc 静态站点
├── 3dcalc.imihoo.com_<时间戳>.tar.gz
├── acme/                      # ACME 证书校验用 webroot
└── html/                      # nginx 默认站点目录
```

## 2. 关键目录职责

| 目录 / 文件 | 作用 | 是否需手工维护 |
| --- | --- | --- |
| `/etc/nginx/nginx.conf` | 主配置，`user www-data`、日志路径、`include conf.d/*.conf` 与 `include sites-enabled/*` | 一般不动 |
| `/etc/nginx/sites-available/` | **站点配置源文件**，写在这里不生效 | 新增站点时写这里 |
| `/etc/nginx/sites-enabled/` | **已启用站点**，软链到 `sites-available`；nginx 实际加载这里 | 启用/停用站点时维护软链 |
| `/etc/nginx/conf.d/` | 全局（http 级）配置片段，对所有站点生效 | 当前为空，一般不用 |
| `/etc/nginx/snippets/` | 可被 `include` 的复用片段 | 按需 |
| `/etc/nginx/ssl/<域名>/` | 该域名的证书，`fullchain.pem`（证书链）+ `key.pem`（私钥，权限 600） | 续期/新增证书时维护 |
| `/var/www/<域名>/` | 站点 web root，属主 `www-data:www-data` | 每次发版替换 |
| `/var/www/<域名>_<时间戳>.tar.gz` | 发版前备份，用于回滚 | 定期清理保留最近若干份 |

## 3. 主配置的 include 关系

`/etc/nginx/nginx.conf` 中与本项目相关的关键行：

```nginx
user www-data;
pid /run/nginx.pid;
error_log /var/log/nginx/error.log;
include /etc/nginx/modules-enabled/*.conf;   # 启用模块

http {
    include /etc/nginx/mime.types;
    access_log /var/log/nginx/access.log;
    include /etc/nginx/conf.d/*.conf;        # 全局 http 片段
    include /etc/nginx/sites-enabled/*;      # ★ 站点配置入口
}
```

> 要点：**只有 `sites-enabled/` 里的配置会生效**，且加载顺序与文件名排序相关；`conf.d/` 是全局层，站点私有配置不要放这里。

## 4. 当前站点清单

| 站点 | 域名 | 类型 | web root / 上游 | 启用软链 |
| --- | --- | --- | --- | --- |
| canvas 主应用 | `canvas.imihoo.com` | 静态 SPA | `/var/www/canvas.imihoo.com` | ✅ |
| 3dcalc | `3dcalc.imihoo.com` | 静态 SPA | `/var/www/3dcalc.imihoo.com` | ✅ |
| umami | `umami.imihoo.com` | 反向代理 | `http://127.0.0.1:3000` | ✅ |
| default | `_` | 默认站点 | `/var/www/html` | ✅ |

`sites-enabled/` 现状（均为软链）：

```text
3dcalc.imihoo.com    -> /etc/nginx/sites-available/3dcalc.imihoo.com
canvas.imihoo.com    -> /etc/nginx/sites-available/canvas.imihoo.com
default              -> /etc/nginx/sites-available/default
umami.imihoo.com     -> /etc/nginx/sites-available/umami.imihoo.com
```

## 5. 静态 SPA 站点配置模板（canvas 为例）

`/etc/nginx/sites-available/canvas.imihoo.com`：

```nginx
server {
    listen 443 ssl;
    server_name canvas.imihoo.com;

    ssl_certificate     /etc/nginx/ssl/canvas.imihoo.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/canvas.imihoo.com/key.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/canvas.imihoo.com;
    index index.html;

    # SPA 路由回退（React/Vue 等前端必须）
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

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
}

# HTTP 强制跳转 HTTPS
server {
    listen 80;
    server_name canvas.imihoo.com;
    return 301 https://$host$request_uri;
}
```

要点：

- **SPA 回退**：`try_files $uri $uri/ /index.html;` 保证前端路由直达不 404。
- **`/config.js` 禁缓存**：运行期配置改了即时生效，不需要重新构建。
- **`/assets/` 长缓存**：文件名带内容 hash，可 `immutable` 缓存一年。
- **HTTP → HTTPS 301**：单独一个 80 端口 server 块。

## 6. 新增一个站点（如官网 `website/`）的标准步骤

```bash
# 1) 建 web root
mkdir -p /var/www/<域名>
# （上传并解压静态产物后）
chown -R www-data:www-data /var/www/<域名>

# 2) 放证书（如已签发）
mkdir -p /etc/nginx/ssl/<域名>
# 将 fullchain.pem / key.pem 放入，key.pem 权限 600

# 3) 写站点配置
vi /etc/nginx/sites-available/<域名>

# 4) 启用（软链到 sites-enabled）
ln -s /etc/nginx/sites-available/<域名> /etc/nginx/sites-enabled/

# 5) 校验并热加载
nginx -t && nginx -s reload
```

> 静态 SPA 直接套用第 5 节模板，替换 `server_name`、证书路径与 `root` 即可。

## 7. 常用运维命令

```bash
nginx -v                      # 版本
nginx -t                      # 校验全部配置语法
nginx -t -c /etc/nginx/nginx.conf
nginx -s reload               # 热加载（改配置后）
systemctl status nginx        # 运行状态
systemctl reload nginx        # 等价热加载
systemctl restart nginx       # 重启（一般不用）
ls -l /etc/nginx/sites-enabled/   # 查看已启用站点及其软链指向
tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

## 8. 注意事项

- **只有 `sites-enabled/` 生效**：编辑 `sites-available/` 后若没软链或没 `reload`，不会生效。
- **证书私钥权限**：`key.pem` 应为 `600 root:root`；`fullchain.pem` 可读。
- **属主**：静态站点目录属主必须为 `www-data`，否则可能 403。
- **备份习惯**：发版前在 `/var/www/` 生成 `<域名>_<YYYYMMDD_HHMMSS>.tar.gz`，回滚依赖这些备份，清理磁盘时保留最近若干份。
- **改动前先 `nginx -t`**：配置有误时 `reload` 会失败，先校验再加载。
- 该服务器**未安装 `unzip`**，解压 zip 用 `python3 -c "import zipfile; ..."`（见 `DEPLOY.md`）。
