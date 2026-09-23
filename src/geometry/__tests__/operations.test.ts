import { describe, it, expect } from 'vitest';
import { parseLayout, remapPlacedItems, duplicateLayer, swapLayerElevations, isOrderableLayer } from '../operations';
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

describe('swapLayerElevations — 拖拽排序', () => {
  const shelfA = makeLayer({ id: 'shelf-a', type: 'shelf', elevation: 550 });
  const shelfB = makeLayer({ id: 'shelf-b', type: 'shelf', elevation: 1150 });
  const top = makeLayer({ id: 'top', type: 'top', elevation: 1600 });
  const bottom = makeLayer({ id: 'bottom', type: 'bottom', elevation: 40 });
  const layers = [top, shelfB, shelfA, bottom];

  it('交换两个隔板标高', () => {
    const next = swapLayerElevations(layers, 'shelf-a', 'shelf-b');
    expect(next.find((l) => l.id === 'shelf-a')!.detail.elevation).toBe(1150);
    expect(next.find((l) => l.id === 'shelf-b')!.detail.elevation).toBe(550);
    expect(next).not.toBe(layers);
  });

  it('不原地修改入参（撤销栈历史项不被污染）', () => {
    const snapshot = layers.map((l) => l.detail.elevation);
    swapLayerElevations(layers, 'shelf-a', 'shelf-b');
    expect(layers.map((l) => l.detail.elevation)).toEqual(snapshot);
    expect(shelfA.detail.elevation).toBe(550);
    expect(shelfB.detail.elevation).toBe(1150);
  });

  it('未参与交换的层保持同一引用（避免无谓重渲染）', () => {
    const next = swapLayerElevations(layers, 'shelf-a', 'shelf-b');
    expect(next.find((l) => l.id === 'top')).toBe(top);
    expect(next.find((l) => l.id === 'bottom')).toBe(bottom);
  });

  it('顶板/底板不可排序：原样返回同一引用', () => {
    expect(swapLayerElevations(layers, 'top', 'shelf-a')).toBe(layers);
    expect(swapLayerElevations(layers, 'shelf-a', 'bottom')).toBe(layers);
    expect(isOrderableLayer(top)).toBe(false);
    expect(isOrderableLayer(bottom)).toBe(false);
    expect(isOrderableLayer(shelfA)).toBe(true);
  });

  it('同层/未知 id/标高相同 → 原样返回', () => {
    expect(swapLayerElevations(layers, 'shelf-a', 'shelf-a')).toBe(layers);
    expect(swapLayerElevations(layers, 'shelf-a', 'nope')).toBe(layers);
    const twin = [shelfA, makeLayer({ id: 'shelf-c', type: 'shelf', elevation: 550 })];
    expect(swapLayerElevations(twin, 'shelf-a', 'shelf-c')).toBe(twin);
  });
});
