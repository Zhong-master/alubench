/**
 * 采购直达（BOM → 平台搜索深链）
 *
 * ⚠️ 定位说明：这里**只生成各平台的搜索/商品页链接**，不涉及任何账号、报价或下单接口。
 * 公开可用的免费「下单 API」并不存在 —— 1688 / 淘宝 / 怡合达 / 米思米 的正式对接都需要
 * 商家账号与资质审核。因此本模块做的是「一键跳到对应平台的搜索结果页」（关键词 = 规格 +
 * 长度/尺寸），用户核对价格与货期后自行下单；同时提供可整段复制的采购清单文本，作为
 * 任何平台都能用的兜底路径。
 *
 * 链接格式于 2026-02 实测可访问（怡合达 /product/search/<关键词> 与米思米
 * /vona2/result/?searchWord=<关键词> 均返回 200；1688 / 淘宝 使用各自的通用搜索参数）。
 * 平台改版会让链接失效 —— 所以 UI 上「复制关键词」始终与链接并列提供。
 */

import type { Locale } from '../i18n';
import { tFor } from '../i18n/labels';

export interface ProcurementLink {
  /** 平台名称（短，用于表格里的小链接） */
  name: string;
  url: string;
}

/**
 * 型材规格 → 采购关键词。
 * 规格串形如 `GB-4040` / `GB-3030`，供应商页面上通用的是后段数字（4040 系列）。
 */
export function profileKeyword(spec: string, lengthMM: number): string {
  const seg = spec.includes('-') ? spec.split('-').filter(Boolean).pop() : spec;
  const code = (seg || spec).trim();
  return `${code} 铝型材 ${lengthMM}mm`;
}

/** 层板 → 采购关键词（尺寸写得越具体越容易被供应商的切板服务命中） */
export function boardKeyword(label: string, lengthMM: number, widthMM: number, thicknessMM: number): string {
  const dim = `${lengthMM}×${widthMM}×${thicknessMM}mm`;
  // 标签里的「#1」这类序号是编辑器内部编号，采购时是噪音，去掉
  const plain = label.replace(/#\s*\d+/g, '').trim();
  return `${plain} 铝板 ${dim}`.replace(/\s+/g, ' ');
}

/**
 * 平台列表：按"工业标准件对口程度"排序 —— 专业 FA 平台在前，通用批发/零售在后。
 * ⚠️ 搜索关键词**始终用中文**（`4040 铝型材 1600mm`）：这四个平台都是中文站点，
 * 英文关键词搜不到货。因此 en 界面只翻译平台显示名，不翻译关键词本身的生成逻辑。
 */
const PLATFORMS: { name: string; nameEn: string; build: (kw: string) => string }[] = [
  { name: '怡合达', nameEn: 'Yiheda', build: (kw) => `https://www.yhdfa.com/product/search/${encodeURIComponent(kw)}` },
  { name: '米思米', nameEn: 'Misumi', build: (kw) => `https://www.misumi.com.cn/vona2/result/?searchWord=${encodeURIComponent(kw)}` },
  { name: '1688', nameEn: '1688', build: (kw) => `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(kw)}` },
  { name: '淘宝', nameEn: 'Taobao', build: (kw) => `https://s.taobao.com/search?q=${encodeURIComponent(kw)}` },
];

/** 关键词 → 各平台搜索链接（平台显示名随界面语言） */
export function procurementLinks(keyword: string, locale: Locale = 'zh'): ProcurementLink[] {
  return PLATFORMS.map((p) => ({ name: locale === 'en' ? p.nameEn : p.name, url: p.build(keyword) }));
}

export function profileProcurementLinks(spec: string, lengthMM: number, locale: Locale = 'zh'): ProcurementLink[] {
  return procurementLinks(profileKeyword(spec, lengthMM), locale);
}

export function boardProcurementLinks(
  label: string,
  l: number,
  w: number,
  t: number,
  locale: Locale = 'zh'
): ProcurementLink[] {
  return procurementLinks(boardKeyword(label, l, w, t), locale);
}

/** 供复制/粘贴的采购清单行（不带链接，任何平台或聊天窗口都能直接贴） */
export interface ProcurementTextInput {
  profiles: { spec: string; length: number; count: number }[];
  /** 已合并相同板材的行（见 geometry 的 aggregateBoards），count = 块数 */
  boards: { label: string; length: number; width: number; thickness: number; count: number }[];
}

/**
 * 生成可整段复制的采购清单文本。
 * 每行包含「关键词 × 数量」，用户可直接粘贴给供应商询价。
 */
export function procurementText(input: ProcurementTextInput, locale: Locale = 'zh'): string {
  const t = tFor(locale);
  const lines: string[] = [t('procure.sectionProfiles')];
  for (const p of input.profiles) {
    lines.push(`${profileKeyword(p.spec, p.length)} × ${p.count} ${t('procure.unitPieces')}`);
  }
  if (input.boards.length) {
    lines.push('', t('procure.sectionBoards'));
    for (const b of input.boards) {
      lines.push(`${boardKeyword(b.label, b.length, b.width, b.thickness)} × ${b.count} ${t('procure.unitBoards')}`);
    }
  }
  return lines.join('\n');
}
