import React, { useState } from 'react';

interface FooterProps {
  t: (key: string) => string;
  onToast: (msg: string) => void;
  lang: string;
}

export const Footer: React.FC<FooterProps> = ({ t, onToast, lang }) => {
  const [rotated, setRotated] = useState(false);
  const [reply, setReply] = useState<string | null>(null);

  const handleCheckAgain = () => {
    setRotated(true);
    setTimeout(() => setRotated(false), 400);
    setReply(lang === 'zh-CN' ? '纯粹为了激发艺术灵感。' : 'Strictly for research.');
    onToast(lang === 'zh-CN' ? '正在检查 127.0.0.1:8188 队列...' : 'Checking 127.0.0.1:8188 queue...');
  };

  return (
    <footer className="py-20 border-t border-white/10 bg-[#07070a] text-zinc-400 text-xs">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Quote Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-12 mb-12 border-b border-white/5">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">
              {t('footer_quote_line1')}
              <br />
              <span className="text-zinc-500 font-normal">{t('footer_quote_line2')}</span>
            </h2>
            <p className="text-zinc-500">{t('footer_quote_sub')}</p>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <button
              type="button"
              onClick={handleCheckAgain}
              className="px-4 py-2 rounded-full bg-zinc-900 border border-white/10 hover:border-white/20 text-white font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <svg
                className={`w-3.5 h-3.5 text-sky-400 transition-transform ${rotated ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M16.4 7A7 7 0 0 0 4.2 4.8L2.8 6.3m0-4.2v4.2H7M3.6 13a7 7 0 0 0 12.2 2.2l1.4-1.5m0 4.2v-4.2H13" />
              </svg>
              <span>{t('footer_check_btn')}</span>
            </button>
            <span className="text-zinc-500 text-[11px]">{reply || t('footer_reply')}</span>
          </div>
        </div>

        {/* Base Links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="logo" className="w-5 h-5" />
            <span className="text-white font-semibold">comfyui 画布</span>
            <span className="text-zinc-600">© 2026 Open Source Project</span>
          </div>

          <nav className="flex items-center gap-6">
            <a href="#features" className="hover:text-white transition-colors">{t('nav_features')}</a>
            <a href="#ecosystem" className="hover:text-white transition-colors">{t('nav_workflows')}</a>
            <a href="#privacy" className="hover:text-white transition-colors">{t('nav_security')}</a>
            <a href="#launch-offer" className="hover:text-white transition-colors">{t('nav_quickstart')}</a>
            <a href="#faq" className="hover:text-white transition-colors">{t('nav_faq')}</a>
          </nav>
        </div>
      </div>
    </footer>
  );
};
