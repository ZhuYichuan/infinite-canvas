import React from 'react';
import { Workflow, Network, Layers } from 'lucide-react';

interface NativeBannerProps {
  t: (key: string) => string;
}

export const NativeBanner: React.FC<NativeBannerProps> = ({ t }) => {
  return (
    <section className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
        <div>
          <Workflow className="w-6 h-6 text-[#1d1d1f] mb-4 stroke-[1.6]" />
          <h2 className="text-base font-bold text-[#111113] mb-1">{t('prop1_title')}</h2>
          <p className="text-sm text-[#6e6e73] leading-relaxed">{t('prop1_desc')}</p>
        </div>
        <div>
          <Network className="w-6 h-6 text-[#1d1d1f] mb-4 stroke-[1.6]" />
          <h2 className="text-base font-bold text-[#111113] mb-1">{t('prop2_title')}</h2>
          <p className="text-sm text-[#6e6e73] leading-relaxed">{t('prop2_desc')}</p>
        </div>
        <div>
          <Layers className="w-6 h-6 text-[#1d1d1f] mb-4 stroke-[1.6]" />
          <h2 className="text-base font-bold text-[#111113] mb-1">{t('prop3_title')}</h2>
          <p className="text-sm text-[#6e6e73] leading-relaxed">{t('prop3_desc')}</p>
        </div>
      </div>
    </section>
  );
};
