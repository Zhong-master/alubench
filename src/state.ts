import type { Layer } from './components/LeftPanel';

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
