import type { AppState } from '../state';
import type { Layer } from '../components/LeftPanel';

/**
 * BOM / 切割清单生成器
 *
 * 从参数层（dimensions / profile / columns / layers）直接计算型材下料清单与板材清单，
 * 复刻 SceneView.tsx 的几何生成逻辑（单位统一为 mm），不依赖 3D 场景渲染结果。
 * 保证：编辑器看到什么，BOM 就列出什么。
 */

export interface BomProfileRow {
  spec: string; // 型材规格，如 "GB-4040" 或层板自定义 profileType
  length: number; // 下料长度 (mm)
  count: number;
}

export interface BomBoardRow {
  label: string; // 层板名称（顶板/台面/隔板 #1/底板）
  length: number;
  width: number;
  thickness: number;
}

export interface BomResult {
  profiles: BomProfileRow[]; // 按 (spec, length) 聚合，长度降序
  boards: BomBoardRow[];
  totalProfileCount: number;
  totalProfileLength: number; // 所有型材下料长度合计 (mm)
}

/** 解析 profileType 字符串中的规格数字（如 "GB-4040" → 40） */
function profileMMOf(raw: string): number {
  const parts = raw.split('-');
  const numStr = parts[parts.length - 1]?.substring(0, 2) || '';
  return parseInt(numStr, 10) || 0;
}

export function computeBom(state: AppState): BomResult {
  const { dimensions, profile, columns, layers } = state;
  const W = dimensions.width;
  const D = dimensions.depth;
  const H = dimensions.height;

  const globalMM = profileMMOf(profile[1] || '') || 40;
  const globalSpec = profile[0] ? `${profile[0]}-${profile[1]}` : '自定义';

  // 该层型材规格（mm）与显示名
  const layerMM = (l: Layer) => profileMMOf(l.detail.profileType) || globalMM;
  const layerSpec = (l: Layer) => l.detail.profileType || globalSpec;

  const parts: Array<{ spec: string; length: number }> = [];
  const boards: BomBoardRow[] = [];

  // ── 顶板立杆连接 & 角柱截断 (与 SceneView 一致) ──
  const topLayer = layers.find((l) => l.type === 'top');
  const cols = topLayer?.detail.topColumns ?? { fl: true, fr: true, bl: true, br: true };
  const topElev = topLayer ? topLayer.detail.elevation : H;
  const fullWidthLayers = layers
    .filter((l) => l.type !== 'top' && l.detail.elevation < topElev - 1 && l.detail.frontConnect === 'extend')
    .sort((a, b) => b.detail.elevation - a.detail.elevation);
  const capY = fullWidthLayers.length > 0
    ? fullWidthLayers[0].detail.elevation - fullWidthLayers[0].detail.thickness / 2
    : H;

  // 各面额外立柱截止标高
  const getFaceCap = (side: 'front' | 'back' | 'left' | 'right'): number => {
    const capId = columns[(side + 'Cap') as 'frontCap'];
    if (!capId) return H;
    const capLayer = layers.find((l) => l.id === capId);
    return capLayer ? capLayer.detail.elevation : H;
  };

  // ── 4 根角柱 ──
  const cornerKeys: Array<keyof typeof cols> = ['fl', 'fr', 'bl', 'br'];
  for (const key of cornerKeys) {
    const fullH = cols[key] !== false;
    parts.push({ spec: globalSpec, length: fullH ? H : capY });
  }

  // ── 底部横梁 ──
  const bf = columns.bottomFrame || 'full';
  if (bf === 'full' || bf === 'frontback') {
    parts.push({ spec: globalSpec, length: W - globalMM });
    parts.push({ spec: globalSpec, length: W - globalMM });
  }
  if (bf === 'full' || bf === 'leftright') {
    parts.push({ spec: globalSpec, length: D - globalMM });
    parts.push({ spec: globalSpec, length: D - globalMM });
  }

  // ── 顶面/底面横向加强筋 ──
  for (let i = 0; i < columns.top; i++) parts.push({ spec: globalSpec, length: D - globalMM });
  for (let i = 0; i < columns.bottom; i++) parts.push({ spec: globalSpec, length: D - globalMM });

  // ── 四面额外立柱 ──
  const addCols = (count: number, side: 'front' | 'back' | 'left' | 'right') => {
    const capped =
      (side === 'front' && (cols.fl === false || cols.fr === false)) ||
      (side === 'back' && (cols.bl === false || cols.br === false)) ||
      (side === 'left' && (cols.fl === false || cols.bl === false)) ||
      (side === 'right' && (cols.fr === false || cols.br === false));
    const cornerCap = capped ? capY : H;
    const faceCap = getFaceCap(side);
    const pillarCap = Math.min(cornerCap, faceCap);
    const h = Math.max(pillarCap - globalMM, 10); // 对齐 SceneView 的 Math.max(pillarCap - t, 0.01)
    for (let i = 0; i < count; i++) parts.push({ spec: globalSpec, length: h });
  };
  addCols(columns.front, 'front');
  addCols(columns.back, 'back');
  addCols(columns.left, 'left');
  addCols(columns.right, 'right');

  // ── 无顶板时顶部边框 ──
  const hasTop = layers.some((l) => l.type === 'top');
  if (!hasTop) {
    const tf = cols.fl !== false ? globalMM / 2 : -globalMM / 2;
    const tF = cols.fr !== false ? W - globalMM / 2 : W + globalMM / 2;
    const tb = cols.bl !== false ? globalMM / 2 : -globalMM / 2;
    const tB = cols.br !== false ? W - globalMM / 2 : W + globalMM / 2;
    parts.push({ spec: globalSpec, length: Math.round(tF - tf) });
    parts.push({ spec: globalSpec, length: Math.round(tB - tb) });
    parts.push({ spec: globalSpec, length: D - globalMM });
    parts.push({ spec: globalSpec, length: D - globalMM });
  }

  // ── 层板（板材 + 边框 + 连接型材 + 加强筋） ──
  for (const layer of layers) {
    const lx = layer.detail.length;
    const lz = layer.detail.width;
    const ly = layer.detail.elevation;
    const lt = layer.detail.thickness;
    const halign = layer.detail.halign || 'left';
    const zOff = halign === 'left' ? 0 : halign === 'right' ? D - lz : (D - lz) / 2;

    // 板材（所有层：顶板/台面/隔板/底板）
    const shelfIdx = layers.filter((l) => l.type === 'shelf').indexOf(layer) + 1;
    const label =
      layer.type === 'top' ? '顶板' :
      layer.type === 'countertop' ? '台面' :
      layer.type === 'bottom' ? '底板' : `隔板 #${shelfIdx}`;
    boards.push({ label, length: lx, width: lz, thickness: lt });

    const isFrame = layer.type === 'countertop' || layer.type === 'shelf' || layer.type === 'top';
    if (!isFrame) continue;
    const spec = layerSpec(layer);
    const pt = layerMM(layer);
    const fc = layer.detail.frontConnect || 'extend';

    // 边框 4 根
    const isFull = lz >= D - 1;
    const connect = isFull ? 'extend' : (fc === 'up' || fc === 'down' || fc === 'drop' || fc === 'none') ? 'none' : 'extend';
    const lrLen = connect === 'extend' ? D - globalMM : lz;
    parts.push({ spec, length: lx - pt });
    parts.push({ spec, length: lx - pt });
    parts.push({ spec, length: lrLen });
    parts.push({ spec, length: lrLen });

    // 上连型材（up / drop）
    if (fc === 'up' || fc === 'drop') {
      const above = layers
        .filter((l) => l.detail.elevation > ly + 1 && (l.type === 'countertop' || l.type === 'shelf' || l.type === 'top'))
        .sort((a, b) => a.detail.elevation - b.detail.elevation)[0];
      if (above) {
        const aly = above.detail.elevation;
        const alt = above.detail.thickness;
        const abovePT = layerMM(above);
        const aboveExtends = above.detail.width >= D - 1 || above.detail.frontConnect === 'extend';
        const dropTop = above.type === 'top' ? aly - alt / 2 : aly - alt / 2 - abovePT;
        const dropH = Math.max(dropTop - (ly - lt / 2), 1);
        if (aboveExtends && zOff + lz < D - 1) {
          parts.push({ spec, length: D - (zOff + lz) });
          parts.push({ spec, length: D - (zOff + lz) });
        }
        if (aboveExtends && zOff > 1) {
          parts.push({ spec, length: zOff });
          parts.push({ spec, length: zOff });
        }
        parts.push({ spec, length: dropH });
        parts.push({ spec, length: dropH });
        if (aboveExtends) {
          parts.push({ spec, length: dropH });
          parts.push({ spec, length: dropH });
        }
      }
    }

    // 下连型材（down）
    if (fc === 'down') {
      const below = [...layers]
        .reverse()
        .find((l) => l.detail.elevation < ly - 1 && (l.type === 'countertop' || l.type === 'shelf' || l.type === 'bottom'));
      if (below) {
        const bly = below.detail.elevation;
        const blt = below.detail.thickness;
        const belowPT = layerMM(below);
        const belowExtends = below.detail.width >= D - 1 || below.detail.frontConnect === 'extend';
        const dropBot = below.type === 'bottom' ? bly + blt / 2 : bly + blt / 2 + belowPT;
        const dropH = Math.max((ly - lt / 2) - dropBot, 1);
        if (belowExtends && zOff + lz < D - 1) {
          parts.push({ spec, length: D - (zOff + lz) });
          parts.push({ spec, length: D - (zOff + lz) });
        }
        if (belowExtends && zOff > 1) {
          parts.push({ spec, length: zOff });
          parts.push({ spec, length: zOff });
        }
        parts.push({ spec, length: dropH });
        parts.push({ spec, length: dropH });
        if (belowExtends) {
          parts.push({ spec, length: dropH });
          parts.push({ spec, length: dropH });
        }
      }
    }

    // 加强筋
    const ribN = layer.detail.ribCount || 0;
    const ribDir = layer.detail.ribDirection || 'x';
    for (let i = 0; i < ribN; i++) {
      parts.push({ spec, length: ribDir === 'x' ? lx - pt : lz - pt });
    }
  }

  // ── 聚合：按 (spec, length) 计数 ──
  const grouped = new Map<string, { spec: string; length: number; count: number }>();
  for (const p of parts) {
    const key = `${p.spec}|${p.length}`;
    const e = grouped.get(key) ?? { spec: p.spec, length: p.length, count: 0 };
    e.count += 1;
    grouped.set(key, e);
  }
  const profiles = [...grouped.values()].sort((a, b) => b.length - a.length || a.spec.localeCompare(b.spec));
  const totalProfileCount = profiles.reduce((s, r) => s + r.count, 0);
  const totalProfileLength = profiles.reduce((s, r) => s + r.count * r.length, 0);

  return { profiles, boards, totalProfileCount, totalProfileLength };
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
