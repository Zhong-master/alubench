import type { Layer, LayerDetail } from '../../components/LeftPanel';

/** LayerDetail 字段名（供 makeLayer 将测试传入的 detail 字段映射到 detail 内） */
const DETAIL_KEYS = [
  'length', 'width', 'elevation', 'thickness', 'layout', 'items', 'placedItems',
  'locked', 'profileType', 'ribCount', 'ribDirection', 'frontConnect', 'halign', 'topColumns',
] as const;

type DetailPatch = Partial<Pick<LayerDetail, (typeof DETAIL_KEYS)[number]>>;

/** 构造一层（detail 字段可直接作为顶层参数传入，如 makeLayer({ id, type, elevation: 500 })） */
export function makeLayer(partial: { id: string; type: Layer['type'] } & Partial<Layer> & DetailPatch): Layer {
  const detail: LayerDetail = {
    length: 1600,
    width: 850,
    elevation: 0,
    thickness: 10,
    layout: '',
    items: [],
    placedItems: [],
    locked: false,
    profileType: '',
    ribCount: 0,
    ribDirection: 'x',
    frontConnect: 'extend',
    halign: 'left',
    topColumns: { fl: true, fr: true, bl: true, br: true },
  };
  for (const k of DETAIL_KEYS) {
    const v = (partial as Record<string, unknown>)[k];
    if (v !== undefined) (detail as unknown as Record<string, unknown>)[k] = v;
  }
  return {
    id: partial.id,
    type: partial.type,
    label: partial.label ?? '',
    color: partial.color ?? '#4f8cff',
    detail,
  };
}

/** 四层标准场景（与浏览器回归一致）：顶板/台面/隔板/底板 */
export function makeFourLayerScene() {
  return {
    top: makeLayer({ id: 'top', type: 'top', elevation: 1600, color: '#999999' }),
    countertop: makeLayer({ id: 'countertop', type: 'countertop', elevation: 800, color: '#2d6a2d' }),
    shelf: makeLayer({ id: 'shelf1', type: 'shelf', elevation: 550, color: '#4f8cff' }),
    bottom: makeLayer({ id: 'bottom', type: 'bottom', elevation: 40, color: '#333333' }),
  };
}
