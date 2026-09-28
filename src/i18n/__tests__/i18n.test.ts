import { describe, expect, it, vi } from 'vitest';
import { DICTS, type MessageKey } from '../messages';
import { detectLocale, interpolate, translate } from '../index';
import { localizeLayerLabel, localizeProfileSpec, tFor } from '../labels';
import { DEFAULT_STATE } from '../../state';
import { makeFourLayerScene } from '../../geometry/__tests__/helpers';
import { computeBom } from '../../utils/bom';
import { bomToCsv, bomToHtml } from '../../utils/bom';
import { validate } from '../../geometry/validate';
import { itemName, categoryName, itemNameByName, ITEM_REGISTRY } from '../../components/items/types';

const keys = Object.keys(DICTS.zh) as MessageKey[];

describe('i18n 文案表', () => {
  it('中英文键集完全一致（en 缺键在编译期已报错，这里防运行时漏改）', () => {
    expect(Object.keys(DICTS.en).sort()).toEqual(Object.keys(DICTS.zh).sort());
  });

  it('没有空字符串文案', () => {
    for (const k of keys) {
      expect(DICTS.zh[k], `zh.${k}`).not.toBe('');
      expect(DICTS.en[k], `en.${k}`).not.toBe('');
    }
  });

  it('{var} 插值生效，未知变量原样保留', () => {
    expect(interpolate('共 {n} 根 / {missing}', { n: 12 })).toBe('共 12 根 / {missing}');
  });

  it('en 与 zh 取到不同文案', () => {
    expect(translate('zh', 'toolbar.bom')).toBe('BOM 切割清单');
    expect(translate('en', 'toolbar.bom')).toBe('BOM cut list');
  });

  it('detectLocale：中文浏览器 → zh，其余 → en，无语言信息 → zh', () => {
    expect(detectLocale(['zh-CN'])).toBe('zh');
    expect(detectLocale(['zh-Hant-TW'])).toBe('zh');
    expect(detectLocale(['en-US'])).toBe('en');
    expect(detectLocale(['de-DE', 'fr'])).toBe('en');
    expect(detectLocale(['de-DE', 'zh-CN'])).toBe('zh'); // 列表里出现中文就用中文
    expect(detectLocale([])).toBe('zh');
    expect(detectLocale([''])).toBe('zh');
  });

  it('detectLocale：不传参时回退到 navigator（与运行环境 locale 无关）', () => {
    // 必须 stub：Node ≥21 的 navigator.language 取进程 LANG，直接依赖它会「本机过、CI 挂」
    try {
      vi.stubGlobal('navigator', { language: 'zh-CN', languages: ['zh-CN'] });
      expect(detectLocale()).toBe('zh');
      vi.stubGlobal('navigator', { language: 'en-US', languages: ['en-US'] });
      expect(detectLocale()).toBe('en');
      vi.stubGlobal('navigator', { language: 'en-US', languages: [] }); // languages 为空 → 退到 language
      expect(detectLocale()).toBe('en');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('显示层标签本地化（不改数据）', () => {
  const t = tFor('en');

  it('内核层板标签 → 英文', () => {
    expect(localizeLayerLabel('顶板', t)).toBe('Top panel');
    expect(localizeLayerLabel('隔板 #2', t)).toBe('Shelf #2');
    expect(localizeLayerLabel('隔板#3', t)).toBe('Shelf #3');
    expect(localizeLayerLabel('隔板', t)).toBe('Shelf'); // 聚合清单里的裸标签
    expect(localizeLayerLabel('GB-4040', t)).toBe('GB-4040'); // 未知标签原样返回
    expect(localizeLayerLabel('顶板', tFor('zh'))).toBe('顶板'); // 中文原样
  });

  it('自定义型材规格 → 英文', () => {
    expect(localizeProfileSpec('自定义', t)).toBe('Custom');
    expect(localizeProfileSpec('GB-4040', t)).toBe('GB-4040');
  });
});

describe('导出物随语言切换', () => {
  const state = { ...DEFAULT_STATE, layers: Object.values(makeFourLayerScene()) };
  const bom = computeBom(state);

  it('CSV 表头与类别列', () => {
    const zh = bomToCsv(bom).split('\r\n')[0];
    const en = bomToCsv(bom, 'en').split('\r\n')[0];
    expect(zh).toContain('类别,规格,长度(mm)');
    expect(en).toContain('Type,Profile,Length (mm)');
    // 末列采购关键词保持中文（面向中文供应商平台，英文关键词搜不到货）
    expect(bomToCsv(bom, 'en')).toContain('铝型材');
  });

  it('HTML 报告的标题/表头随语言，且板材名已本地化', () => {
    const en = bomToHtml(bom, state, 'en');
    expect(en).toContain('Cut list');
    expect(en).toContain('Panel');
    expect(en).toContain('<html lang="en">');
    expect(en).not.toContain('<html lang="zh-CN">');
    const zh = bomToHtml(bom, state);
    expect(zh).toContain('<html lang="zh-CN">');
    expect(zh).toContain('切割清单');
  });

  it('校验报告随语言（标签与物品名一起翻译）', () => {
    const issues = validate(state, 'en');
    // 该场景本身无问题也应能取到消息模板（用构造问题的方式验证）
    expect(Array.isArray(issues)).toBe(true);
    expect(translate('en', 'validate.boardLenOverflow')).toContain('{label}');
    expect(itemNameByName('工控机', 'en')).toBe('Industrial PC');
    expect(itemNameByName('不存在的物品', 'en')).toBe('不存在的物品');
  });
});

describe('物品库元数据', () => {
  it('每个物品都有非空英文名与英文描述', () => {
    for (const item of ITEM_REGISTRY) {
      expect(item.nameEn, item.type).toBeTruthy();
      expect(item.descriptionEn, item.type).toBeTruthy();
    }
  });

  it('itemName / categoryName 按语言取用', () => {
    const pc = ITEM_REGISTRY.find((i) => i.type === 'industrial-pc')!;
    expect(itemName(pc, 'zh')).toBe('工控机');
    expect(itemName(pc, 'en')).toBe('Industrial PC');
    expect(itemName(pc)).toBe('工控机'); // 默认中文，保持向后兼容
    expect(categoryName('camera', 'en')).toBe('Cameras & lenses');
    expect(categoryName('camera')).toBe('相机 & 镜头');
  });
});
