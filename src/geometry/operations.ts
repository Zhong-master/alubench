import type { Layer, PlacedItem } from '../components/layerTypes';

/** 解析布局字符串 '3X2' → [3, 2]；无效返回 null */
export function parseLayout(layout: string): [number, number] | null {
  if (!layout) return null;
  const [cols, rows] = layout.split('X').map(Number);
  if (!cols || !rows) return null;
  return [cols, rows];
}

/**
 * 网格布局变更时的物品重映射：
 * - 新布局能容纳的物品（col < newCols && row < newRows）保留
 * - 越界物品移除（返回被移除物品数量）
 * 纯函数，供 App.handleLayoutChange 与单测使用。
 */
export function remapPlacedItems(
  layer: Layer,
  newCols: number,
  newRows: number,
): { items: PlacedItem[]; removed: number } {
  const kept: PlacedItem[] = [];
  let removed = 0;
  for (const p of layer.detail.placedItems) {
    if (p.col < newCols && p.row < newRows) {
      kept.push(p);
    } else {
      removed += 1;
    }
  }
  return { items: kept, removed };
}

/**
 * 复制层：深拷贝 detail（含 placedItems/layout），新 id（crypto.randomUUID），标高 +10mm 错开原层。
 * 仅 countertop / shelf 可复制（顶板/底板 maxCount=1 由调用方约束）。
 * 纯函数，供 LeftPanel 复制按钮与单测使用。
 */
export function duplicateLayer(layer: Layer): Layer {
  const copy: Layer = {
    ...layer,
    id: `${layer.type}-copy-${crypto.randomUUID()}`,
    detail: {
      ...layer.detail,
      elevation: layer.detail.elevation + 10,
      placedItems: layer.detail.placedItems.map((p) => ({ ...p })),
      topColumns: layer.detail.topColumns
        ? { ...layer.detail.topColumns }
        : { fl: true, fr: true, bl: true, br: true },
    },
  };
  return copy;
}

/** 可参与拖拽排序的层类型（顶板/底板位置固定，不参与排序） */
export function isOrderableLayer(layer: Layer): boolean {
  return layer.type === 'countertop' || layer.type === 'shelf';
}

/**
 * 拖拽排序：交换两个可排序层的标高（数组位置不变，显示顺序由标高决定）。
 *
 * 纯函数 —— 不修改入参。此前的实现直接在 updater 内给 `prev` 里的层对象赋值
 * （`moved.detail.elevation = ...`），而 `prev` 与撤销栈中的历史项是同一批对象，
 * 导致「拖拽一次后撤销无法恢复原状」。
 *
 * 不可排序 / id 不存在 / 同一层 / 标高相同 → 原样返回同一引用，
 * 调用方（App.updateLayers）据此跳过状态写入，不产生空的撤销步骤。
 */
export function swapLayerElevations(layers: Layer[], activeId: string, targetId: string): Layer[] {
  if (!activeId || !targetId || activeId === targetId) return layers;
  const active = layers.find((l) => l.id === activeId);
  const target = layers.find((l) => l.id === targetId);
  if (!active || !target || !isOrderableLayer(active) || !isOrderableLayer(target)) return layers;
  const activeElev = active.detail.elevation;
  const targetElev = target.detail.elevation;
  if (activeElev === targetElev) return layers;
  return layers.map((l) => {
    if (l.id === activeId) return { ...l, detail: { ...l.detail, elevation: targetElev } };
    if (l.id === targetId) return { ...l, detail: { ...l.detail, elevation: activeElev } };
    return l;
  });
}
