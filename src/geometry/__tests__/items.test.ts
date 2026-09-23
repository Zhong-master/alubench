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

  it('旋转 90° 时基准缩放按互换后的包围盒计算（不会一旋转就超界）', () => {
    const l = {
      ...layer,
      detail: { ...layer.detail, placedItems: [{ col: 1, row: 1, itemType: 'industrial-pc' as const, rotation: 90 }] },
    };
    const p = computePlacements(l, 850)[0];
    // 工控机 0.32(X)×0.28(Z) 旋转后：X 占 0.28、Z 占 0.32；单元 0.4×0.2833
    // baseScale = min(0.4*0.85/0.28, 0.2833*0.85/0.32) = 0.7526
    expect(p.rotation).toBe(90);
    expect(p.baseScale).toBeCloseTo(0.7526, 3);
    // 旋转后的外包络落在单元内
    expect(0.28 * p.scale).toBeLessThanOrEqual(0.4 + 1e-9);
    expect(0.32 * p.scale).toBeLessThanOrEqual(0.28334 + 1e-9);
  });

  it('传入上方净空时，基准缩放额外受限于「不穿透上层板」', () => {
    const l = makeLayer({
      id: 'shelf', type: 'shelf', elevation: 550, layout: '1X1',
      placedItems: [{ col: 0, row: 0, itemType: 'pda' }],
    });
    // 无净空限制：PDA 0.15×0.06 被放大填满 1.6×0.85 的单元（9.07×）
    expect(computePlacements(l, 850)[0].baseScale).toBeCloseTo(9.0667, 3);
    // 上方层板底面 795mm → 净空 239mm，高 70mm 的 PDA 最多放大 3.41×
    const clamped = computePlacements(l, 850, 795)[0];
    expect(clamped.baseScale).toBeCloseTo(3.4143, 3);
    expect(clamped.worldSize[2]).toBeLessThanOrEqual(0.239 + 1e-9);
    // 净空极小时保留下限（不压成看不见的小点），穿透留给校验提示
    expect(computePlacements(l, 850, 600)[0].baseScale).toBeCloseTo(9.0667 * 0.3, 3);
  });
});
