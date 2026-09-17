import type { ModelMetricData } from '../types';

export const ECOSYSTEM_MODELS: Record<string, ModelMetricData> = {
  z_image: {
    id: 'z_image',
    name: 'Z-Image-Turbo (Int8)',
    category: '极速文生图',
    speed: '0.8s',
    speedDiff: '+28.4%',
    images: '4,820',
    imagesDiff: '+31.2%',
    steps: '8',
    vram: '6.4 GB',
    alignment: '97.8%',
    activeFlows: '12',
    fps: 'N/A',
    successRate: '99.8%'
  },
  flux2: {
    id: 'flux2',
    name: 'Flux2.Dev (Turbo)',
    category: '多图生图与编辑',
    speed: '1.9s',
    speedDiff: '+16.5%',
    images: '2,350',
    imagesDiff: '+18.4%',
    steps: '20',
    vram: '11.8 GB',
    alignment: '98.6%',
    activeFlows: '16',
    fps: 'N/A',
    successRate: '99.5%'
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax H3 (全能/首尾帧)',
    category: '全能多模态视频生成',
    speed: '13.5s',
    speedDiff: '+24.1%',
    images: '520',
    imagesDiff: '+22.0%',
    steps: '35',
    vram: '15.8 GB',
    alignment: '98.9%',
    activeFlows: '8',
    fps: '24 fps',
    successRate: '99.1%'
  },
  qwen_inpaint: {
    id: 'qwen_inpaint',
    name: 'Qwen-Image ControlNet',
    category: '局部重绘与遮罩编辑',
    speed: '1.1s',
    speedDiff: '+19.2%',
    images: '1,680',
    imagesDiff: '+14.5%',
    steps: '4',
    vram: '7.8 GB',
    alignment: '99.1%',
    activeFlows: '10',
    fps: 'N/A',
    successRate: '99.7%'
  },
  qwen_text: {
    id: 'qwen_text',
    name: 'Qwen3.5 4B (kktools)',
    category: '文本生成与视觉反推',
    speed: '0.5s',
    speedDiff: '+12.8%',
    images: '3,140',
    imagesDiff: '+26.3%',
    steps: '1',
    vram: '4.2 GB',
    alignment: '99.5%',
    activeFlows: '14',
    fps: 'N/A',
    successRate: '99.9%'
  }
};
