/**
 * 层数据模型（纯类型 + 常量，无 React / UI 依赖）。
 *
 * 从 LeftPanel.tsx 抽出：原先 `Layer` / `LayerDetail` 定义在组件文件里，
 * 使得任何需要「层」结构的纯逻辑模块（如 state.ts 的反序列化校验）
 * 都必须间接引入 Semi UI / React。LeftPanel 仍按原路径 re-export 全部符号，
 * 既有 `import ... from './LeftPanel'` 不受影响。
 */
import type { ItemType } from './items/types';

export type LayerType = 'top' | 'countertop' | 'shelf' | 'bottom';

export interface PlacedItem {
  col: number;
  row: number;
  itemType: ItemType;
  rotation?: number;     // 0 | 90 | 180 | 270
  scale?: number;        // 1 = 默认
  flipX?: boolean;
  flipY?: boolean;
}

export interface LayerDetail {
  length: number;
  width: number;
  elevation: number;
  thickness: number;
  layout: string;
  placedItems: PlacedItem[];
  locked: boolean;
  profileType: string;
  ribCount: number;
  ribDirection: 'x' | 'z';
  frontConnect: 'extend' | 'drop' | 'up' | 'down' | 'none';
  halign: 'left' | 'center' | 'right';
  topColumns: { fl: boolean; fr: boolean; bl: boolean; br: boolean };
}

export interface Layer {
  id: string;
  type: LayerType;
  label: string;
  color: string;
  detail: LayerDetail;
}

export const LAYER_CONFIG: Record<LayerType, { label: string; color: string; maxCount: number }> = {
  top: { label: '顶板', color: '#999999', maxCount: 1 },
  countertop: { label: '台面', color: '#2d6a2d', maxCount: 1 },
  shelf: { label: '隔板', color: '#4f8cff', maxCount: Infinity },
  bottom: { label: '底板', color: '#333333', maxCount: 1 },
};

export const LAYER_TYPES: ReadonlyArray<LayerType> = ['top', 'countertop', 'shelf', 'bottom'];

/** 层的默认参数（新建层 / 反序列化补全共用一份，避免两处默认值漂移） */
export function defaultLayerDetail(): LayerDetail {
  return {
    length: 1600,
    width: 850,
    elevation: 0,
    thickness: 10,
    layout: '',
    placedItems: [],
    locked: false,
    profileType: '',
    ribCount: 0,
    ribDirection: 'x',
    frontConnect: 'extend',
    halign: 'left',
    topColumns: { fl: true, fr: true, bl: true, br: true },
  };
}

/**
 * 可选的型材截面规格（截面边长即规格名的后四位）。
 * 左侧「型材型号」与右侧「边框型材」共用一份，避免两处列表漂移。
 */
export const PROFILE_SIZES = ['2020', '3030', '4040', '4545', '5050', '6060', '8080', '4080'];
