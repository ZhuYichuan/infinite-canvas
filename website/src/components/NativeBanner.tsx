import React from 'react';

interface NativeBannerProps {
  t: (key: string) => string;
}

export const NativeBanner: React.FC<NativeBannerProps> = ({ t }) => {
  return (
    <section className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <svg className="w-6 h-6 text-zinc-400 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M20 9a8 8 0 0 0-14-3L3 9m0-6v6h6M4 15a8 8 0 0 0 14 3l3-3m0 6v-6h-6" />
          </svg>
          <h2 className="text-base font-bold text-white mb-1">{t('prop1_title')}</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{t('prop1_desc')}</p>
        </div>
        <div>
          <svg className="w-6 h-6 text-zinc-400 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="5" y="10" width="14" height="11" rx="3" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
          </svg>
          <h2 className="text-base font-bold text-white mb-1">{t('prop2_title')}</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{t('prop2_desc')}</p>
        </div>
        <div>
          <svg className="w-6 h-6 text-zinc-400 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M3 9h18M9 9v12" />
          </svg>
          <h2 className="text-base font-bold text-white mb-1">{t('prop3_title')}</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{t('prop3_desc')}</p>
        </div>
      </div>
    </section>
  );
};
