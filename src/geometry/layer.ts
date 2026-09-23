import type { Layer } from '../components/layerTypes';
import type { BeamInstance, BoardInstance, FrameContext, LayerGeometry } from './types';
import { layerMM, layerSpec } from './context';

/** 层板对齐位置（mm） */
export function zOffsetOf(layer: Layer, Dmm: number): number {
  const lz = layer.detail.width;
  const halign = layer.detail.halign || 'left';
  return halign === 'left' ? 0 : halign === 'right' ? Dmm - lz : (Dmm - lz) / 2;
}

/**
 * 隔板序号（1-based，按标高降序；非隔板返回 0）。
 *
 * 底栏、3D 标签、右侧面板、导出 HTML 的「#N」必须共用这一个编号 ——
 * 数组顺序不参与计算（BOM 传插入顺序、UI 传标高降序，否则同一场景会得到两套编号）。
 */
export function shelfIndex(layer: Layer, layers: Layer[]): number {
  if (layer.type !== 'shelf') return 0;
  const shelves = layers
    .filter((l) => l.type === 'shelf')
    .slice()
    .sort((a, b) => b.detail.elevation - a.detail.elevation);
  const idx = shelves.findIndex((l) => l.id === layer.id);
  return idx >= 0 ? idx + 1 : 0;
}

/** 层板名称（BOM / 标签） */
export function boardLabel(layer: Layer, layers: Layer[]): string {
  if (layer.type === 'top') return '顶板';
  if (layer.type === 'countertop') return '台面';
  if (layer.type === 'bottom') return '底板';
  return `隔板 #${shelfIndex(layer, layers)}`;
}

/** 可参与层间连接的层类型（顶板只可能在当前层上方，底板只可能在下方） */
const ABOVE_TYPES: ReadonlyArray<Layer['type']> = ['countertop', 'shelf', 'top'];
const BELOW_TYPES: ReadonlyArray<Layer['type']> = ['countertop', 'shelf', 'bottom'];

/**
 * 取当前层「上方最近」的可连接层：标高大于 ly 的层中最低者。
 *
 * 只按标高比较，不依赖 layers 数组顺序 —— SceneView / 导出端传入的是标高降序
 * （sortedLayers），BOM 传入的是原始插入顺序，两者必须得到同一结果。
 */
export function nearestLayerAbove(allLayers: Layer[], lyMM: number, selfId: string): Layer | null {
  let best: Layer | null = null;
  for (const l of allLayers) {
    if (l.id === selfId || !ABOVE_TYPES.includes(l.type)) continue;
    if (l.detail.elevation <= lyMM) continue;
    if (!best || l.detail.elevation < best.detail.elevation) best = l;
  }
  return best;
}

/** 取当前层「下方最近」的可连接层：标高小于 ly 的层中最高者（同样与数组顺序无关） */
export function nearestLayerBelow(allLayers: Layer[], lyMM: number, selfId: string): Layer | null {
  let best: Layer | null = null;
  for (const l of allLayers) {
    if (l.id === selfId || !BELOW_TYPES.includes(l.type)) continue;
    if (l.detail.elevation >= lyMM) continue;
    if (!best || l.detail.elevation > best.detail.elevation) best = l;
  }
  return best;
}

/**
 * 构建单层几何：板材 + 边框/连接/加强筋全部型材 + 已放置物品占位。
 * 与 SceneView.tsx 的层渲染逻辑完全一致。
 */
export function buildLayerGeometry(
  layer: Layer,
  ctx: FrameContext,
  allLayers: Layer[],
  placements: LayerGeometry['placements'],
): LayerGeometry {
  const { D: Dmm, globalMM, globalSpec } = ctx;
  const lx = layer.detail.length / 1000;
  const lz = layer.detail.width / 1000;
  const ly = layer.detail.elevation / 1000;
  const lt = layer.detail.thickness / 1000;
  const pt = layerMM(layer, globalMM) / 1000;
  const spec = layerSpec(layer, globalSpec);
  const zOff = zOffsetOf(layer, Dmm) / 1000;
  const D = Dmm / 1000;
  const t = globalMM / 1000;
  const cz = D / 2;

  const beams: BeamInstance[] = [];
  const push = (length: number, pos: [number, number, number], size: [number, number, number]) =>
    beams.push({ spec, length, pos, size });

  // ── 板材 ──
  const board: BoardInstance = {
    layerId: layer.id,
    label: boardLabel(layer, allLayers),
    type: layer.type,
    length: layer.detail.length,
    width: layer.detail.width,
    thickness: layer.detail.thickness,
    color: layer.color,
    pos: [lx / 2, ly, zOff + lz / 2],
    size: [lx, lt, lz],
  };

  const hasFrame = layer.type === 'countertop' || layer.type === 'shelf' || layer.type === 'top';

  // ── 边框 4 根 ──
  if (hasFrame) {
    const isTop = layer.type === 'top';
    const fc = layer.detail.frontConnect || 'extend';
    // 'up'/'down'/'drop' 时侧梁不延伸；'extend' 时延伸至立柱
    const connect = isTop ? 'none' : lz >= D - 0.001
      ? 'extend'
      : fc === 'up' || fc === 'down' || fc === 'drop' || fc === 'none'
        ? 'none'
        : 'extend';
    const lrZ = connect === 'extend' ? cz : zOff + (t + lz) / 2;
    const lrLen = connect === 'extend' ? D - t : lz;
    push(Math.round(layer.detail.length - layerMM(layer, globalMM)),
      [lx / 2, ly - lt / 2 - pt / 2, zOff + lz], [lx - pt, pt, pt]);
    push(Math.round(layer.detail.length - layerMM(layer, globalMM)),
      [lx / 2, ly - lt / 2 - pt / 2, zOff], [lx - pt, pt, pt]);
    push(Math.round((connect === 'extend' ? Dmm - globalMM : layer.detail.width)),
      [0, ly - lt / 2 - pt / 2, lrZ], [pt, pt, lrLen]);
    push(Math.round((connect === 'extend' ? Dmm - globalMM : layer.detail.width)),
      [lx, ly - lt / 2 - pt / 2, lrZ], [pt, pt, lrLen]);
  }

  // ── 上连型材（up / drop）—— 竖柱连接到上层型材而非层面 ──
  if (hasFrame && (layer.detail.frontConnect === 'up' || layer.detail.frontConnect === 'drop')) {
    const above = nearestLayerAbove(allLayers, layer.detail.elevation, layer.id);
    if (above) {
      const aly = above.detail.elevation / 1000;
      const alt = above.detail.thickness / 1000;
      const abovePT = layerMM(above, globalMM) / 1000;
      const aboveExtends = above.detail.width / 1000 >= D - 0.001 || above.detail.frontConnect === 'extend';
      const dropTop = above.type === 'top' ? aly - alt / 2 : aly - alt / 2 - abovePT;
      const dropBot = ly - lt / 2;
      const dropH = Math.max(dropTop - dropBot, 0.001);
      const frontZ = aboveExtends ? D : zOff + lz;
      const backZ = aboveExtends ? 0 : zOff;
      if (aboveExtends && zOff + lz < D - 0.001) {
        push(Math.round(Dmm - (zOff + lz) * 1000),
          [0, dropBot + pt / 2, (zOff + lz + D) / 2], [pt, pt, D - (zOff + lz)]);
        push(Math.round(Dmm - (zOff + lz) * 1000),
          [lx, dropBot + pt / 2, (zOff + lz + D) / 2], [pt, pt, D - (zOff + lz)]);
      }
      if (aboveExtends && zOff > 0.001) {
        push(Math.round(zOff * 1000), [0, dropBot + pt / 2, zOff / 2], [pt, pt, zOff]);
        push(Math.round(zOff * 1000), [lx, dropBot + pt / 2, zOff / 2], [pt, pt, zOff]);
      }
      push(Math.round(dropH * 1000), [0, dropBot + dropH / 2, frontZ], [pt, dropH, pt]);
      push(Math.round(dropH * 1000), [lx, dropBot + dropH / 2, frontZ], [pt, dropH, pt]);
      if (aboveExtends) {
        push(Math.round(dropH * 1000), [0, dropBot + dropH / 2, backZ], [pt, dropH, pt]);
        push(Math.round(dropH * 1000), [lx, dropBot + dropH / 2, backZ], [pt, dropH, pt]);
      }
    }
  }

  // ── 下连型材（down）—— 竖柱向下连接到下层型材 ──
  if (hasFrame && layer.detail.frontConnect === 'down') {
    const below = nearestLayerBelow(allLayers, layer.detail.elevation, layer.id);
    if (below) {
      const bly = below.detail.elevation / 1000;
      const blt = below.detail.thickness / 1000;
      const belowPT = layerMM(below, globalMM) / 1000;
      const belowExtends = below.detail.width / 1000 >= D - 0.001 || below.detail.frontConnect === 'extend';
      const dropBot = below.type === 'bottom' ? bly + blt / 2 : bly + blt / 2 + belowPT;
      const dropTop = ly - lt / 2;
      const dropH = Math.max(dropTop - dropBot, 0.001);
      const frontZ = belowExtends ? D : zOff + lz;
      const backZ = belowExtends ? 0 : zOff;
      if (belowExtends && zOff + lz < D - 0.001) {
        push(Math.round(Dmm - (zOff + lz) * 1000),
          [0, dropBot + dropH / 2 - pt / 2, (zOff + lz + D) / 2], [pt, pt, D - (zOff + lz)]);
        push(Math.round(Dmm - (zOff + lz) * 1000),
          [lx, dropBot + dropH / 2 - pt / 2, (zOff + lz + D) / 2], [pt, pt, D - (zOff + lz)]);
      }
      if (belowExtends && zOff > 0.001) {
        push(Math.round(zOff * 1000), [0, dropBot + dropH / 2 - pt / 2, zOff / 2], [pt, pt, zOff]);
        push(Math.round(zOff * 1000), [lx, dropBot + dropH / 2 - pt / 2, zOff / 2], [pt, pt, zOff]);
      }
      push(Math.round(dropH * 1000), [0, dropBot + dropH / 2, frontZ], [pt, dropH, pt]);
      push(Math.round(dropH * 1000), [lx, dropBot + dropH / 2, frontZ], [pt, dropH, pt]);
      if (belowExtends) {
        push(Math.round(dropH * 1000), [0, dropBot + dropH / 2, backZ], [pt, dropH, pt]);
        push(Math.round(dropH * 1000), [lx, dropBot + dropH / 2, backZ], [pt, dropH, pt]);
      }
    }
  }

  // ── 加强筋 ──
  const ribN = layer.detail.ribCount || 0;
  const ribDir = layer.detail.ribDirection || 'x';
  for (let i = 0; i < ribN; i++) {
    if (ribDir === 'x') {
      const zPos = zOff + (lz / (ribN + 1)) * (i + 1);
      push(Math.round(layer.detail.length - layerMM(layer, globalMM)),
        [lx / 2, ly - lt / 2 - pt / 2, zPos], [lx - pt, pt, pt]);
    } else {
      const xPos = (lx / (ribN + 1)) * (i + 1);
      push(Math.round(layer.detail.width - layerMM(layer, globalMM)),
        [xPos, ly - lt / 2 - pt / 2, zOff + lz / 2], [pt, pt, lz - pt]);
    }
  }

  // ── 布局网格（仅列数/行数供渲染端与校验使用） ──
  let gridCols = 0;
  let gridRows = 0;
  if (layer.detail.layout) {
    const [cols, rows] = layer.detail.layout.split('X').map(Number);
    if (cols && rows) {
      gridCols = cols;
      gridRows = rows;
    }
  }

  return { layerId: layer.id, board, beams, placements, gridCols, gridRows };
}

/** 构建全场景几何 */
export function buildAllLayers(
  layers: Layer[],
  ctx: FrameContext,
  placementFor: (layer: Layer) => LayerGeometry['placements'],
): LayerGeometry[] {
  return layers.map((layer) => buildLayerGeometry(layer, ctx, layers, placementFor(layer)));
}
