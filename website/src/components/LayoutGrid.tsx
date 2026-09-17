import React, { useCallback, useEffect, useRef, useState } from 'react';

interface LayoutGridProps {
  t: (key: string) => string;
  onToast: (msg: string) => void;
  lang?: string;
}

interface DemoNode {
  id: string;
  type: 'prompt' | 'reference' | 'config' | 'result';
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  promptText?: string;
  workflow?: string;
  steps?: number;
  seed?: number;
  size?: string;
  vram?: string;
  presetIndex?: number;
}

interface DemoConnection {
  id: string;
  fromId: string;
  toId: string;
}

const ARTWORK_PRESETS = [
  {
    title: '赛博朋克雨夜街道',
    tag: 'Z-Image-Turbo · 0.8s',
    gradient: 'from-blue-950 via-purple-950 to-indigo-900',
    detail: '超写实 8K 渲染 · 丁达尔体积光 · 电影感景深',
    accentColor: '#38bdf8',
  },
  {
    title: '黄金时刻人像摄影',
    tag: 'Flux2.Dev · 1.9s',
    gradient: 'from-amber-950 via-rose-950 to-stone-900',
    detail: '夕阳轮廓光 · 胶片颗粒 · 浅景深焦外虚化',
    accentColor: '#fbbf24',
  },
  {
    title: '深海沉没古城遗迹',
    tag: 'MiniMax H3 · 24fps',
    gradient: 'from-teal-950 via-cyan-950 to-slate-900',
    detail: '发光生物微粒 · 水下焦散光斑 · 动态气泡流',
    accentColor: '#34d399',
  },
];

const INITIAL_NODES: DemoNode[] = [
  {
    id: 'node-prompt',
    type: 'prompt',
    title: '提示词节点 (Prompt)',
    x: 40,
    y: 70,
    width: 250,
    height: 190,
    promptText: '赛博朋克霓虹雨夜街道，倒影积水，超写实 8K 质感，电影感景深。',
  },
  {
    id: 'node-ref',
    type: 'reference',
    title: '参考图节点 (ref_image_01)',
    x: 40,
    y: 290,
    width: 250,
    height: 170,
    size: '1088 × 1920',
  },
  {
    id: 'node-config',
    type: 'config',
    title: 'ComfyUI 调度中枢',
    x: 350,
    y: 120,
    width: 290,
    height: 310,
    workflow: 'Z-Image-Turbo 极速文生图',
    steps: 8,
    seed: 928104812,
    size: '16:9 · 0.98 MP',
  },
  {
    id: 'node-result',
    type: 'result',
    title: '实时渲染输出 (Output)',
    x: 700,
    y: 80,
    width: 280,
    height: 350,
    presetIndex: 0,
    vram: '6.4 GB',
  },
];

const INITIAL_CONNECTIONS: DemoConnection[] = [
  { id: 'c1', fromId: 'node-prompt', toId: 'node-config' },
  { id: 'c2', fromId: 'node-ref', toId: 'node-config' },
  { id: 'c3', fromId: 'node-config', toId: 'node-result' },
];

export const LayoutGrid: React.FC<LayoutGridProps> = ({ t, onToast }) => {
  const [nodes, setNodes] = useState<DemoNode[]>(INITIAL_NODES);
  const [connections, setConnections] = useState<DemoConnection[]>(INITIAL_CONNECTIONS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-config');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    type: 'node' | 'pan';
    nodeId?: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  // Dragging handling
  const handlePointerDownCanvas = (e: React.PointerEvent) => {
    // Only pan if target is canvas background or svg
    const target = e.target as HTMLElement;
    if (target.closest('.canvas-node-card') || target.closest('.canvas-toolbar')) return;

    setSelectedNodeId(null);
    dragRef.current = {
      type: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      initialX: pan.x,
      initialY: pan.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerDownNode = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    dragRef.current = {
      type: 'node',
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      initialX: node.x,
      initialY: node.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;

    const dx = (e.clientX - dragRef.current.startX) / zoom;
    const dy = (e.clientY - dragRef.current.startY) / zoom;

    if (dragRef.current.type === 'node' && dragRef.current.nodeId) {
      const targetId = dragRef.current.nodeId;
      setNodes((prev) =>
        prev.map((item) =>
          item.id === targetId
            ? {
                ...item,
                x: Math.round(dragRef.current!.initialX + dx),
                y: Math.round(dragRef.current!.initialY + dy),
              }
            : item
        )
      );
    } else if (dragRef.current.type === 'pan') {
      setPan({
        x: Math.round(dragRef.current.initialX + (e.clientX - dragRef.current.startX)),
        y: Math.round(dragRef.current.initialY + (e.clientY - dragRef.current.startY)),
      });
    }
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  // Run generation demo
  const handleRunGenerate = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerateProgress(10);
    onToast('🚀 正在向 127.0.0.1:8188 提交执行任务...');

    const interval = setInterval(() => {
      setGenerateProgress((p) => {
        if (p >= 90) {
          clearInterval(interval);
          return 90;
        }
        return p + 25;
      });
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      setGenerateProgress(100);
      setTimeout(() => {
        setIsGenerating(false);
        setGenerateProgress(0);
        // Cycle result artwork preset
        setNodes((prev) =>
          prev.map((n) =>
            n.id === 'node-result'
              ? { ...n, presetIndex: ((n.presetIndex || 0) + 1) % ARTWORK_PRESETS.length }
              : n
          )
        );
        onToast('✨ ComfyUI 执行完成！耗时 0.8s，产物已就绪');
      }, 300);
    }, 1100);
  };

  // Reset layout
  const handleResetLayout = () => {
    setNodes(INITIAL_NODES);
    setConnections(INITIAL_CONNECTIONS);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    onToast('画布视口与节点已重置');
  };

  // Add a new node
  const handleAddPromptNode = () => {
    const nextId = `node-prompt-${Date.now()}`;
    const newNode: DemoNode = {
      id: nextId,
      type: 'prompt',
      title: '提示词节点 (Prompt)',
      x: 80 + Math.random() * 40,
      y: 120 + Math.random() * 50,
      width: 250,
      height: 180,
      promptText: '超逼真水下光斑，浮游荧光水母，极简摄影风格。',
    };
    setNodes((prev) => [...prev, newNode]);
    setConnections((prev) => [...prev, { id: `c-${Date.now()}`, fromId: nextId, toId: 'node-config' }]);
    onToast('已添加新提示词节点并自动连线');
  };

  const handleAddRefNode = () => {
    const nextId = `node-ref-${Date.now()}`;
    const newNode: DemoNode = {
      id: nextId,
      type: 'reference',
      title: '参考图节点 (ref_mask)',
      x: 80 + Math.random() * 40,
      y: 260 + Math.random() * 50,
      width: 250,
      height: 170,
      size: 'LayerStyle 遮罩层',
    };
    setNodes((prev) => [...prev, newNode]);
    setConnections((prev) => [...prev, { id: `c-${Date.now()}`, fromId: nextId, toId: 'node-config' }]);
    onToast('已添加新遮罩参考节点并接入中枢');
  };

  // Calculate Bezier path between two nodes
  const getPathD = useCallback(
    (fromNode: DemoNode, toNode: DemoNode) => {
      const startX = fromNode.x + fromNode.width;
      const startY = fromNode.y + fromNode.height / 2;
      const endX = toNode.x;
      const endY = toNode.y + toNode.height / 2;

      const dx = Math.abs(endX - startX);
      const curvature = Math.max(dx * 0.5, 45);

      return `M ${startX} ${startY} C ${startX + curvature} ${startY}, ${endX - curvature} ${endY}, ${endX} ${endY}`;
    },
    []
  );

  const resultNode = nodes.find((n) => n.id === 'node-result');
  const currentArtwork = ARTWORK_PRESETS[resultNode?.presetIndex || 0];

  return (
    <section id="layout-demo" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <span className="text-xs font-mono text-[#86868b] uppercase tracking-wider block mb-2">
            {t('layout_eyebrow')}
          </span>
          <h3 className="text-3xl font-extrabold text-[#111113]">{t('layout_title')}</h3>
          <p className="text-sm text-[#6e6e73] mt-2">{t('layout_desc')}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#0071e3] font-mono font-medium">
          <span className="w-2 h-2 rounded-full bg-[#0071e3] animate-pulse" />
          <span>自由拖拽节点 · 贝塞尔曲线实时跟随 · 支持缩放与生成</span>
        </div>
      </div>

      {/* Main Interactive Canvas Stage */}
      <div className="rounded-2xl bg-[#09090e] border border-white/10 overflow-hidden shadow-2xl relative select-none">
        {/* Canvas Top Bar (Flat, minimalist per AGENTS.md) */}
        <div className="h-11 px-4 bg-zinc-950/80 border-b border-white/10 flex items-center justify-between text-xs text-zinc-400 z-30 relative backdrop-blur-md">
          {/* Left Canvas Brand & Quick Add */}
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <span>无限画布工作台</span>
            </span>

            <div className="h-4 w-px bg-white/10 mx-1" />

            <button
              type="button"
              onClick={handleAddPromptNode}
              className="px-2.5 py-1 rounded-md text-zinc-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1 cursor-pointer text-[11px]"
            >
              <span>＋ 提示词</span>
            </button>
            <button
              type="button"
              onClick={handleAddRefNode}
              className="px-2.5 py-1 rounded-md text-zinc-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1 cursor-pointer text-[11px]"
            >
              <span>＋ 参考图</span>
            </button>
          </div>

          {/* Right Controls: Zoom & Reset */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/5 rounded-md border border-white/10 p-0.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
                className="w-6 h-6 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="缩小"
              >
                －
              </button>
              <span className="px-2 text-[10px] font-mono text-zinc-300">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.3, z + 0.1))}
                className="w-6 h-6 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="放大"
              >
                ＋
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetLayout}
              className="px-2.5 py-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1 cursor-pointer text-[11px]"
              title="重置画布布局"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 9a8 8 0 0 0-14-3L3 9m0-6v6h6M4 15a8 8 0 0 0 14 3l3-3m0 6v-6h-6" />
              </svg>
              <span>重置</span>
            </button>
          </div>
        </div>

        {/* Viewport & Dragging Canvas Area */}
        <div
          ref={canvasRef}
          onPointerDown={handlePointerDownCanvas}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative h-[530px] w-full overflow-hidden cursor-grab active:cursor-grabbing bg-[#08080c]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255, 255, 255, 0.08) 1.2px, transparent 1.2px)',
            backgroundSize: '24px 24px',
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          {/* Transformable Canvas Content */}
          <div
            className="absolute inset-0 origin-top-left pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            {/* SVG Connections Layer */}
            <svg className="absolute inset-0 w-[2000px] h-[2000px] pointer-events-none overflow-visible z-0">
              <defs>
                <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#818cf8" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.8" />
                </linearGradient>
                <filter id="wireGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {connections.map((conn) => {
                const fromNode = nodes.find((n) => n.id === conn.fromId);
                const toNode = nodes.find((n) => n.id === conn.toId);
                if (!fromNode || !toNode) return null;

                const pathD = getPathD(fromNode, toNode);
                return (
                  <g key={conn.id}>
                    {/* Shadow ambient wire */}
                    <path d={pathD} stroke="rgba(255, 255, 255, 0.06)" strokeWidth="6" fill="none" />
                    {/* Glow wire */}
                    <path
                      d={pathD}
                      stroke="url(#curveGradient)"
                      strokeWidth={isGenerating ? '3.5' : '2'}
                      fill="none"
                      filter="url(#wireGlow)"
                    />
                    {/* Animated flowing stream dots */}
                    <path
                      d={pathD}
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeDasharray="4 8"
                      strokeDashoffset={isGenerating ? '-20' : '0'}
                      fill="none"
                      className={isGenerating ? 'animate-pulse' : ''}
                      style={{
                        animation: isGenerating ? 'dash 0.4s linear infinite' : 'dash 1.6s linear infinite',
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Interactive Nodes Layer */}
            <div className="absolute inset-0 w-full h-full pointer-events-auto">
              {nodes.map((node) => {
                const isSelected = selectedNodeId === node.id;

                return (
                  <div
                    key={node.id}
                    onPointerDown={(e) => handlePointerDownNode(e, node.id)}
                    className={`canvas-node-card absolute rounded-xl bg-[#121218]/95 backdrop-blur-md border transition-shadow cursor-grab active:cursor-grabbing ${
                      isSelected
                        ? 'border-sky-400 ring-2 ring-sky-400/20 shadow-2xl shadow-sky-500/10 z-20'
                        : 'border-white/10 shadow-xl hover:border-white/20 z-10'
                    }`}
                    style={{
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      width: `${node.width}px`,
                    }}
                  >
                    {/* Source & Target Connect Handles */}
                    {node.type !== 'prompt' && node.type !== 'reference' && (
                      <div
                        className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-sky-400 border-2 border-[#121218] shadow-md z-30"
                        title="输入连接端口 (Target)"
                      />
                    )}
                    {node.type !== 'result' && (
                      <div
                        className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#121218] shadow-md z-30"
                        title="输出连接端口 (Source)"
                      />
                    )}

                    {/* Node Header */}
                    <div className="px-3.5 py-2.5 border-b border-white/5 flex items-center justify-between text-xs text-zinc-300 font-semibold bg-white/[0.02] rounded-t-xl">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            node.type === 'prompt'
                              ? 'bg-sky-400'
                              : node.type === 'reference'
                              ? 'bg-amber-400'
                              : node.type === 'config'
                              ? 'bg-indigo-400'
                              : 'bg-emerald-400'
                          }`}
                        />
                        <span className="truncate">{node.title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                        {node.type === 'config' ? '调度中枢' : node.type.toUpperCase()}
                      </span>
                    </div>

                    {/* Node Body Content */}
                    <div className="p-3 text-xs">
                      {/* 1. Prompt Node */}
                      {node.type === 'prompt' && (
                        <div className="space-y-2">
                          <textarea
                            value={node.promptText}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNodes((prev) =>
                                prev.map((n) => (n.id === node.id ? { ...n, promptText: val } : n))
                              );
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            rows={3}
                            className="w-full rounded-lg bg-black/40 border border-white/10 p-2 text-xs text-zinc-200 resize-none focus:outline-none focus:border-sky-400/80 leading-relaxed font-sans"
                            placeholder="输入生成提示词..."
                          />
                          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                            <span>Qwen3.5 文本扩写</span>
                            <span>{node.promptText?.length || 0} 字</span>
                          </div>
                        </div>
                      )}

                      {/* 2. Reference Node */}
                      {node.type === 'reference' && (
                        <div className="space-y-2">
                          <div className="h-24 w-full rounded-lg bg-gradient-to-tr from-purple-950/80 via-indigo-900/60 to-sky-900/50 border border-white/10 relative overflow-hidden flex items-center justify-center">
                            <div className="text-center p-2">
                              <svg className="w-6 h-6 mx-auto text-amber-400/80 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                              <span className="text-[10px] text-zinc-300 font-mono block">输入参考图源</span>
                            </div>
                            <span className="absolute bottom-1 right-2 text-[9px] font-mono text-zinc-400 bg-black/50 px-1.5 py-0.5 rounded">
                              {node.size}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                            <span>槽位: ref_image_01</span>
                            <span className="text-emerald-400">已就绪</span>
                          </div>
                        </div>
                      )}

                      {/* 3. Config Hub Node */}
                      {node.type === 'config' && (
                        <div className="space-y-3">
                          <div>
                            <span className="text-[10px] text-zinc-500 font-mono block mb-1">选择目标工作流</span>
                            <select
                              value={node.workflow}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNodes((prev) =>
                                  prev.map((n) => (n.id === node.id ? { ...n, workflow: val } : n))
                                );
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="w-full rounded-lg bg-black/50 border border-white/10 px-2.5 py-1.5 text-xs text-sky-200 focus:outline-none focus:border-sky-400 cursor-pointer"
                            >
                              <option value="Z-Image-Turbo 极速文生图">Z-Image-Turbo 极速文生图</option>
                              <option value="Flux2.Dev 多图编辑">Flux2.Dev 多图编辑</option>
                              <option value="MiniMax H3 全能视频生成">MiniMax H3 全能视频生成</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                            <div className="p-2 rounded bg-white/[0.03] border border-white/5">
                              <span className="text-zinc-500 block text-[9px]">采样步数 (STEPS)</span>
                              <strong className="text-zinc-200">{node.steps} 步</strong>
                            </div>
                            <div className="p-2 rounded bg-white/[0.03] border border-white/5">
                              <span className="text-zinc-500 block text-[9px]">随机种子 (SEED)</span>
                              <strong className="text-sky-300 truncate block">{node.seed}</strong>
                            </div>
                          </div>

                          {/* Progress bar when generating */}
                          {isGenerating && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-mono text-sky-400">
                                <span>8188 采样中...</span>
                                <span>{generateProgress}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-200"
                                  style={{ width: `${generateProgress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Run Generate Action Button */}
                          <button
                            type="button"
                            onClick={handleRunGenerate}
                            disabled={isGenerating}
                            className={`w-full py-2.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg cursor-pointer ${
                              isGenerating
                                ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-sky-500/20 active:scale-[0.98]'
                            }`}
                          >
                            {isGenerating ? (
                              <>
                                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10" />
                                </svg>
                                <span>正在生成...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                <span>运行生图 (ComfyUI)</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* 4. Result Output Node */}
                      {node.type === 'result' && (
                        <div className="space-y-2.5">
                          <div
                            className={`aspect-square w-full rounded-lg bg-gradient-to-br ${currentArtwork.gradient} border border-white/15 p-3 flex flex-col justify-between relative overflow-hidden transition-all duration-500`}
                          >
                            <div className="flex justify-between items-start">
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/60 backdrop-blur-md"
                                style={{ color: currentArtwork.accentColor }}
                              >
                                {currentArtwork.tag}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400 bg-black/60 px-1.5 py-0.5 rounded">
                                1088×1920
                              </span>
                            </div>

                            {/* Simulated Art Visual Centerpiece */}
                            <div className="my-auto text-center py-4">
                              <div className="w-12 h-12 mx-auto rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center mb-2 shadow-inner border border-white/20">
                                <span className="text-xl">✨</span>
                              </div>
                              <strong className="text-sm font-bold text-white block">
                                {currentArtwork.title}
                              </strong>
                              <span className="text-[10px] text-zinc-300 font-sans mt-0.5 block opacity-85">
                                {currentArtwork.detail}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 bg-black/60 px-2 py-1 rounded">
                              <span>显存占用: {node.vram}</span>
                              <span className="text-emerald-400">100% 本地渲染</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1">
                            <span className="font-mono text-zinc-500">已保存至 output/</span>
                            <button
                              type="button"
                              onClick={() => {
                                setNodes((prev) =>
                                  prev.map((n) =>
                                    n.id === 'node-result'
                                      ? { ...n, presetIndex: ((n.presetIndex || 0) + 1) % ARTWORK_PRESETS.length }
                                      : n
                                  )
                                );
                                onToast('已切换至另一组作品预览');
                              }}
                              className="text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                            >
                              切换下一张 ↻
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Canvas Bottom Floating Hint */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none text-[11px] text-zinc-400 z-30">
            <span className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>拖拽卡片自由布局 · 点击「运行生图」体验完整调度闭环</span>
            </span>
            <span className="hidden sm:inline-block font-mono text-[10px] text-zinc-500 bg-black/60 px-2.5 py-1 rounded-full border border-white/5">
              直连端点: 127.0.0.1:8188
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
