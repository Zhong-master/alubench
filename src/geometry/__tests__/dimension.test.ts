import { describe, it, expect } from 'vitest';
import { applyDimensionChange } from '../dimension';
import { makeLayer, makeFourLayerScene } from './helpers';

describe('applyDimensionChange — 标高截断与恢复状态机', () => {
  it('缩小高度：超过新高度的层截断并记录原始标高', () => {
    const layers = Object.values(makeFourLayerScene());
    const capped = new Map<string, number>();
    // 原 1600 → 新 1000：顶板(1600)→1000；隔板(550)/台面(800) 不变；再加一个高隔板 1150 截断
    const withHighShelf = [...layers, makeLayer({ id: 'shelfHigh', type: 'shelf', elevation: 1150 })];
    const next = applyDimensionChange(withHighShelf, 1600, 1000, 1600, 850, capped);

    const top = next.find((l) => l.type === 'top')!;
    const high = next.find((l) => l.id === 'shelfHigh')!;
    expect(top.detail.elevation).toBe(1000);
    expect(high.detail.elevation).toBe(1000);           // 截断
    expect(capped.get('shelfHigh')).toBe(1150);         // 记录原始
    expect(capped.has('top')).toBe(false);
  });

  it('恢复高度：被截断层回到 min(原始, 新高度)，并清出 capped', () => {
    const capped = new Map([['shelfHigh', 1150]]);
    const layers = Object.values(makeFourLayerScene()).map((l) =>
      l.type === 'top' ? { ...l, detail: { ...l.detail, elevation: 1000 } } : l
    );
    const withHighShelf = [
      ...layers,
      makeLayer({ id: 'shelfHigh', type: 'shelf', elevation: 1000 }),
    ];
    const next = applyDimensionChange(withHighShelf, 1000, 1600, 1600, 850, capped);

    const high = next.find((l) => l.id === 'shelfHigh')!;
    expect(high.detail.elevation).toBe(1150);           // 恢复
    expect(capped.has('shelfHigh')).toBe(false);        // 清出
  });

  it('高度未变化：仅同步层长宽', () => {
    const layers = Object.values(makeFourLayerScene());
    const capped = new Map<string, number>();
    const next = applyDimensionChange(layers, 1600, 1600, 1800, 900, capped);
    for (const l of next) {
      expect(l.detail.length).toBe(1800);
      expect(l.detail.width).toBe(900);
    }
  });

  it('恢复高度不超过新高度（capped 高于新高度则取新高度）', () => {
    const capped = new Map([['shelfHigh', 2000]]);
    const layers = Object.values(makeFourLayerScene()).map((l) =>
      l.type === 'top' ? { ...l, detail: { ...l.detail, elevation: 1000 } } : l
    );
    const withHighShelf = [
      ...layers,
      makeLayer({ id: 'shelfHigh', type: 'shelf', elevation: 1000 }),
    ];
    const next = applyDimensionChange(withHighShelf, 1000, 1500, 1600, 850, capped);
    const high = next.find((l) => l.id === 'shelfHigh')!;
    expect(high.detail.elevation).toBe(1500);           // min(2000, 1500)
  });
});
