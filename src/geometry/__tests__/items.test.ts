import { describe, it, expect } from 'vitest';
import { computePlacements } from '../items';
import { makeLayer } from './helpers';

describe('computePlacements — 物品占位计算（尺寸真实性）', () => {
  const layer = makeLayer({
    id: 'shelf',
    type: 'shelf',
    elevation: 550,
    layout: '4X3',
    placedItems: [{ col: 1, row: 1, itemType: 'industrial-pc' }],
  });

  it('基准缩放无 0.35 上限，按格子 0.85 填充', () => {
    const ps = computePlacements(layer, 850);
    expect(ps).toHaveLength(1);
    const p = ps[0];
    // 格子 0.4m×0.2833m；工控机 0.32×0.28×0.095
    // baseScale = min(0.4*0.85/0.32, 0.2833*0.85/0.28) = min(1.0625, 0.86)
    expect(p.baseScale).toBeCloseTo(0.86, 2);
    expect(p.baseScale).toBeGreaterThan(0.35);   // 尺寸真实性：不再被 0.35 压小
    expect(p.scale).toBeCloseTo(0.86, 2);        // 默认 userScale=1
  });

  it('用户缩放相乘进总缩放，世界尺寸 = 原始×总缩放', () => {
    const l = {
      ...layer,
      detail: { ...layer.detail, placedItems: [{ col: 1, row: 1, itemType: 'industrial-pc' as const, scale: 1.5 }] },
    };
    const p = computePlacements(l, 850)[0];
    expect(p.userScale).toBe(1.5);
    expect(p.scale).toBeCloseTo(0.86 * 1.5, 2);
    expect(p.worldSize[0]).toBeCloseTo(0.32 * 0.86 * 1.5, 3);
  });

  it('物品位置居中于网格单元，底部贴合层板上表面', () => {
    const p = computePlacements(layer, 850)[0];
    // col=1,row=1 → x = 1*0.4 + 0.2 = 0.6；zOffset=0, z = 1*0.2833 + 0.1417 ≈ 0.425
    expect(p.x).toBeCloseTo(0.6, 3);
    expect(p.z).toBeCloseTo(0.425, 2);
    // y = topY + 高度/2 + 0.001 贴层系数
    expect(p.y).toBeCloseTo(0.555 + (0.095 * p.baseScale) / 2 + 0.001, 3);
  });

  it('无布局或无物品时返回空数组', () => {
    expect(computePlacements(makeLayer({ id: 'a', type: 'shelf', layout: '' }), 850)).toEqual([]);
    const noItem = makeLayer({ id: 'b', type: 'shelf', layout: '2X2', placedItems: [] });
    expect(computePlacements(noItem, 850)).toEqual([]);
  });
});
