import type { AppState } from '../state';
import { ITEM_MAP } from '../components/items';
import type { Layer } from '../components/LeftPanel';
import { buildSceneGeometry } from './index';

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
 */
export function validate(state: AppState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { width: W, depth: D, height: H } = state.dimensions;
  const geo = buildSceneGeometry(state);

  // ── 层板越界 / 高度 ──
  for (const lg of geo.layers) {
    const b = lg.board;
    if (b.length > W + 1) {
      issues.push({ severity: 'error', code: 'board-overflow', message: `「${b.label}」长度 ${b.length}mm 超出机架长 ${W}mm`, layerId: b.layerId });
    }
    if (b.width > D + 1) {
      issues.push({ severity: 'error', code: 'board-overflow', message: `「${b.label}」宽度 ${b.width}mm 超出机架深 ${D}mm`, layerId: b.layerId });
    }
    const top = b.pos[1] + b.size[1] / 2;
    // 允许标高等同机架高（顶板顶面贴顶）；仅当顶面超出机架高一个板厚以上判为越界
    if (top > (H + b.thickness) / 1000 + 0.001) {
      issues.push({ severity: 'error', code: 'board-height-overflow', message: `「${b.label}」标高+厚度超出机架高度 ${H}mm`, layerId: b.layerId });
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
        message: `「${a.label}」与「${b.label}」层板在标高 ${bSpan.bottom.toFixed(0)}mm 处重叠`,
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
          message: `「${name}」超出所在网格单元（缩放 ${p.scale.toFixed(2)}×）`,
          layerId: lg.layerId,
        });
      }
    }
  }

  return issues;
}
