import type { AppState } from '../state';
import { aggregateBom, bomTotals, buildSceneGeometry } from '../geometry';
import type { BoardInstance, BomProfileRow } from '../geometry';

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

export function computeBom(state: AppState): BomResult {
  const geo = buildSceneGeometry(state);
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

// ── 导出格式 ──

/** CSV 下载（UTF-8 BOM，Excel/WPS 直接打开中文不乱码） */
export function bomToCsv(bom: BomResult): string {
  const lines: string[] = [];
  lines.push('类别,规格,长度(mm),数量,合计(mm)');
  for (const r of bom.profiles) {
    lines.push(`型材,${r.spec},${r.length},${r.count},${r.count * r.length}`);
  }
  for (const b of bom.boards) {
    lines.push(`板材,${b.label} ${b.length}×${b.width}×${b.thickness},${b.length},1,${b.length}`);
  }
  return '﻿' + lines.join('\r\n');
}

/** 自包含 HTML 报告（可打印、可分享） */
export function bomToHtml(bom: BomResult, state: AppState): string {
  const dims = state.dimensions;
  const spec = state.profile[0] ? `${state.profile[0]}-${state.profile[1]}` : '自定义';
  const now = new Date().toLocaleString('zh-CN');
  const profileRows = bom.profiles
    .map((r, i) => `<tr><td>${i + 1}</td><td>${r.spec}</td><td>${r.length}</td><td>${r.count}</td><td>${r.count * r.length}</td></tr>`)
    .join('');
  const boardRows = bom.boards
    .map((b, i) => `<tr><td>${i + 1}</td><td>${b.label}</td><td>${b.length} × ${b.width}</td><td>${b.thickness}</td><td>1</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>VisionAI 3D Workbench - 切割清单</title>
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
<h1>VisionAI 3D Workbench — 切割清单</h1>
<div class="sub">生成时间：${now}</div>
<div class="meta">
  整体尺寸：<b>${dims.width} × ${dims.depth} × ${dims.height} mm</b>
  &nbsp;·&nbsp; 主型材：<b>${spec}</b>
  &nbsp;·&nbsp; 层数：<b>${state.layers.length}</b>
</div>
<h2>型材下料清单（${bom.profiles.length} 种规格长度，共 ${bom.totalProfileCount} 根）</h2>
<table>
<thead><tr><th>#</th><th>规格</th><th class="num">长度 (mm)</th><th class="num">数量</th><th class="num">合计 (mm)</th></tr></thead>
<tbody>${profileRows}</tbody>
</table>
<h2>板材清单（${bom.boards.length} 块）</h2>
<table>
<thead><tr><th>#</th><th>名称</th><th>尺寸 (长 × 宽)</th><th class="num">厚度 (mm)</th><th class="num">数量</th></tr></thead>
<tbody>${boardRows}</tbody>
</table>
<div class="summary">
  型材总计：<b>${bom.totalProfileCount}</b> 根，下料长度合计 <b>${(bom.totalProfileLength / 1000).toFixed(2)} m</b>。
  以上为结构型材与层板框架，连接件（角件/螺栓/T型螺母）需按组装图纸另行配置。
</div>
</body>
</html>`;
}
