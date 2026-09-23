import type { Layer, LayerDetail, LayerType, PlacedItem } from './components/layerTypes';
import { LAYER_CONFIG, LAYER_TYPES, defaultLayerDetail } from './components/layerTypes';
import { ITEM_MAP } from './components/items/types';
import type { ItemType } from './components/items/types';

/** 骨架编辑状态（含立柱截止层与底部框架模式） */
export interface ColumnsState {
  front: number;
  back: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  bottomFrame: 'full' | 'frontback' | 'leftright' | 'none';
  frontCap: string;
  backCap: string;
  leftCap: string;
  rightCap: string;
}

/** 可持久化的全部场景数据（undo/redo、草稿、工程文件共享此结构） */
export interface AppState {
  dimensions: { width: number; depth: number; height: number };
  profile: string[];
  columns: ColumnsState;
  layers: Layer[];
}

export const DEFAULT_STATE: AppState = {
  dimensions: { width: 1600, depth: 850, height: 1600 },
  profile: ['GB', '4040'],
  columns: {
    front: 0,
    back: 0,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    bottomFrame: 'full',
    frontCap: '',
    backCap: '',
    leftCap: '',
    rightCap: '',
  },
  layers: [],
};

/** 校验反序列化数据是否为合法的 AppState（防御性加载） */
export function isAppState(v: unknown): v is AppState {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  const dims = s.dimensions as Record<string, unknown> | undefined;
  if (!dims || typeof dims.width !== 'number' || typeof dims.depth !== 'number' || typeof dims.height !== 'number') {
    return false;
  }
  if (!Array.isArray(s.profile)) return false;
  const cols = s.columns as Record<string, unknown> | undefined;
  if (!cols || typeof cols.front !== 'number' || typeof cols.bottomFrame !== 'string') return false;
  if (!Array.isArray(s.layers)) return false;
  return true;
}

// ── 反序列化归一化 ──────────────────────────────────────────────
// isAppState 只保证顶层可用；层内部的字段（尤其 placedItems）在旧版本工程文件里
// 可能缺失或类型不对，直接进入 buildSceneGeometry 会抛异常导致整页白屏。
// normalizeAppState 逐字段补默认值，并丢弃完全无法识别的层/物品。

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function normalizePlacedItem(v: unknown): PlacedItem | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const col = num(p.col, NaN);
  const row = num(p.row, NaN);
  const itemType = str(p.itemType, '');
  // col/row 必须是合法网格坐标；itemType 必须存在于物品注册表
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0) return null;
  if (!ITEM_MAP.has(itemType as ItemType)) return null;
  const scale = num(p.scale, 1);
  // 旋转量吸附到 0/90/180/270（UI 只按 90° 步进）
  const rotation = (((Math.round(num(p.rotation, 0) / 90) * 90) % 360) + 360) % 360;
  return {
    col,
    row,
    itemType: itemType as ItemType,
    rotation: rotation === 0 ? undefined : rotation,
    scale: scale > 0 ? scale : 1,
    flipX: bool(p.flipX, false),
    flipY: bool(p.flipY, false),
  };
}

/** 布局串是否可被 parseLayout 正确解析（'3X2'；列/行均 > 0） */
function validLayout(layout: string): boolean {
  const m = /^(\d+)X(\d+)$/.exec(layout);
  return !!m && Number(m[1]) > 0 && Number(m[2]) > 0;
}

function normalizeLayer(v: unknown, index: number): Layer | null {
  if (!v || typeof v !== 'object') return null;
  const l = v as Record<string, unknown>;
  // 层类型是几何/校验的分支依据，无法识别即丢弃该层
  if (typeof l.type !== 'string' || !(LAYER_TYPES as readonly string[]).includes(l.type)) return null;
  const type = l.type as LayerType;
  const rawDetail = (l.detail && typeof l.detail === 'object' ? l.detail : {}) as Record<string, unknown>;
  const base = defaultLayerDetail();
  const cols = (rawDetail.topColumns && typeof rawDetail.topColumns === 'object'
    ? rawDetail.topColumns
    : {}) as Record<string, unknown>;
  const layout = str(rawDetail.layout, '');
  const layoutOk = validLayout(layout);
  const placedItems = Array.isArray(rawDetail.placedItems)
    ? rawDetail.placedItems.map(normalizePlacedItem).filter((p): p is PlacedItem => p !== null)
    : [];
  const detail: LayerDetail = {
    ...base,
    length: num(rawDetail.length, base.length),
    width: num(rawDetail.width, base.width),
    elevation: num(rawDetail.elevation, base.elevation),
    thickness: num(rawDetail.thickness, base.thickness),
    // 布局格式非法（如 '3x2' / 'abc'）时清空，避免下游 split('X') 得到 NaN 网格
    layout: layoutOk ? layout : '',
    // 无有效布局时物品无处安放（与 handleLayoutChange 清空布局即清空物品一致）
    placedItems: layoutOk ? placedItems : [],
    locked: bool(rawDetail.locked, base.locked),
    profileType: str(rawDetail.profileType, ''),
    ribCount: Math.max(0, Math.round(num(rawDetail.ribCount, 0))),
    ribDirection: oneOf(rawDetail.ribDirection, ['x', 'z'] as const, 'x'),
    frontConnect: oneOf(rawDetail.frontConnect, ['extend', 'drop', 'up', 'down', 'none'] as const, 'extend'),
    halign: oneOf(rawDetail.halign, ['left', 'center', 'right'] as const, 'left'),
    topColumns: {
      fl: bool(cols.fl, true),
      fr: bool(cols.fr, true),
      bl: bool(cols.bl, true),
      br: bool(cols.br, true),
    },
  };
  const config = LAYER_CONFIG[type];
  return {
    id: str(l.id, `layer-${index}`),
    type,
    label: str(l.label, config.label),
    color: str(l.color, config.color),
    detail,
  };
}

/** normalizeAppState 结果：归一化后的状态 + 被丢弃的层数（供 UI 提示） */
export interface NormalizeResult {
  state: AppState;
  droppedLayers: number;
}

/**
 * 把任意反序列化数据归一化为可安全渲染的 AppState。
 *
 * 比 isAppState 宽松：旧版本工程文件缺少新字段（如 topColumns / placedItems / bottomFrame）
 * 时不再整体拒绝，而是逐字段补默认值；只有「完全不像工程文件」的输入才返回 null。
 */
export function normalizeAppState(v: unknown): NormalizeResult | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const s = v as Record<string, unknown>;
  // 至少要有工程文件的某个特征字段，否则视为选错了文件（如随便一个 .json）
  const looksLikeProject =
    (s.dimensions && typeof s.dimensions === 'object') ||
    Array.isArray(s.layers) ||
    Array.isArray(s.profile) ||
    (s.columns && typeof s.columns === 'object');
  if (!looksLikeProject) return null;

  const dims = (s.dimensions && typeof s.dimensions === 'object' ? s.dimensions : {}) as Record<string, unknown>;
  const cols = (s.columns && typeof s.columns === 'object' ? s.columns : {}) as Record<string, unknown>;
  const rawLayers = Array.isArray(s.layers) ? (s.layers as unknown[]) : [];
  const layers = rawLayers
    .map((l, i) => normalizeLayer(l, i))
    .filter((l): l is Layer => l !== null);
  const profile = Array.isArray(s.profile)
    ? (s.profile as unknown[]).filter((p): p is string => typeof p === 'string')
    : [];

  return {
    state: {
      dimensions: {
        width: num(dims.width, DEFAULT_STATE.dimensions.width),
        depth: num(dims.depth, DEFAULT_STATE.dimensions.depth),
        height: num(dims.height, DEFAULT_STATE.dimensions.height),
      },
      profile: profile.length >= 2 ? [profile[0], profile[1], ...profile.slice(2)] : DEFAULT_STATE.profile,
      columns: {
        front: num(cols.front, 0),
        back: num(cols.back, 0),
        left: num(cols.left, 0),
        right: num(cols.right, 0),
        top: num(cols.top, 0),
        bottom: num(cols.bottom, 0),
        bottomFrame: oneOf(cols.bottomFrame, ['full', 'frontback', 'leftright', 'none'] as const, 'full'),
        frontCap: str(cols.frontCap, ''),
        backCap: str(cols.backCap, ''),
        leftCap: str(cols.leftCap, ''),
        rightCap: str(cols.rightCap, ''),
      },
      layers,
    },
    droppedLayers: rawLayers.length - layers.length,
  };
}
