import type { ColumnsState } from '../state';
import type { BeamInstance, CornerKey, Face, FrameContext } from './types';

/** 等分点位：count 个点在 len 范围内均分（与 SceneView spaced 一致） */
function spaced(count: number, len: number): number[] {
  return Array.from({ length: count }, (_, i) => (len / (count + 1)) * (i + 1));
}

/**
 * 构建机架级型材（角柱 / 底部横梁 / 顶底横向加强筋 / 四面立柱 / 无顶板顶部边框）。
 * 与 SceneView.tsx 的 cornerBeams + extraBeams + topBeams + bottomFrame 逻辑完全一致。
 */
export function buildFrameBeams(ctx: FrameContext, columns: ColumnsState): BeamInstance[] {
  const { W: Wmm, D: Dmm, H: Hmm, globalMM, globalSpec, cols, capY, getFaceCap, hasTop } = ctx;
  const W = Wmm / 1000;
  const D = Dmm / 1000;
  const H = Hmm / 1000;
  const t = globalMM / 1000;
  const cx = W / 2;
  const cy = H / 2;
  const cz = D / 2;
  const capYM = capY / 1000;

  const beams: BeamInstance[] = [];
  const push = (length: number, pos: [number, number, number], size: [number, number, number]) =>
    beams.push({ spec: globalSpec, length, pos, size });

  // ── 4 根角柱（顶板立杆连接决定是否延伸到顶） ──
  const cornerDefs: Array<{ key: CornerKey; pos: [number, number, number] }> = [
    { key: 'fl', pos: [0, cy, D] },
    { key: 'fr', pos: [W, cy, D] },
    { key: 'bl', pos: [0, cy, 0] },
    { key: 'br', pos: [W, cy, 0] },
  ];
  for (const { key, pos } of cornerDefs) {
    const colH = cols[key] !== false ? H : capYM;
    push(Math.round(colH * 1000), [pos[0], colH / 2, pos[2]], [t, colH, t]);
  }

  // ── 底部横梁 ──
  const bf = columns.bottomFrame || 'full';
  if (bf === 'full' || bf === 'frontback') {
    push(Wmm - globalMM, [cx, t / 2, D], [W - t, t, t]);
    push(Wmm - globalMM, [cx, t / 2, 0], [W - t, t, t]);
  }
  if (bf === 'full' || bf === 'leftright') {
    push(Dmm - globalMM, [0, t / 2, cz], [t, t, D - t]);
    push(Dmm - globalMM, [W, t / 2, cz], [t, t, D - t]);
  }

  // ── 顶面/底面横向加强筋（沿 Z 方向） ──
  for (const x of spaced(columns.top, W)) {
    push(Dmm - globalMM, [x, H - t / 2, cz], [t, t, D - t]);
  }
  for (const x of spaced(columns.bottom, W)) {
    push(Dmm - globalMM, [x, t / 2, cz], [t, t, D - t]);
  }

  // ── 四面额外立柱（截止高度取角柱截断与侧面截止层较小者） ──
  const addCols = (count: number, side: Face) => {
    const capped =
      (side === 'front' && (cols.fl === false || cols.fr === false)) ||
      (side === 'back' && (cols.bl === false || cols.br === false)) ||
      (side === 'left' && (cols.fl === false || cols.bl === false)) ||
      (side === 'right' && (cols.fr === false || cols.br === false));
    const cornerCap = capped ? capYM : H;
    const faceCap = getFaceCap(side) / 1000;
    const pillarCap = Math.min(cornerCap, faceCap);
    const h = Math.max(pillarCap - t, 0.01);
    const y = t + h / 2;
    const positions = spaced(count, side === 'front' || side === 'back' ? W : D);
    for (const p of positions) {
      const x = side === 'left' || side === 'right' ? (side === 'left' ? 0 : W) : p;
      const z = side === 'front' ? D : side === 'back' ? 0 : p;
      push(Math.round(h * 1000), [x, y, z], [t, h, t]);
    }
  };
  addCols(columns.front, 'front');
  addCols(columns.back, 'back');
  addCols(columns.left, 'left');
  addCols(columns.right, 'right');

  // ── 无顶板时生成顶部边框横梁（按立杆连接补缺） ──
  if (!hasTop) {
    const tf = cols.fl !== false ? t / 2 : -t / 2;
    const tF = cols.fr !== false ? W - t / 2 : W + t / 2;
    const tb = cols.bl !== false ? t / 2 : -t / 2;
    const tB = cols.br !== false ? W - t / 2 : W + t / 2;
    push(Math.round((tF - tf) * 1000), [(tf + tF) / 2, H - t / 2, D], [tF - tf, t, t]);
    push(Math.round((tB - tb) * 1000), [(tb + tB) / 2, H - t / 2, 0], [tB - tb, t, t]);
    push(Dmm - globalMM, [0, H - t / 2, cz], [t, t, D - t]);
    push(Dmm - globalMM, [W, H - t / 2, cz], [t, t, D - t]);
  }

  return beams;
}
