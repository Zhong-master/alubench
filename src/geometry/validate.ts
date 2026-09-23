import type { AppState } from '../state';
import { ITEM_MAP, itemNameByName } from '../components/items/types';
import { LAYER_CONFIG } from '../components/layerTypes';
import type { Layer } from '../components/layerTypes';
import { buildSceneGeometry } from './index';
import type { SceneGeometry } from './types';
import { nearestLayerAbove } from './layer';
import type { Locale } from '../i18n';
import { localizeLayerLabel, tFor } from '../i18n/labels';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  layerId?: string;
}

/** 层板在机架内的垂直区间（中心 ± 厚度/2） */
function layerSpan(l: Layer): { bottom: number; top: number } {
  return {
    bottom: l.detail.elevation - l.detail.thickness / 2,
    top: l.detail.elevation + l.detail.thickness / 2,
  };
}

/**
 * 干涉与越界校验：
 * - board-overflow：层板长/宽超出机架边界
 * - board-height-overflow：层板标高+厚度超出机架高度
 * - layer-collision：相邻两层板垂直区间重叠
 * - item-overflow：物品世界尺寸（考虑 90° 旋转后的包围盒）超出所在网格单元
 * - item-clearance：物品顶部穿透上方最近层（或机架净高）
 *
 * UI 每次状态变更只需算一次几何，请用 `validateGeometry(state, geo)` 复用同一份实例；
 * `validate(state)` 是自建几何的独立入口（单测 / 脚本用）。
 */
export function validateGeometry(state: AppState, geo: SceneGeometry, locale: Locale = 'zh'): ValidationIssue[] {
  const t = tFor(locale);
  const issues: ValidationIssue[] = [];
  const { width: W, depth: D, height: H } = state.dimensions;

  // ── 层板越界 / 高度 ──
  for (const lg of geo.layers) {
    const b = lg.board;
    if (b.length > W + 1) {
      issues.push({ severity: 'error', code: 'board-overflow', message: t('validate.boardLenOverflow', { label: localizeLayerLabel(b.label, t), len: b.length, max: W }), layerId: b.layerId });
    }
    if (b.width > D + 1) {
      issues.push({ severity: 'error', code: 'board-overflow', message: t('validate.boardWidthOverflow', { label: localizeLayerLabel(b.label, t), len: b.width, max: D }), layerId: b.layerId });
    }
    const top = b.pos[1] + b.size[1] / 2;
    // 允许标高等同机架高（顶板顶面贴顶）；仅当顶面超出机架高一个板厚以上判为越界
    if (top > (H + b.thickness) / 1000 + 0.001) {
      issues.push({ severity: 'error', code: 'board-height-overflow', message: t('validate.boardHeightOverflow', { label: localizeLayerLabel(b.label, t), max: H }), layerId: b.layerId });
    }
  }

  // ── 层板垂直区间重叠 ──
  const sorted = state.layers.slice().sort((a, b) => a.detail.elevation - b.detail.elevation);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const aSpan = layerSpan(a);
    const bSpan = layerSpan(b);
    if (aSpan.top > bSpan.bottom + 0.5) {
      issues.push({
        severity: 'warning',
        code: 'layer-collision',
        message: t('validate.overlap', { a: localizeLayerLabel(a.label, t), b: localizeLayerLabel(b.label, t), z: bSpan.bottom.toFixed(0) }),
        layerId: a.id,
      });
    }
  }

  // ── 物品超出所在网格单元 ──
  for (const lg of geo.layers) {
    if (!lg.gridCols || !lg.gridRows) continue;
    const board = lg.board;
    const cw = board.size[0] / lg.gridCols;
    const ch = board.size[2] / lg.gridRows;
    for (const p of lg.placements) {
      // 旋转 90°/270° 时 X/Z 包围盒互换
      const rot = ((p.rotation % 180) + 180) % 180;
      const swap = Math.abs(rot - 90) < 1;
      const halfX = (swap ? p.worldSize[1] : p.worldSize[0]) / 2;
      const halfZ = (swap ? p.worldSize[0] : p.worldSize[1]) / 2;
      const xMin = p.x - halfX;
      const xMax = p.x + halfX;
      const cellX0 = p.col * cw;
      const cellX1 = (p.col + 1) * cw;
      const zMin = p.z - halfZ;
      const zMax = p.z + halfZ;
      const cellZ0 = board.pos[2] - board.size[2] / 2 + p.row * ch;
      const cellZ1 = cellZ0 + ch;
      if (xMin < cellX0 - 0.001 || xMax > cellX1 + 0.001 || zMin < cellZ0 - 0.001 || zMax > cellZ1 + 0.001) {
        const name = ITEM_MAP.get(p.itemType)?.name || p.itemType;
        issues.push({
          severity: 'warning',
          code: 'item-overflow',
          message: t('validate.itemOutOfCell', { name: itemNameByName(name, locale), scale: p.scale.toFixed(2) }),
          layerId: lg.layerId,
        });
      }
    }
  }

  // ── 物品顶部与上方最近层的净空 ──
  // 只按网格单元做水平校验会漏掉「高物品穿透上层板」这类物理干涉，
  // 每个层最多报告一次（取穿透最深者），避免同一层刷屏。
  // 上方无层时不做校验（机架顶板之上是开放空间，物品可以高出机架）。
  const CLEARANCE_TOLERANCE = 5; // mm，小于此值视为建模误差，不报
  for (const layer of state.layers) {
    const lg = geo.layers.find((g) => g.layerId === layer.id);
    if (!lg || lg.placements.length === 0) continue;
    const above = nearestLayerAbove(state.layers, layer.detail.elevation, layer.id);
    if (!above) continue;
    const ceilingY = above.detail.elevation - above.detail.thickness / 2;
    const ceilingLabel = above.label || LAYER_CONFIG[above.type].label;
    let worst: { name: string; over: number } | null = null;
    for (const p of lg.placements) {
      // p.y 是物品中心，顶部 = 中心 + 高/2
      const itemTop = (p.y + p.worldSize[2] / 2) * 1000;
      const over = itemTop - ceilingY;
      if (over > CLEARANCE_TOLERANCE && (!worst || over > worst.over)) {
        worst = { name: ITEM_MAP.get(p.itemType)?.name || p.itemType, over };
      }
    }
    if (worst) {
      issues.push({
        severity: 'warning',
        code: 'item-clearance',
        message: t('validate.itemClearance', {
          name: itemNameByName(worst.name, locale),
          ceiling: localizeLayerLabel(ceilingLabel, t),
          over: Math.round(worst.over),
        }),
        layerId: layer.id,
      });
    }
  }

  return issues;
}

/** 自建几何的独立入口（单测 / 脚本用）；UI 请复用一份几何后调用 `validateGeometry` */
export function validate(state: AppState, locale: Locale = 'zh'): ValidationIssue[] {
  return validateGeometry(state, buildSceneGeometry(state), locale);
}
