import React, { useState } from 'react';
import type { LayoutTileItem } from '../types';

interface LayoutGridProps {
  t: (key: string) => string;
  onToast: (msg: string) => void;
}

const DEFAULT_TILES: LayoutTileItem[] = [
  { id: '1', title: '提示词生成器 (Prompt Editor)', desc: 'A little more room. Or a little less.', metaSlot: '_meta.title = "prompt"', colSpan: 2, rowSpan: 2 },
  { id: '2', title: '随机种子 (Seed)', colSpan: 1, rowSpan: 1 },
  { id: '3', title: '局部重绘遮罩', desc: 'LayerStyle 合成', colSpan: 1, rowSpan: 2 },
  { id: '4', title: '采样步数 (Steps: 20)', colSpan: 1, rowSpan: 1 },
  { id: '5', title: 'LoRA 权重调节器', metaSlot: 'Weight: 0.85', colSpan: 2, rowSpan: 1 },
  { id: '6', title: '视频尺寸: 16:9', desc: '0.98 MP 硬件锁死', colSpan: 1, rowSpan: 1 },
];

export const LayoutGrid: React.FC<LayoutGridProps> = ({ t, onToast }) => {
  const [tiles, setTiles] = useState<LayoutTileItem[]>(DEFAULT_TILES);

  const handleToggleWidth = (id: string) => {
    setTiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, colSpan: item.colSpan === 1 ? 2 : 1 } : item))
    );
  };

  const handleToggleHeight = (id: string) => {
    setTiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, rowSpan: item.rowSpan === 1 ? 2 : 1 } : item))
    );
  };

  const handleRemove = (id: string) => {
    setTiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleReset = () => {
    setTiles(DEFAULT_TILES);
    onToast('画布网格已重置');
  };

  const handleAdd = () => {
    const nextId = String(Date.now());
    const newItem: LayoutTileItem = {
      id: nextId,
      title: '自定义参数节点',
      desc: '动态挂载至 ComfyUI 8188 槽位',
      colSpan: 1,
      rowSpan: 1,
    };
    setTiles((prev) => [...prev, newItem]);
    onToast('已添加新节点卡片');
  };

  return (
    <section id="layout-demo" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider block mb-2">
            {t('layout_eyebrow')}
          </span>
          <h3 className="text-3xl font-extrabold text-white">{t('layout_title')}</h3>
          <p className="text-sm text-zinc-400 mt-2">{t('layout_desc')}</p>
        </div>
        <span className="text-xs text-sky-400 font-mono flex items-center gap-1.5">
          <span>{t('layout_hint')}</span>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </div>

      <div className="rounded-2xl bg-[#0c0c10] border border-white/10 overflow-hidden shadow-2xl p-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6 text-xs text-zinc-400">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <strong>Your canvas layout</strong>
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 9a8 8 0 0 0-14-3L3 9m0-6v6h6M4 15a8 8 0 0 0 14 3l3-3m0 6v-6h-6" />
            </svg>
            <span>{t('layout_reset')}</span>
          </button>
        </div>

        {/* Grid Container */}
        <div className="layout-grid-stage">
          {tiles.map((tile) => (
            <div
              key={tile.id}
              className={`layout-tile ${tile.colSpan === 2 ? 'col-span-2' : 'col-span-1'} ${
                tile.rowSpan === 2 ? 'row-span-2' : 'row-span-1'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs text-zinc-300 font-semibold mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    {tile.title}
                  </span>
                  {tile.metaSlot && <span className="text-[10px] font-mono text-sky-300">{tile.metaSlot}</span>}
                </div>
                {tile.desc && <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">{tile.desc}</p>}
              </div>

              {/* Action Toolbar */}
              <div className="tile-toolbar">
                <button
                  type="button"
                  onClick={() => handleRemove(tile.id)}
                  className="tile-btn cursor-pointer"
                  title="删除卡片"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleWidth(tile.id)}
                  className="tile-btn cursor-pointer"
                  title="改变宽度"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3m8-18h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
                  </svg>
                </button>

                <span className="text-[10px] font-mono text-zinc-500">
                  {tile.colSpan} × {tile.rowSpan}
                </span>

                <button
                  type="button"
                  onClick={() => handleToggleHeight(tile.id)}
                  className="tile-btn cursor-pointer"
                  title="改变高度"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3m-18 8v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Add Card */}
        <div className="mt-6 flex items-center justify-between text-xs text-zinc-500">
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{t('layout_add')}</span>
          </button>
          <span>{t('layout_footer_hint')}</span>
        </div>
      </div>
    </section>
  );
};
