import type { BeamInstance } from './types';

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
