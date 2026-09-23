import type { BeamInstance, BoardInstance } from './types';

/** BOM 型材行（按 spec + length 聚合） */
export interface BomProfileRow {
  spec: string;
  length: number;
  count: number;
}

/** 从型材实例聚合 BOM（按 spec+length 分组计数，长度降序） */
export function aggregateBom(beams: BeamInstance[]): BomProfileRow[] {
  const grouped = new Map<string, BomProfileRow>();
  for (const b of beams) {
    const key = `${b.spec}|${b.length}`;
    const row = grouped.get(key) ?? { spec: b.spec, length: b.length, count: 0 };
    row.count += 1;
    grouped.set(key, row);
  }
  return [...grouped.values()].sort((a, b) => b.length - a.length || a.spec.localeCompare(b.spec));
}

/** 型材总根数与下料总长度（mm） */
export function bomTotals(beams: BeamInstance[]): { count: number; length: number } {
  let count = 0;
  let length = 0;
  for (const b of beams) {
    count += 1;
    length += b.length;
  }
  return { count, length };
}

/** 板材清单的一行（相同规格与尺寸已合并，块数在 count） */
export interface BoardRow {
  label: string;
  length: number;
  width: number;
  thickness: number;
  count: number;
}

/**
 * 合并相同板材：`bom.boards` 是「一层一块」（每层一条 BoardInstance，便于 3D/导出逐层消费），
 * 但采购/下料清单里把两块同样的隔板列成两行没有意义 —— 这里按「名称 + 三维尺寸」合并成 × N。
 *
 * ⚠️ 名称里的「#1/#2」是编辑器内部编号（`shelfIndex` 派生），采购时是噪音，参与合并前先去掉：
 * 「隔板 #1」「隔板 #2」（同尺寸）→ 合并为 `隔板 × 2`；尺寸不同则仍是两行。
 *
 * ⚠️ 不要改 `bom.boards` 本身：现有测试与 3D/导出按层逐条消费它。
 */
export function aggregateBoards(boards: BoardInstance[]): BoardRow[] {
  const grouped = new Map<string, BoardRow>();
  for (const b of boards) {
    const label = b.label.replace(/#\s*\d+/g, '').trim();
    const key = `${label}|${b.length}|${b.width}|${b.thickness}`;
    const row = grouped.get(key);
    if (row) row.count += 1;
    else grouped.set(key, { label, length: b.length, width: b.width, thickness: b.thickness, count: 1 });
  }
  return [...grouped.values()];
}
