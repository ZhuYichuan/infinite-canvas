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

            modal.info({
                title: "本地服务连接排查",
                icon: <ShieldAlert className="size-5 text-amber-500" />,
                width: 540,
                content: (
                    <div className="mt-3 space-y-3.5 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                        <p>服务地址：<code>{url}</code>。连接失败可能来自服务未启动、地址错误、跨域配置或浏览器权限，请按实际错误排查。</p>
                        <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30">
                            <div className="font-semibold text-amber-900 dark:text-amber-200">
                                建议检查：
                            </div>
                            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-stone-700 dark:text-stone-300">
                                <li>
                                    确认 ComfyUI 已启动，渠道中的主机地址与端口正确，并可在当前设备的浏览器中打开。
                                </li>
                                <li>
                                    确认 ComfyUI 已启用跨域 (CORS)，下方命令适用于当前设备上的默认端口服务。
                                </li>
                                <li>
                                    如果浏览器提示本地网络访问被拒绝，在地址栏左侧的站点设置中检查<strong>「本地网络访问」</strong>权限；不同浏览器的名称和支持情况可能不同。
                                </li>
                                <li>
                                    如果 HTTPS 页面连接 HTTP 服务时，浏览器明确报告混合内容被阻止，可在当前站点权限中检查<strong>「不安全内容」</strong>设置。仅凭连接失败无法判断是浏览器拦截。
                                </li>
                            </ol>
                        </div>
                        <div className="rounded-md border border-stone-200 bg-stone-50 p-2.5 dark:border-stone-800 dark:bg-stone-900">
                            <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                                <span>本机默认端口启动示例（允许跨域）：</span>
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
