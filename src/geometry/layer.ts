import type { Layer } from '../components/LeftPanel';
import type { BeamInstance, BoardInstance, FrameContext, LayerGeometry } from './types';
import { layerMM, layerSpec } from './context';

/** 层板对齐位置（mm） */
export function zOffsetOf(layer: Layer, Dmm: number): number {
  const lz = layer.detail.width;
  const halign = layer.detail.halign || 'left';
  return halign === 'left' ? 0 : halign === 'right' ? Dmm - lz : (Dmm - lz) / 2;
}

/** 层板名称（BOM / 标签） */
export function boardLabel(layer: Layer, layers: Layer[]): string {
  if (layer.type === 'top') return '顶板';
  if (layer.type === 'countertop') return '台面';
  if (layer.type === 'bottom') return '底板';
  const shelves = layers.filter((l) => l.type === 'shelf');
  const idx = shelves.findIndex((l) => l.id === layer.id);
  return `隔板 #${idx + 1}`;
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
    const above = allLayers.find((l) => {
      const le = l.detail.elevation / 1000;
      return le > ly + 0.001 && (l.type === 'countertop' || l.type === 'shelf' || l.type === 'top');
    });
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
    const below = [...allLayers].reverse().find((l) => {
      const le = l.detail.elevation / 1000;
      return le < ly - 0.001 && (l.type === 'countertop' || l.type === 'shelf' || l.type === 'bottom');
    });
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
