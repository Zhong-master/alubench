import type { Layer } from '../components/LeftPanel';
import { ITEM_MAP } from '../components/items';
import type { ItemPlacement } from './types';
import { zOffsetOf } from './layer';

/**
 * 计算层上已放置物品的占位（位置 / 基准缩放 / 世界尺寸）。
 *
 * 尺寸真实性：基准缩放不再有 0.35 上限，改为按网格单元以 0.85 填充系数放大，
 * 使物品占位接近真实占用（此改动同时作用于 SceneView 与导出 HTML）。
 */
export function computePlacements(layer: Layer, Dmm: number): ItemPlacement[] {
  const layout = layer.detail.layout;
  if (!layout || layer.detail.placedItems.length === 0) return [];
  const [cols, rows] = layout.split('X').map(Number);
  if (!cols || !rows) return [];

  const lx = layer.detail.length / 1000;
  const lz = layer.detail.width / 1000;
  const ly = layer.detail.elevation / 1000;
  const lt = layer.detail.thickness / 1000;
  const zOff = zOffsetOf(layer, Dmm) / 1000;
  const cw = lx / cols;
  const ch = lz / rows;
  const topY = ly + lt / 2;

  return layer.detail.placedItems.map((pi) => {
    const info = ITEM_MAP.get(pi.itemType);
    if (!info) return null;
    const cellX = pi.col * cw + cw / 2;
    const cellZ = zOff + pi.row * ch + ch / 2;
    // 基准缩放：填充单元 85%，无 0.35 上限
    const baseScale = Math.min((cw * 0.85) / info.size[0], (ch * 0.85) / info.size[1]);
    const userScale = pi.scale || 1;
    const scale = baseScale * userScale;
    const itemH = info.size[2] * scale;
    return {
      layerId: layer.id,
      itemType: pi.itemType,
      col: pi.col,
      row: pi.row,
      x: cellX,
      y: topY + itemH / 2 + 0.001,
      z: cellZ,
      rotation: pi.rotation || 0,
      baseScale,
      userScale,
      scale,
      flipX: pi.flipX || false,
      flipY: pi.flipY || false,
      size: info.size,
      worldSize: [info.size[0] * scale, info.size[1] * scale, info.size[2] * scale],
    } satisfies ItemPlacement;
  }).filter((p): p is ItemPlacement => p !== null);
}
