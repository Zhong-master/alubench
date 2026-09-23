import type { LayerType } from '../components/layerTypes';
import type { ItemType } from '../components/items/types';

/**
 * 共享几何内核 — 统一的数据类型
 *
 * 三份实现（SceneView.tsx / exportHtml.ts / bom.ts）共同消费本模块生成的几何实例，
 * 根治几何算法漂移（历史 EXPORT-1~5 类回归）。所有几何计算以 mm 为输入基准，
 * 输出同时携带：渲染坐标（米，中心点 + 各向尺寸）与制造长度（mm，沿拉伸轴）。
 */

export type Face = 'front' | 'back' | 'left' | 'right';
export type CornerKey = 'fl' | 'fr' | 'bl' | 'br';

/** 顶板立杆连接状态 */
export interface TopColumns {
  fl: boolean;
  fr: boolean;
  bl: boolean;
  br: boolean;
}

/** 单根铝型材实例 */
export interface BeamInstance {
  /** BOM 规格名，如 'GB-4040' 或层板自定义 profileType */
  spec: string;
  /** 下料长度（mm，沿拉伸轴） */
  length: number;
  /** 渲染坐标：中心点（米） */
  pos: [number, number, number];
  /** 渲染坐标：各向尺寸（米） */
  size: [number, number, number];
}

/** 单块层板板材实例 */
export interface BoardInstance {
  layerId: string;
  label: string;
  type: LayerType;
  /** mm */
  length: number;
  /** mm */
  width: number;
  /** mm */
  thickness: number;
  color: string;
  /** 渲染坐标：中心点（米） */
  pos: [number, number, number];
  /** 渲染坐标：各向尺寸（米） */
  size: [number, number, number];
}

/** 已放置物品的占位实例（位置/缩放/旋转计算统一） */
export interface ItemPlacement {
  layerId: string;
  itemType: ItemType;
  /** 网格单元坐标（用于选中与交互） */
  col: number;
  row: number;
  /** 放置中心（米） */
  x: number;
  y: number;
  z: number;
  /** 绕 Y 轴旋转（度） */
  rotation: number;
  /** 基准缩放（由网格单元与物品尺寸计算，无 0.35 上限） */
  baseScale: number;
  /** 用户缩放 */
  userScale: number;
  /** 总缩放 = baseScale × userScale */
  scale: number;
  flipX: boolean;
  flipY: boolean;
  /** 物品原始尺寸（米）[长(X), 宽(Z), 高(Y)] */
  size: [number, number, number];
  /** 缩放后世界尺寸（米，取绝对值） */
  worldSize: [number, number, number];
}

/** 机架整体几何上下文（各几何构建函数的共享参数） */
export interface FrameContext {
  /** mm */
  W: number;
  /** mm */
  D: number;
  /** mm */
  H: number;
  /** 主型材截面边长（mm） */
  globalMM: number;
  /** 主型材规格名（'GB-4040' / '自定义'） */
  globalSpec: string;
  /** 顶板立杆连接状态 */
  cols: TopColumns;
  /** 未连接立柱的截断高度（mm，顶板下第一个 extend 层底） */
  capY: number;
  /** 各面额外立柱的截止高度（mm） */
  getFaceCap: (side: Face) => number;
  /** 无顶板时顶部边框是否按立杆连接补缺 */
  hasTop: boolean;
}

/** 单层几何构建结果 */
export interface LayerGeometry {
  layerId: string;
  /** 板材 */
  board: BoardInstance;
  /** 该层边框/连接/加强筋全部型材 */
  beams: BeamInstance[];
  /** 已放置物品占位 */
  placements: ItemPlacement[];
  /** 层板布局列数（无布局为 0） */
  gridCols: number;
  gridRows: number;
}

/** 全场景几何构建结果 */
export interface SceneGeometry {
  /** 机架级型材（角柱/横梁/立柱/顶底横梁/无顶板顶框） */
  frameBeams: BeamInstance[];
  /** 各层几何 */
  layers: LayerGeometry[];
}
