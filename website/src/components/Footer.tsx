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
    <footer className="py-20 border-t border-black/[0.08] bg-[#fbfbfd] text-[#6e6e73] text-xs">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Quote Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-12 mb-12 border-b border-black/[0.06]">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#111113] mb-1">
              {t('footer_quote_line1')}
              <br />
              <span className="text-[#6e6e73] font-normal">{t('footer_quote_line2')}</span>
            </h2>
            <p className="text-[#86868b]">{t('footer_quote_sub')}</p>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <button
              type="button"
              onClick={handleCheckAgain}
              className="px-4 py-2 rounded-full bg-white border border-black/[0.12] hover:border-black/[0.22] text-[#1d1d1f] font-medium shadow-sm hover:shadow flex items-center gap-2 transition-all cursor-pointer"
            >
              <svg
                className={`w-3.5 h-3.5 text-[#0071e3] transition-transform ${rotated ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M16.4 7A7 7 0 0 0 4.2 4.8L2.8 6.3m0-4.2v4.2H7M3.6 13a7 7 0 0 0 12.2 2.2l1.4-1.5m0 4.2v-4.2H13" />
              </svg>
              <span>{t('footer_check_btn')}</span>
            </button>
            <span className="text-[#86868b] text-[11px] font-mono">{reply || t('footer_reply')}</span>
          </div>
        </div>

        {/* Base Links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="logo" className="w-5 h-5" />
            <span className="text-[#111113] font-semibold text-sm">无限画布</span>
            <span className="text-[#86868b]">© 2026 开源项目 · MIT License</span>
          </div>

          <nav className="flex items-center flex-wrap justify-center gap-5 sm:gap-6 text-xs font-medium">
            <a href="#features" className="text-[#6e6e73] hover:text-[#111113] transition-colors">{t('nav_features')}</a>
            <a href="#ecosystem" className="text-[#6e6e73] hover:text-[#111113] transition-colors">{t('nav_workflows')}</a>
            <a href="#layout-demo" className="text-[#6e6e73] hover:text-[#111113] transition-colors">{t('nav_demo')}</a>
            <a href="#privacy" className="text-[#6e6e73] hover:text-[#111113] transition-colors">{t('nav_security')}</a>
            <a href="#launch-offer" className="text-[#6e6e73] hover:text-[#111113] transition-colors">{t('nav_quickstart')}</a>
            <a href="#faq" className="text-[#6e6e73] hover:text-[#111113] transition-colors">{t('nav_faq')}</a>
          </nav>

          <a href="#overview" className="text-xs text-[#6e6e73] hover:text-[#111113] transition-colors flex items-center gap-1 font-medium">
            <span>回到顶部</span>
            <span>↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
