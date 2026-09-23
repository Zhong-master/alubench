import type { AppState } from '../state';
import { aggregateBom, aggregateBoards, bomTotals, buildSceneGeometry } from '../geometry';
import { boardKeyword, profileKeyword } from './procurement';
import type { BoardInstance, BomProfileRow, SceneGeometry } from '../geometry';
import type { Locale } from '../i18n';
import { localizeLayerLabel, localizeProfileSpec, tFor } from '../i18n/labels';

/**
 * BOM / 切割清单生成器
 *
 * 从参数层（dimensions / profile / columns / layers）计算，几何逻辑全部委托给共享几何内核
 * （src/geometry/），与 SceneView.tsx / exportHtml.ts 消费同一份 BeamInstance/BoardInstance。
 * 保证：编辑器看到什么，BOM 就列出什么。
 */

export interface BomResult {
  /** 型材下料清单（规格×长度×数量，长度降序） */
  profiles: BomProfileRow[];
  /** 板材清单 */
  boards: BoardInstance[];
  /** 型材总根数 */
  totalProfileCount: number;
  /** 型材下料长度合计（mm） */
  totalProfileLength: number;
}

/**
 * 从**已有**几何内核结果聚合 BOM。
 *
 * UI 每次状态变更只需算一次 `buildSceneGeometry`，BOM / 校验 / 3D 场景共用同一份实例，
 * 避免同一状态被重复计算三遍（大场景下每次拖拽都要多算两次全量几何）。
 */
export function computeBomFromGeometry(geo: SceneGeometry): BomResult {
  const allBeams = geo.frameBeams.concat(geo.layers.flatMap((l) => l.beams));
  const profiles = aggregateBom(allBeams);
  const { count, length } = bomTotals(allBeams);
  return {
    profiles,
    boards: geo.layers.map((l) => l.board),
    totalProfileCount: count,
    totalProfileLength: length,
  };
}

/** 从参数层直接计算（单测/独立调用入口；内部自建几何，UI 请用 `computeBomFromGeometry`） */
export function computeBom(state: AppState): BomResult {
  return computeBomFromGeometry(buildSceneGeometry(state));
}

// ── 导出格式 ──

/** CSV 下载（UTF-8 BOM，Excel/WPS 直接打开中文不乱码） */
/** CSV 单元格转义：含逗号/引号/换行时按 RFC 4180 加引号（规格与名称理论上可能带这些字符） */
function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function bomToCsv(bom: BomResult, locale: Locale = 'zh'): string {
  const t = tFor(locale);
  const lines: string[] = [];
  // 末列「采购关键词」可直接粘进 1688/淘宝/怡合达/米思米 的搜索框，省去手工拼规格
  lines.push(t('csv.header'));
  for (const r of bom.profiles) {
    lines.push(
      [t('bom.typeProfile'), r.spec, r.length, r.count, r.count * r.length, profileKeyword(r.spec, r.length)]
        .map(csvCell)
        .join(',')
    );
  }
  // 板材合并后统计块数（原来一块一行，"数量"恒为 1，采购时无法直接下单）
  for (const b of aggregateBoards(bom.boards)) {
    lines.push(
      [
        t('bom.typeBoard'),
        `${localizeLayerLabel(b.label, t)} ${b.length}×${b.width}×${b.thickness}`,
        b.length,
        b.count,
        b.length * b.count,
        boardKeyword(b.label, b.length, b.width, b.thickness),
      ]
        .map(csvCell)
        .join(',')
    );
  }
  return '﻿' + lines.join('\r\n');
}

/** 自包含 HTML 报告（可打印、可分享） */
export function bomToHtml(bom: BomResult, state: AppState, locale: Locale = 'zh'): string {
  const t = tFor(locale);
  const dims = state.dimensions;
  const spec = localizeProfileSpec(state.profile[0] ? `${state.profile[0]}-${state.profile[1]}` : '自定义', t);
  const now = new Date().toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN');
  const profileRows = bom.profiles
    .map((r, i) => `<tr><td>${i + 1}</td><td>${r.spec}</td><td>${r.length}</td><td>${r.count}</td><td>${r.count * r.length}</td></tr>`)
    .join('');
  const boardRows = aggregateBoards(bom.boards)
    .map((b, i) => `<tr><td>${i + 1}</td><td>${localizeLayerLabel(b.label, t)}</td><td>${b.length} × ${b.width}</td><td>${b.thickness}</td><td>${b.count}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="${locale === 'en' ? 'en' : 'zh-CN'}">
<head>
<meta charset="UTF-8">
<title>${t('doc.reportTitle')}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font: 13px/1.6 "Microsoft YaHei", "PingFang SC", sans-serif; color: #222; padding: 24px; max-width: 860px; margin: 0 auto; }
h1 { font-size: 20px; margin-bottom: 4px; }
.sub { color: #888; font-size: 12px; margin-bottom: 16px; }
.meta { background: #f5f6f8; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
.meta b { color: #333; }
h2 { font-size: 15px; margin: 20px 0 8px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #e2e4e8; padding: 6px 10px; text-align: left; font-size: 13px; }
th { background: #f0f2f5; font-weight: 600; }
td.num, th.num { text-align: right; }
.summary { margin-top: 20px; padding: 12px 16px; background: #eef4ff; border-radius: 8px; font-size: 13px; }
@media print { body { padding: 8px; } .noprint { display: none; } }
</style>
</head>
<body>
<h1>${t('doc.reportH1')}</h1>
<div class="sub">${t('doc.reportGenerated', { time: now })}</div>
<div class="meta">
  ${t('doc.reportDims')}<b>${dims.width} × ${dims.depth} × ${dims.height} mm</b>
  &nbsp;·&nbsp; ${t('doc.reportProfile')}<b>${spec}</b>
  &nbsp;·&nbsp; ${t('doc.reportLayers')}<b>${state.layers.length}</b>
</div>
<h2>${t('doc.reportProfilesH2', { kinds: bom.profiles.length, count: bom.totalProfileCount })}</h2>
<table>
<thead><tr><th>#</th><th>${t('bom.colSpec')}</th><th class="num">${t('bom.colLength')}</th><th class="num">${t('bom.colCount')}</th><th class="num">${t('bom.colTotal')}</th></tr></thead>
<tbody>${profileRows}</tbody>
</table>
<h2>${t('doc.reportBoardsH2', { count: bom.boards.length })}</h2>
<table>
<thead><tr><th>#</th><th>${t('bom.colName')}</th><th>${t('doc.colSize')}</th><th class="num">${t('doc.colThickness')}</th><th class="num">${t('bom.colCount')}</th></tr></thead>
<tbody>${boardRows}</tbody>
</table>
<div class="summary">
  ${t('doc.summaryA')}<b>${bom.totalProfileCount}</b>${t('doc.summaryB')}<b>${(bom.totalProfileLength / 1000).toFixed(2)} m</b>${t('doc.summaryC')}
</div>
</body>
</html>`;
}
