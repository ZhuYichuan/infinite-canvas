export type Language = 'zh-CN' | 'en';

export type FeatureStep = 'glance' | 'inspect' | 'explore';

export interface LayoutTileItem {
  id: string;
  title: string;
  desc?: string;
  metaSlot?: string;
  colSpan: 1 | 2;
  rowSpan: 1 | 2;
}

export interface ModelMetricData {
  id: string;
  name: string;
  category: string;
  speed: string;
  speedDiff: string;
  images: string;
  imagesDiff: string;
  steps: string;
  vram: string;
  alignment: string;
  activeFlows: string;
  fps: string;
  successRate: string;
}
