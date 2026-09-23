import type { AppState } from '../state';
import type { Layer } from '../components/layerTypes';
import type { Face, FrameContext } from './types';

/** 解析型材规格字符串中的截面边长（mm），如 'GB-4040' → 40；解析失败返回 0 */
export function profileMMOf(raw: string): number {
  const parts = raw.split('-');
  const numStr = parts[parts.length - 1]?.substring(0, 2) || '';
  return parseInt(numStr, 10) || 0;
}

/** 主型材规格名（profile[0] 为空表示自定义） */
export function profileSpec(profile: string[]): string {
  return profile[0] ? `${profile[0]}-${profile[1]}` : '自定义';
}

/** 层板使用的型材规格名（有自定义 profileType 则优先） */
export function layerSpec(layer: Layer, globalSpec: string): string {
  return layer.detail.profileType || globalSpec;
}

/** 层板使用的型材截面边长（mm） */
export function layerMM(layer: Layer, globalMM: number): number {
  return profileMMOf(layer.detail.profileType) || globalMM;
}

/**
 * 构建机架整体几何上下文。
 * 与 SceneView.tsx 的 capY / getFaceCap / cols 计算逻辑完全一致。
 */
export function getFrameContext(state: AppState): FrameContext {
  const { dimensions, profile, columns, layers } = state;
  const W = dimensions.width;
  const D = dimensions.depth;
  const H = dimensions.height;
  const globalMM = profileMMOf(profile[1] || '') || 40;
  const globalSpec = profileSpec(profile);

  // 顶板立杆连接状态
  const topLayer = layers.find((l) => l.type === 'top');
  const cols = topLayer?.detail.topColumns ?? { fl: true, fr: true, bl: true, br: true };

  // 顶板下第一个延伸至立柱的层，用于截断未勾选的立杆
  const topElev = topLayer ? topLayer.detail.elevation : H;
  const fullWidthLayers = layers
    .filter((l) => l.type !== 'top' && l.detail.elevation < topElev - 1 && l.detail.frontConnect === 'extend')
    .sort((a, b) => b.detail.elevation - a.detail.elevation);
  const capY = fullWidthLayers.length > 0
    ? fullWidthLayers[0].detail.elevation - fullWidthLayers[0].detail.thickness / 2
    : H;

  // 各面额外立柱截止标高（空字符串=全高）
  const getFaceCap = (side: Face): number => {
    const capId = columns[(side + 'Cap') as 'frontCap'];
    if (!capId) return H;
    const capLayer = layers.find((l) => l.id === capId);
    return capLayer ? capLayer.detail.elevation : H;
  };

  return {
    W, D, H, globalMM, globalSpec, cols, capY, getFaceCap,
    hasTop: layers.some((l) => l.type === 'top'),
  };
}
