import { describe, it, expect } from 'vitest';
import { applyDimensionChange } from '../dimension';
import { makeLayer, makeFourLayerScene } from './helpers';

describe('applyDimensionChange — 标高截断与恢复状态机', () => {
  it('缩小高度：超过新高度的层截断并记录原始标高', () => {
    const layers = Object.values(makeFourLayerScene());
    const capped = new Map<string, number>();
    // 原 1600 → 新 1000：顶板(1600)→1000；隔板(550)/台面(800) 不变；再加一个高隔板 1150 截断
    const withHighShelf = [...layers, makeLayer({ id: 'shelfHigh', type: 'shelf', elevation: 1150 })];
    const next = applyDimensionChange(withHighShelf, { width: 1600, depth: 850, height: 1600 }, { width: 1600, depth: 850, height: 1000 }, capped);

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
    const next = applyDimensionChange(withHighShelf, { width: 1600, depth: 850, height: 1000 }, { width: 1600, depth: 850, height: 1600 }, capped);

    const high = next.find((l) => l.id === 'shelfHigh')!;
    expect(high.detail.elevation).toBe(1150);           // 恢复
    expect(capped.has('shelfHigh')).toBe(false);        // 清出
  });

  it('高度未变化：仅同步层长宽', () => {
    const layers = Object.values(makeFourLayerScene());
    const capped = new Map<string, number>();
    const next = applyDimensionChange(layers, { width: 1600, depth: 850, height: 1600 }, { width: 1800, depth: 900, height: 1600 }, capped);
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
    const next = applyDimensionChange(withHighShelf, { width: 1600, depth: 850, height: 1000 }, { width: 1600, depth: 850, height: 1500 }, capped);
    const high = next.find((l) => l.id === 'shelfHigh')!;
    expect(high.detail.elevation).toBe(1500);           // min(2000, 1500)
  });
});

describe('applyDimensionChange — 长宽跟随规则', () => {
  const RACK = { width: 1600, depth: 850, height: 1600 };

  /** 机架 1600×850，含一个自定义尺寸的未锁定隔板 */
  const sceneWithCustomShelf = () => {
    const layers = Object.values(makeFourLayerScene());
    const custom = makeLayer({ id: 'shelfCustom', type: 'shelf', elevation: 400 });
    custom.detail = { ...custom.detail, length: 1200, width: 600, locked: false };
    return [...layers, custom];
  };

  it('自定义尺寸的未锁定隔板：机架变大时保留自己的尺寸（不再被静默写成机架尺寸）', () => {
    const next = applyDimensionChange(sceneWithCustomShelf(), RACK, { width: 1800, depth: 1000, height: 1600 }, new Map());
    const custom = next.find((l) => l.id === 'shelfCustom')!;
    expect(custom.detail.length).toBe(1200);
    expect(custom.detail.width).toBe(600);
  });

  it('自定义尺寸的隔板：机架缩小到小于它时收敛到机架尺寸（不越界）', () => {
    const next = applyDimensionChange(sceneWithCustomShelf(), RACK, { width: 1000, depth: 500, height: 1600 }, new Map());
    const custom = next.find((l) => l.id === 'shelfCustom')!;
    expect(custom.detail.length).toBe(1000);
    expect(custom.detail.width).toBe(500);
  });

  it('锁定层即使被改过尺寸也始终跟随机架', () => {
    const layers = Object.values(makeFourLayerScene());
    const lockedShelf = makeLayer({ id: 'shelfLocked', type: 'shelf', elevation: 400 });
    lockedShelf.detail = { ...lockedShelf.detail, length: 900, width: 400, locked: true };
    const next = applyDimensionChange([...layers, lockedShelf], RACK, { width: 1800, depth: 1000, height: 1600 }, new Map());
    const s = next.find((l) => l.id === 'shelfLocked')!;
    expect(s.detail.length).toBe(1800);
    expect(s.detail.width).toBe(1000);
  });

  it('逐轴判断：满宽但半深的隔板跟随宽度、保留深度', () => {
    const layers = Object.values(makeFourLayerScene());
    const halfDepth = makeLayer({ id: 'shelfHalf', type: 'shelf', elevation: 400 });
    halfDepth.detail = { ...halfDepth.detail, length: 1600, width: 425, locked: false };
    const next = applyDimensionChange([...layers, halfDepth], RACK, { width: 1800, depth: 1000, height: 1600 }, new Map());
    const s = next.find((l) => l.id === 'shelfHalf')!;
    expect(s.detail.length).toBe(1800);   // 原本满宽 → 跟随
    expect(s.detail.width).toBe(425);     // 半深 → 保留
  });

  it('默认场景（全部满尺寸）行为不变：仍全部跟随机架', () => {
    const next = applyDimensionChange(Object.values(makeFourLayerScene()), RACK, { width: 1800, depth: 1000, height: 1600 }, new Map());
    for (const l of next) {
      expect(l.detail.length).toBe(1800);
      expect(l.detail.width).toBe(1000);
    }
  });
});
