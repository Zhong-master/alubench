import { describe, expect, it } from 'vitest';
import { aggregateBoards } from '../aggregate';
import type { BoardInstance } from '../types';

const board = (label: string, length: number, width = 600, thickness = 10): BoardInstance => ({
  layerId: label,
  label,
  type: 'shelf',
  length,
  width,
  thickness,
  color: '#4f8cff',
  pos: [0, 0, 0],
  size: [length / 1000, thickness / 1000, width / 1000],
});

describe('板材合并（采购/下料清单用）', () => {
  it('相同名称与尺寸的板材合并为一块行，块数累加', () => {
    const rows = aggregateBoards([board('隔板 #1', 1200), board('隔板 #2', 1200), board('隔板 #3', 1200)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: '隔板', length: 1200, count: 3 });
  });

  it('尺寸不同则不合并（是不同的下料规格）', () => {
    const rows = aggregateBoards([board('隔板 #1', 1200), board('隔板 #2', 1000)]);
    expect(rows.map((r) => [r.length, r.count])).toEqual([[1200, 1], [1000, 1]]);
  });

  it('名称里的内部编号不参与合并键（隔板 #1 与 隔板 #9 同尺寸合并）', () => {
    const rows = aggregateBoards([board('隔板 #1', 800), board('隔板 #9', 800)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('隔板');
  });

  it('无编号的名称（顶板/台面/底板）原样保留，顺序按首次出现', () => {
    const rows = aggregateBoards([board('顶板', 1600), board('台面', 1600), board('顶板', 1600)]);
    expect(rows.map((r) => [r.label, r.count])).toEqual([['顶板', 2], ['台面', 1]]);
  });

  it('空清单返回空数组', () => {
    expect(aggregateBoards([])).toEqual([]);
  });
});
