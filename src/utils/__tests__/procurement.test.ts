import { describe, expect, it } from 'vitest';
import {
  boardKeyword,
  boardProcurementLinks,
  procurementLinks,
  procurementText,
  profileKeyword,
  profileProcurementLinks,
} from '../procurement';

describe('采购关键词生成', () => {
  it('型材规格取后段数字（GB-4040 → 4040），并带上切割长度', () => {
    expect(profileKeyword('GB-4040', 1200)).toBe('4040 铝型材 1200mm');
    expect(profileKeyword('GB-3030', 600)).toBe('3030 铝型材 600mm');
  });

  it('规格无连字符时原样使用', () => {
    expect(profileKeyword('4040', 900)).toBe('4040 铝型材 900mm');
  });

  it('层板关键词去掉编辑器内部编号（#1），保留材质与三维尺寸', () => {
    expect(boardKeyword('隔板 #1', 1200, 600, 10)).toBe('隔板 铝板 1200×600×10mm');
    expect(boardKeyword('台面', 1400, 700, 18)).toBe('台面 铝板 1400×700×18mm');
  });
});

describe('平台搜索链接', () => {
  it('每个平台一个链接，关键词全部 URL 编码（含空格与中文）', () => {
    const links = procurementLinks('4040 铝型材 1200mm');
    expect(links).toHaveLength(4);
    expect(links.map((l) => l.name)).toEqual(['怡合达', '米思米', '1688', '淘宝']);
    for (const l of links) {
      expect(l.url).toContain('4040%20%E9%93%9D%E5%9E%8B%E6%9D%90%201200mm');
      expect(l.url.startsWith('https://')).toBe(true);
      // 编码后不应残留裸空格（否则部分平台会把参数截断）
      expect(l.url).not.toContain(' ');
    }
  });

  it('怡合达走路径参数、米思米走 searchWord、1688/淘宝走各自查询参数', () => {
    const byName = Object.fromEntries(profileProcurementLinks('GB-4040', 1200).map((l) => [l.name, l.url]));
    expect(byName['怡合达']).toMatch(/^https:\/\/www\.yhdfa\.com\/product\/search\//);
    expect(byName['米思米']).toMatch(/^https:\/\/www\.misumi\.com\.cn\/vona2\/result\/\?searchWord=/);
    expect(byName['1688']).toMatch(/^https:\/\/s\.1688\.com\/selloffer\/offer_search\.htm\?keywords=/);
    expect(byName['淘宝']).toMatch(/^https:\/\/s\.taobao\.com\/search\?q=/);
  });

  it('板材链接包含三维尺寸', () => {
    const links = boardProcurementLinks('隔板 #2', 1000, 500, 10);
    expect(links).toHaveLength(4);
    expect(decodeURIComponent(links[0].url)).toContain('隔板 铝板 1000×500×10mm');
  });
});

describe('可复制的采购清单文本', () => {
  it('型材与板材分节，每行含关键词与数量', () => {
    const txt = procurementText({
      profiles: [
        { spec: 'GB-4040', length: 1200, count: 4 },
        { spec: 'GB-3030', length: 600, count: 2 },
      ],
      boards: [{ label: '隔板 #1', length: 1000, width: 500, thickness: 10, count: 2 }],
    });
    expect(txt).toBe(
      [
        '【型材】',
        '4040 铝型材 1200mm × 4 根',
        '3030 铝型材 600mm × 2 根',
        '',
        '【板材】',
        '隔板 铝板 1000×500×10mm × 2 块',
      ].join('\n')
    );
  });

  it('没有板材时不出现空节标题', () => {
    const txt = procurementText({ profiles: [{ spec: 'GB-4040', length: 800, count: 1 }], boards: [] });
    expect(txt).toBe('【型材】\n4040 铝型材 800mm × 1 根');
    expect(txt).not.toContain('【板材】');
  });
});
