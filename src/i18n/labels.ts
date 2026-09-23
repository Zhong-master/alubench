import { translate, type Locale } from './index';
import type { MessageKey } from './messages';

/**
 * 显示层本地化助手
 *
 * 关键设计：**语言只影响显示，不影响数据**。
 * 几何内核 `boardLabel()` 产出的「顶板 / 台面 / 隔板 #3 / 底板」是**语言中立的数据**，
 * 会写进工程文件、BOM、导出快照。若把语言塞进内核，切换语言就会改写用户数据。
 * 因此内核保持不变，翻译只发生在**显示的最后一跳**（本文件）。
 *
 * 需要翻译的层板标签来自一个**封闭集合**（只有内核会生成它），所以这里做精确映射是可靠的：
 * 匹配不上就原样返回，绝不猜。
 */

/** 与 `I18nValue['t']` 同形（避免 i18n 反向依赖 UI 模块，这里直接声明） */
export type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

export const LAYER_TYPE_KEY: Record<'top' | 'countertop' | 'shelf' | 'bottom', MessageKey> = {
  top: 'layer.top',
  countertop: 'layer.countertop',
  shelf: 'layer.shelf',
  bottom: 'layer.bottom',
};

/** 给定 locale 造一个纯函数翻译器：给 BOM / 导出 / 校验等非 React 模块使用 */
export function tFor(locale: Locale): TFn {
  return (key, vars) => translate(locale, key, vars);
}

const DATA_LABEL_KEY: Record<string, MessageKey> = {
  顶板: 'layer.top',
  台面: 'layer.countertop',
  // 聚合板材清单（aggregateBoards）会把「隔板 #3」剥成裸「隔板」，所以两种形态都要覆盖
  隔板: 'layer.shelf',
  底板: 'layer.bottom',
};

/** 内核生成的层板标签 → 当前语言（`隔板 #3` → `Shelf #3`） */
export function localizeLayerLabel(label: string, t: TFn): string {
  const shelf = /^隔板\s*#\s*(\d+)$/.exec(label);
  if (shelf) return `${t('layer.shelf')} #${shelf[1]}`;
  const key = DATA_LABEL_KEY[label];
  return key ? t(key) : label;
}

/** 型材规格里的 '自定义' → 当前语言（其余规格如 GB-4040 与语言无关） */
export function localizeProfileSpec(spec: string, t: TFn): string {
  return spec === '自定义' ? t('common.custom') : spec;
}
