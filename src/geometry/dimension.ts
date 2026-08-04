import type { Layer } from '../components/LeftPanel';

/**
 * 整体尺寸变化时对层数据的联动（纯函数，便于单元测试）。
 *
 * 规则（与历史实现一致）：
 * - 顶板标高跟随整体高度变化
 * - 标高超过新高度的层被截断到新高度，原始标高记入 capped（仅缩小高度时）
 * - 高度恢复时，被截断的层回到 min(原始标高, 新高度)，并清出 capped
 * - 所有层长宽跟随整体尺寸
 */
export function applyDimensionChange(
  layers: Layer[],
  oldH: number,
  newH: number,
  width: number,
  depth: number,
  capped: Map<string, number>,
): Layer[] {
  return layers.map((l) => {
    // 顶板标高跟随整体高度变化
    if (l.type === 'top' && l.detail.elevation === oldH) {
      if (capped.has(l.id)) capped.delete(l.id);
      return { ...l, detail: { ...l.detail, elevation: newH, length: width, width: depth } };
    }
    // 超过新高度 → 截断
    if (l.detail.elevation > newH) {
      if (oldH > newH && !capped.has(l.id)) {
        capped.set(l.id, l.detail.elevation);
      }
      return { ...l, detail: { ...l.detail, elevation: newH, length: width, width: depth } };
    }
    // 高度恢复 → 还原被截断层
    if (oldH < newH && capped.has(l.id)) {
      const orig = capped.get(l.id)!;
      if (l.detail.elevation === oldH) {
        capped.delete(l.id);
        const elev = Math.min(orig, newH);
        return { ...l, detail: { ...l.detail, elevation: elev, length: width, width: depth } };
      }
    }
    // 所有层跟随整体尺寸
    return { ...l, detail: { ...l.detail, length: width, width: depth } };
  });
}
