import type { Layer } from '../components/layerTypes';

/** 机架整体尺寸（applyDimensionChange 的输入形态） */
export interface RackDimensions {
  width: number;
  depth: number;
  height: number;
}

/**
 * 整体尺寸变化时对层数据的联动（纯函数，便于单元测试）。
 *
 * 标高规则（与历史实现一致）：
 * - 顶板标高跟随整体高度变化
 * - 标高超过新高度的层被截断到新高度，原始标高记入 capped（仅缩小高度时）
 * - 高度恢复时，被截断的层回到 min(原始标高, 新高度)，并清出 capped
 *
 * 长宽规则（**逐层、按轴**判断）：
 * - 锁定层（顶板/台面/底板默认锁定，见 LeftPanel 的 defaultLocked）：始终跟随新机架长宽
 * - 未锁定层中，原本就等于机架长/宽的那一轴：继续跟随（默认新建的隔板即如此）
 * - 其余：保留用户自定义的层尺寸，仅在新机架变小导致越界时收敛到机架尺寸
 *
 * 第三条是关键：此前无条件把所有层的长宽写成机架尺寸，用户给隔板设的局部尺寸
 * （配合「位置：靠左/居中/靠右」的窄搁板）会在改动机架尺寸时被静默清掉。
 */
export function applyDimensionChange(
  layers: Layer[],
  prev: RackDimensions,
  next: RackDimensions,
  capped: Map<string, number>,
): Layer[] {
  const oldH = prev.height;
  const newH = next.height;

  return layers.map((l) => {
    const d = l.detail;

    // 逐轴决定「跟随机架」还是「保留用户尺寸（不越界）」
    const followsLength = d.locked || d.length === prev.width;
    const followsDepth = d.locked || d.width === prev.depth;
    const size = {
      length: followsLength ? next.width : Math.min(d.length, next.width),
      width: followsDepth ? next.depth : Math.min(d.width, next.depth),
    };

    // 顶板标高跟随整体高度变化
    if (l.type === 'top' && d.elevation === oldH) {
      if (capped.has(l.id)) capped.delete(l.id);
      return { ...l, detail: { ...d, ...size, elevation: newH } };
    }
    // 超过新高度 → 截断
    if (d.elevation > newH) {
      if (oldH > newH && !capped.has(l.id)) {
        capped.set(l.id, d.elevation);
      }
      return { ...l, detail: { ...d, ...size, elevation: newH } };
    }
    // 高度恢复 → 还原被截断层
    if (oldH < newH && capped.has(l.id) && d.elevation === oldH) {
      const orig = capped.get(l.id)!;
      capped.delete(l.id);
      return { ...l, detail: { ...d, ...size, elevation: Math.min(orig, newH) } };
    }
    // 其余：仅同步长宽（按上面的跟随/保留规则）
    return { ...l, detail: { ...d, ...size } };
  });
}
