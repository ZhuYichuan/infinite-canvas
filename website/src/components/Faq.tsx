import React from 'react';

interface FaqProps {
  t: (key: string) => string;
}

const FAQS = [
  {
    q: '我需要启动本地 ComfyUI 才能使用吗？',
    a: '是的。无限画布是专为 ComfyUI 设计的现代化可视化前端，通过 WebSocket 与 REST API 直连本地 127.0.0.1:8188 端口。运行前请先启动本地或局域网 ComfyUI。',
  },
  {
    q: '为什么不需要后端服务？生成图片与工程存放在哪里？',
    a: '全站采用纯前端架构，画布节点拓扑、历史记录及偏好设置均保存在本地浏览器 IndexedDB (localforage) 中。生成的图片保存在 ComfyUI 根目录的 output 文件夹中，数据不出本机。',
  },
  {
    q: '直连报 CORS 跨域错误怎么处理？',
    a: '启动 ComfyUI 时请加入 --enable-cors-header 启动参数（如 python main.py --listen 127.0.0.1 --port 8188 --enable-cors-header），或通过 Nginx 反向代理放通请求头。',
  },
  {
    q: '全能参考视频 (MiniMax H3) 支持连多少张参考资源？',
    a: '最多支持 9 张参考图 + 3 段视频 + 3 段音频。系统在提交任务前会自动抹除未连满的插槽并校验硬件规格，视频生成尺寸锁定在 0.2M~0.98M 之间。',
  },
  {
    q: '需要安装哪些 ComfyUI 核心依赖插件？',
    a: '推荐安装 5 大核心插件：Comfyui-kktools（文本反推）、ComfyUI-KJNodes（视频组件）、ComfyLiterals（字面量常数）、ComfyUI-UniversalToolkit（参数解析）与 ComfyUI_LayerStyle（图层与遮罩）。',
  },
];

export const Faq: React.FC<FaqProps> = ({ t }) => {
  return (
    <section id="faq" className="py-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <span className="text-xs font-mono text-[#86868b] uppercase tracking-wider block mb-2">
          {t('faq_eyebrow')}
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111113] tracking-tight">{t('faq_title')}</h2>
      </div>

      <div className="space-y-3.5 text-xs sm:text-sm">
        {FAQS.map((item, index) => (
          <details
            key={index}
            className="group rounded-2xl bg-white border border-black/[0.08] hover:border-black/[0.16] shadow-sm p-5 transition-all [&_svg]:open:rotate-45"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 font-semibold text-sm sm:text-base text-[#1d1d1f] list-none select-none">
              <span>{item.q}</span>
              <span className="w-6 h-6 rounded-full bg-zinc-100 group-hover:bg-zinc-200 flex items-center justify-center shrink-0 text-[#6e6e73] transition-colors">
                <svg
                  className="h-3.5 w-3.5 transition-transform duration-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
            </summary>
            <p className="mt-3 text-xs sm:text-sm text-[#6e6e73] leading-relaxed pt-3 border-t border-black/[0.05]">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
};
