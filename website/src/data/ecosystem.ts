import type { ModelMetricData } from '../types';

export const ECOSYSTEM_MODELS: Record<string, ModelMetricData> = {
  flux: {
    id: 'flux',
    name: 'Flux.1 Dev Turbo',
    category: '图像生成',
    speed: '1.8s',
    speedDiff: '+14.2%',
    images: '1,420',
    imagesDiff: '+9.8%',
    steps: '20',
    vram: '8.2 GB',
    alignment: '96.4%',
    activeFlows: '18',
    fps: 'N/A',
    successRate: '99.4%'
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax H3 / Wan2.1',
    category: '全能多模态视频',
    speed: '14.2s',
    speedDiff: '+22.5%',
    images: '386',
    imagesDiff: '+15.0%',
    steps: '35',
    vram: '15.4 GB',
    alignment: '98.1%',
    activeFlows: '6',
    fps: '24 fps',
    successRate: '98.8%'
  },
  sdxl: {
    id: 'sdxl',
    name: 'SDXL Lightning',
    category: '超快速出图',
    speed: '0.9s',
    speedDiff: '+35.1%',
    images: '4,820',
    imagesDiff: '+28.4%',
    steps: '8',
    vram: '5.8 GB',
    alignment: '91.2%',
    activeFlows: '24',
    fps: 'N/A',
    successRate: '99.9%'
  },
  qwen: {
    id: 'qwen',
    name: 'Qwen2.5-VL Interrogator',
    category: '视觉反推与提示词',
    speed: '1.2s',
    speedDiff: '+8.4%',
    images: '890',
    imagesDiff: '+12.1%',
    steps: '1',
    vram: '7.1 GB',
    alignment: '99.0%',
    activeFlows: '9',
    fps: 'N/A',
    successRate: '99.6%'
  }
};
