import React, { useEffect, useState } from 'react';

interface LaunchOfferProps {
  t: (key: string) => string;
  onToast: (msg: string) => void;
  lang: string;
}

const COMMANDS = {
  bun: `# 克隆仓库并进入 web 目录
git clone git@github.com:ZhuYichuan/infinite-canvas.git
cd infinite-canvas/web

# 安装依赖并启动本地开发 (支持实时 HMR)
bun install
bun run dev

# 访问 http://localhost:3000`,

  docker: `# Docker Compose 一键启动
git clone git@github.com:ZhuYichuan/infinite-canvas.git
cd infinite-canvas

# 运行前端容器 (端口 3000)
docker compose up -d`,

  prereq: `# 1. 确保本地 ComfyUI (8188) 放通跨域:
python main.py --listen 127.0.0.1 --port 8188 --enable-cors-header

# 2. 安装 5 大核心依赖插件到 ComfyUI/custom_nodes:
# - Comfyui-kktools
# - ComfyUI-KJNodes
# - ComfyLiterals
# - ComfyUI-UniversalToolkit
# - ComfyUI_LayerStyle`,
};

export const LaunchOffer: React.FC<LaunchOfferProps> = ({ t, onToast, lang }) => {
  const [activeTab, setActiveTab] = useState<'bun' | 'docker' | 'prereq'>('bun');
  const [countdown, setCountdown] = useState('6天 11小时 45分 00秒');

  useEffect(() => {
    const target = new Date();
    target.setDate(target.getDate() + 6);
    target.setHours(target.getHours() + 11);

    const timer = setInterval(() => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('00:00:00');
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);

      setCountdown(
        lang === 'zh-CN' ? `${d}天 ${h}小时 ${m}分 ${s}秒` : `${d}d ${h}h ${m}m ${s}s`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [lang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(COMMANDS[activeTab]).then(() => {
      onToast(lang === 'zh-CN' ? '已复制命令到剪贴板！' : 'Copied command to clipboard!');
    });
  };

  return (
    <section id="launch-offer" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider block mb-2">
          {t('launch_eyebrow')}
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">
          {t('launch_title_line1')}
          <br />
          <span>{t('launch_title_line2')}</span>
        </h2>
        <p className="text-sm text-zinc-400">{t('launch_desc')}</p>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-500 font-mono">
          <span>{t('launch_platform')}</span>
        </div>
      </div>

      {/* Launch Offer Card (TinyKPI Style) */}
      <div className="max-w-md mx-auto rounded-3xl bg-[#121217] border border-white/10 p-8 text-center shadow-2xl relative overflow-hidden mb-12">
        <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block mb-4">
          {t('launch_card_offer')}
        </span>

        {/* Giant Price */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="text-5xl font-extrabold text-white flex items-baseline">
            <span className="text-3xl font-normal text-zinc-400 mr-1">$</span>0
          </div>
          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-emerald-400 pulse-subtle" />
          </div>
        </div>

        <div className="text-xs text-zinc-500 mb-6 line-through">{t('launch_regular_price')}</div>
        <p className="text-xs text-zinc-400 mb-6 font-mono">{t('launch_payment')}</p>

        {/* Primary Download/Clone Button */}
        <a
          href="https://github.com/ZhuYichuan/infinite-canvas"
          target="_blank"
          rel="noreferrer"
          className="w-full py-3 rounded-full bg-white text-zinc-950 font-semibold text-xs sm:text-sm hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 mb-4"
        >
          <span>{t('launch_btn')}</span>
        </a>

        <p className="text-[11px] text-zinc-500 mb-6">{t('launch_license_info')}</p>

        {/* Countdown */}
        <div className="pt-6 border-t border-white/5">
          <span className="text-[11px] text-zinc-500 block mb-1">{t('launch_ends_in')}</span>
          <div className="text-xs font-mono text-sky-400 font-semibold">{countdown}</div>
        </div>
      </div>

      {/* Terminal Command Quickstart Tabs */}
      <div className="max-w-3xl mx-auto rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-950/60">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('bun')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'bun'
                  ? 'bg-white/10 text-white border border-sky-400/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Bun 源码启动
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('docker')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'docker'
                  ? 'bg-white/10 text-white border border-sky-400/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Docker Compose
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('prereq')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'prereq'
                  ? 'bg-white/10 text-white border border-sky-400/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              运行前置环境
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>复制代码</span>
          </button>
        </div>

        <div className="p-5 bg-black/85 font-mono text-xs text-sky-200 leading-relaxed overflow-x-auto">
          <pre>{COMMANDS[activeTab]}</pre>
        </div>
      </div>
    </section>
  );
};
