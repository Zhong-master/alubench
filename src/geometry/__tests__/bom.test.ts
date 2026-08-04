import { describe, it, expect } from 'vitest';
import { DEFAULT_STATE } from '../../state';
import { computeBom } from '../../utils/bom';
import { makeFourLayerScene } from './helpers';

describe('computeBom — 共享几何内核 BOM 聚合', () => {
  it('标准四层 1600×850×1600 机架：20 根型材 + 4 块板材', () => {
    const layers = makeFourLayerScene();
    const state: typeof DEFAULT_STATE = {
      ...DEFAULT_STATE,
      layers: Object.values(layers),
    };
    const bom = computeBom(state);

    expect(bom.totalProfileCount).toBe(20);
    expect(bom.boards).toHaveLength(4);

    // 期望聚合（与 SceneView 渲染逐根一致）：
    //   角柱 1600×4
    //   前后横梁 1560×8 = 底框前后 2 + 顶板/台面/隔板边框前后 6
    //   顶板左右横梁 850×2（isTop → 侧梁不延伸，长度=层宽）
    //   台面/隔板左右 + 底框左右 810×6
    const byKey = new Map(bom.profiles.map((p) => [`${p.spec}:${p.length}`, p.count]));
    expect(byKey.get('GB-4040:1600')).toBe(4);
    expect(byKey.get('GB-4040:1560')).toBe(8);
    expect(byKey.get('GB-4040:850')).toBe(2);
    expect(byKey.get('GB-4040:810')).toBe(6);

    // 板材清单名称
    expect(bom.boards.map((b) => b.label)).toEqual(['顶板', '台面', '隔板 #1', '底板']);
  });

  it('型材下料总长 = Σ(长度×数量)', () => {
    const state = { ...DEFAULT_STATE, layers: Object.values(makeFourLayerScene()) };
    const bom = computeBom(state);
    const manual = bom.profiles.reduce((s, p) => s + p.length * p.count, 0);
    expect(bom.totalProfileLength).toBe(manual);
    // 1600×4 + 1560×8 + 850×2 + 810×6
    expect(bom.totalProfileLength).toBe(6400 + 12480 + 1700 + 4860);
  });

  it('无层时只有机架骨架（4 角柱 + 4 底梁 + 4 无顶板顶框）', () => {
    const bom = computeBom(DEFAULT_STATE);
    expect(bom.totalProfileCount).toBe(12);
    expect(bom.boards).toHaveLength(0);
  });

  it('层板自定义 profileType 时边框规格跟随该层', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.profileType = 'GB-3030';
    const state = { ...DEFAULT_STATE, layers: Object.values(layers) };
    const bom = computeBom(state);
    const shelfBorder = bom.profiles.filter((p) => p.spec === 'GB-3030');
    // 隔板 4 边框：2×1560 + 2×820(850-30)
    expect(shelfBorder.reduce((s, p) => s + p.count, 0)).toBe(4);
  });
});
