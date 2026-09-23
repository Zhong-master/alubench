import { describe, expect, it } from 'vitest';
import { computeBom, bomToCsv } from '../bom';
import { DEFAULT_STATE } from '../../state';
import { makeFourLayerScene } from '../../geometry/__tests__/helpers';

describe('BOM CSV 导出', () => {
  const state = { ...DEFAULT_STATE, layers: Object.values(makeFourLayerScene()) };
  const csv = bomToCsv(computeBom(state));
  const lines = csv.replace(/^\ufeff/, '').split('\r\n');

  it('首行是表头且含采购关键词列', () => {
    expect(lines[0]).toBe('类别,规格,长度(mm),数量,合计(mm),采购关键词');
  });

  it('保留 UTF-8 BOM（Excel 打开不乱码）', () => {
    expect(csv.startsWith('\ufeff')).toBe(true);
  });

  it('型材行的关键词可直接用于平台搜索（规格后段 + 铝型材 + 长度）', () => {
    const row = lines.find((l) => l.startsWith('型材,') && l.includes(',1600,'));
    expect(row).toBeTruthy();
    expect(row!.split(',')[5]).toBe('4040 铝型材 1600mm');
  });

  it('板材行的关键词含三维尺寸，且去掉内部 #N 编号', () => {
    const row = lines.find((l) => l.startsWith('板材,'));
    expect(row).toBeTruthy();
    const keyword = row!.split(',')[5];
    expect(keyword).toMatch(/^顶板|^台面|^隔板|^底板/);
    expect(keyword).not.toContain('#');
    expect(keyword).toMatch(/×\d+×\d+mm$/);
  });

  it('每行列数与表头一致', () => {
    const cols = lines[0].split(',').length;
    for (const line of lines.slice(1)) {
      expect(line.split(',').length).toBe(cols);
    }
  });
});
