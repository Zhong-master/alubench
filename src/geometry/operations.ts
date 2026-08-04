import type { Layer, PlacedItem } from '../components/LeftPanel';

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
      items: [...layer.detail.items],
      topColumns: layer.detail.topColumns
        ? { ...layer.detail.topColumns }
        : { fl: true, fr: true, bl: true, br: true },
    },
  };
  return copy;
}
