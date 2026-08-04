import { describe, it, expect } from 'vitest';
import { parseLayout, remapPlacedItems, duplicateLayer } from '../operations';
import { makeLayer } from './helpers';

describe('parseLayout', () => {
  it('解析合法布局', () => {
    expect(parseLayout('3X2')).toEqual([3, 2]);
    expect(parseLayout('1X5')).toEqual([1, 5]);
  });
  it('空/无效布局返回 null', () => {
    expect(parseLayout('')).toBeNull();
    expect(parseLayout('0X2')).toBeNull();
    expect(parseLayout('abc')).toBeNull();
  });
});

describe('remapPlacedItems — 网格重排物品重映射', () => {
  it('缩小网格：界内物品保留，越界物品移除', () => {
    // 3×2 网格，物品在 (0,0),(2,1),(1,0) → 改 2×2：(2,1) 越界移除
    const layer = makeLayer({
      id: 'shelf', type: 'shelf', layout: '3X2',
      placedItems: [
        { col: 0, row: 0, itemType: 'industrial-pc' },
        { col: 2, row: 1, itemType: 'laptop' },
        { col: 1, row: 0, itemType: 'pda' },
      ],
    });
    const { items, removed } = remapPlacedItems(layer, 2, 2);
    expect(removed).toBe(1);
    expect(items.map((p) => [p.col, p.row])).toEqual([[0, 0], [1, 0]]);
  });

  it('扩大网格：所有物品保留', () => {
    const layer = makeLayer({
      id: 'shelf', type: 'shelf', layout: '2X2',
      placedItems: [{ col: 1, row: 1, itemType: 'industrial-pc' }],
    });
    const { items, removed } = remapPlacedItems(layer, 4, 4);
    expect(removed).toBe(0);
    expect(items).toHaveLength(1);
  });

  it('行/列任一越界即移除', () => {
    const layer = makeLayer({
      id: 'shelf', type: 'shelf', layout: '3X2',
      placedItems: [
        { col: 2, row: 1, itemType: 'industrial-pc' }, // col 越界
        { col: 1, row: 1, itemType: 'laptop' },
      ],
    });
    const { items, removed } = remapPlacedItems(layer, 2, 2);
    expect(removed).toBe(1);
    expect(items.map((p) => p.col)).toEqual([1]);
  });

  it('无物品时保持空', () => {
    const layer = makeLayer({ id: 'shelf', type: 'shelf', layout: '3X2', placedItems: [] });
    expect(remapPlacedItems(layer, 1, 1).removed).toBe(0);
  });
});

describe('duplicateLayer — 复制层', () => {
  const base = makeLayer({
    id: 'shelf-1', type: 'shelf', elevation: 550, layout: '2X2',
    placedItems: [{ col: 0, row: 0, itemType: 'industrial-pc', scale: 1.2 }],
    ribCount: 3,
  });

  it('深拷贝：新 id、标高 +10、物品/布局/加强筋保留', () => {
    const copy = duplicateLayer(base);
    expect(copy.id).not.toBe(base.id);
    expect(copy.detail.elevation).toBe(560);
    expect(copy.detail.layout).toBe('2X2');
    expect(copy.detail.ribCount).toBe(3);
    expect(copy.detail.placedItems).toHaveLength(1);
    expect(copy.detail.placedItems[0].scale).toBe(1.2);
  });

  it('不共享引用：改副本不影响原层', () => {
    const copy = duplicateLayer(base);
    copy.detail.placedItems[0].scale = 3;
    copy.detail.layout = '9X9';
    expect(base.detail.placedItems[0].scale).toBe(1.2);
    expect(base.detail.layout).toBe('2X2');
  });

  it('物品数组逐项拷贝，不共享 PlacedItem 引用', () => {
    const copy = duplicateLayer(base);
    expect(copy.detail.placedItems[0]).not.toBe(base.detail.placedItems[0]);
  });
});
