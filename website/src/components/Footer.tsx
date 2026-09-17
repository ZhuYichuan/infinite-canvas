import React from 'react';

interface FooterProps {
  t: (key: string) => string;
}

export const Footer: React.FC<FooterProps> = ({ t }) => {
  return (
    <footer className="py-20 border-t border-black/[0.08] bg-[#fbfbfd] text-[#6e6e73] text-xs">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Quote Section */}
        <div className="pb-12 mb-12 border-b border-black/[0.06]">
          <h2 className="text-xl sm:text-2xl font-bold text-[#111113] mb-1">
            {t('footer_quote_line1')}
            <br />
            <span className="text-[#6e6e73] font-normal">{t('footer_quote_line2')}</span>
          </h2>
          <p className="text-[#86868b]">{t('footer_quote_sub')}</p>
        </div>

        {/* Base Links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="logo" className="w-5 h-5" />
            <span className="text-[#111113] font-semibold text-sm">无限画布</span>
            <span className="text-[#86868b]">{t('footer_copyright')}</span>
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
            <span>{t('nav_back_to_top')}</span>
            <span>↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
