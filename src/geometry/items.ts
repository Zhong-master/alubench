import type { Layer } from '../components/layerTypes';
import { ITEM_MAP } from '../components/items/types';
import type { ItemPlacement } from './types';
import { zOffsetOf } from './layer';

/** 基准缩放不低于「填满单元」的该比例：避免上方净空极小时物品被压成看不见的小点 */
const MIN_FILL_RATIO = 0.3;

/**
 * 计算层上已放置物品的占位（位置 / 基准缩放 / 世界尺寸）。
 *
 * 尺寸真实性：基准缩放不再有 0.35 上限，改为按网格单元以 0.85 填充系数放大，
 * 使物品占位接近真实占用（此改动同时作用于 SceneView 与导出 HTML）。
 *
 * 旋转感知：90°/270° 时物品长短边互换，基准缩放按旋转后的包围盒计算，
 * 保证「放置时已带旋转」与「放置后旋转」都不会一放上去就超出单元。
 *
 * 净空自适应：传入 `ceilingYmm`（上方最近层的底面标高，mm）时，基准缩放会额外
 * 受限于「物品顶面不超过该底面」，避免小物品被 0.85 填充系数放大后穿透上层板。
 * 用户手动放大（userScale）不受此限制 —— 溢出让校验去提示。
 */
export function computePlacements(layer: Layer, Dmm: number, ceilingYmm?: number): ItemPlacement[] {
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
  // 可用净空（米）：层板上表面到上层板底面的距离
  const availableH = typeof ceilingYmm === 'number' ? ceilingYmm / 1000 - topY - 0.001 : Infinity;

  return layer.detail.placedItems.map((pi) => {
    const info = ITEM_MAP.get(pi.itemType);
    if (!info) return null;
    const cellX = pi.col * cw + cw / 2;
    const cellZ = zOff + pi.row * ch + ch / 2;
    const rotation = pi.rotation || 0;
    // 90°/270° 绕 Y 旋转后，X/Z 方向的占用互换
    const swapped = ((rotation % 180) + 180) % 180 === 90;
    const spanX = swapped ? info.size[1] : info.size[0];
    const spanZ = swapped ? info.size[0] : info.size[1];
    // 基准缩放：填充单元 85%，无 0.35 上限，按旋转后包围盒计算
    const fillScale = Math.min((cw * 0.85) / spanX, (ch * 0.85) / spanZ);
    // 高度方向自适应：放得下就按填充缩放，放不下则缩到刚好不穿透（有下限）
    const heightFit = availableH > 0 ? availableH / info.size[2] : 0;
    const baseScale = heightFit >= fillScale
      ? fillScale
      : Math.max(heightFit, fillScale * MIN_FILL_RATIO);
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
      rotation,
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
