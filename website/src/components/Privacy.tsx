import React from 'react';

interface PrivacyProps {
  t: (key: string) => string;
}

export const Privacy: React.FC<PrivacyProps> = ({ t }) => {
  return (
    <section id="privacy" className="py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      {/* Padlock Illustration */}
      <svg className="w-12 h-14 mx-auto mb-6" viewBox="0 0 48 56" fill="none">
        <path d="M14 25V16a10 10 0 0 1 20 0v9" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
        <rect x="7.5" y="23.5" width="33" height="27" rx="8" fill="#141419" stroke="#27272a" strokeWidth="1.5" />
        <circle cx="24" cy="35" r="3" fill="#38bdf8" />
        <path d="M24 38v4" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider block mb-2">
        {t('privacy_eyebrow')}
      </span>
      <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 leading-tight">
        {t('privacy_title_line1')}
        <br />
        <span>{t('privacy_title_line2')}</span>
      </h2>
      <p className="text-xs font-semibold text-emerald-400 mb-6">{t('privacy_badge')}</p>
      <p className="text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">{t('privacy_desc')}</p>
    </section>
  );
};
