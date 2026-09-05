import { useEffect, useRef } from "react";
import { App } from "antd";
import copy from "copy-to-clipboard";
import { Copy, ShieldAlert } from "lucide-react";

export function useComfyuiMixedContentListener() {
    const { modal, message } = App.useApp();
    const isShowingRef = useRef(false);

    useEffect(() => {
        const handler = (event: Event) => {
            if (isShowingRef.current) return;
            const customEvent = event as CustomEvent<{ url?: string }>;
            const url = customEvent.detail?.url || "http://127.0.0.1:8188";
            isShowingRef.current = true;

            const corsCmd = `python main.py --listen 127.0.0.1 --port 8188 --enable-cors-header "*"`;

            modal.warning({
                title: "浏览器安全策略拦截了本地连接",
                icon: <ShieldAlert className="size-5 text-amber-500" />,
                width: 540,
                content: (
                    <div className="mt-3 space-y-3.5 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                        <p>
                            当前页面运行在 <strong>HTTPS</strong> 安全模式下，浏览器安全机制默认会<strong>阻止向本地明文 HTTP 服务</strong>（<code>{url}</code>）发起的请求（混合内容保护与私有网络限制）。
                        </p>
                        <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30">
                            <div className="font-semibold text-amber-900 dark:text-amber-200">
                                解决步骤（只需配置一次，永久生效）：
                            </div>
                            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-stone-700 dark:text-stone-300">
                                <li>
                                    点击浏览器地址栏最左侧的 <strong>「锁头」图标</strong>（或站点设置/调整图标）；
                                </li>
                                <li>
                                    点击 <strong>「网站设置」</strong>（Microsoft Edge 浏览器中为 <strong>「此站点的权限」</strong>）；
                                </li>
                                <li>
                                    在权限列表中找到 <strong>「不安全内容」</strong>（Insecure content），将其从“阻止 (默认)”修改为 <strong>「允许」</strong>；
                                </li>
                                <li>
                                    配置完成后返回当前页面，点击下方<strong>「刷新页面」</strong>即可正常连接。
                                </li>
                            </ol>
                        </div>
                        <div className="rounded-md border border-stone-200 bg-stone-50 p-2.5 dark:border-stone-800 dark:bg-stone-900">
                            <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                                <span>同时请确保本地 ComfyUI 启动时允许跨域 (CORS)：</span>
                                <button
                                    type="button"
                                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                    onClick={() => {
                                        copy(corsCmd);
                                        message.success("启动命令已复制");
                                    }}
                                >
                                    <Copy className="size-3" />
                                    复制命令
                                </button>
                            </div>
                            <code className="mt-1 block overflow-x-auto rounded bg-white p-1.5 font-mono text-[11px] text-stone-800 dark:bg-stone-950 dark:text-stone-200">
                                {corsCmd}
                            </code>
                        </div>
                    </div>
                ),
                okText: "刷新页面",
                cancelText: "我知道了",
                okCancel: true,
                onOk: () => {
                    isShowingRef.current = false;
                    window.location.reload();
                },
                onCancel: () => {
                    isShowingRef.current = false;
                },
            });
        };

        window.addEventListener("comfyui:mixed-content-blocked", handler);
        return () => {
            window.removeEventListener("comfyui:mixed-content-blocked", handler);
        };
    }, [message, modal]);
}
