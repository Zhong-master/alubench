import { describe, it, expect } from 'vitest';
import { DEFAULT_STATE, normalizeAppState, isAppState } from '../state';
import { buildSceneGeometry } from '../geometry';
import { computeBom } from '../utils/bom';
import { makeFourLayerScene } from '../geometry/__tests__/helpers';

/** 标准四层场景的 AppState */
function fourLayerState() {
  return { ...DEFAULT_STATE, layers: Object.values(makeFourLayerScene()) };
}

describe('normalizeAppState — 工程文件反序列化归一化', () => {
  it('合法工程文件：字段完整保留', () => {
    const state = fourLayerState();
    const norm = normalizeAppState(JSON.parse(JSON.stringify(state)));
    expect(norm).not.toBeNull();
    expect(norm!.droppedLayers).toBe(0);
    expect(norm!.state.dimensions).toEqual(state.dimensions);
    expect(norm!.state.profile).toEqual(state.profile);
    expect(norm!.state.layers).toHaveLength(4);
    expect(norm!.state.layers[0].detail.topColumns).toEqual({ fl: true, fr: true, bl: true, br: true });
  });

  it('旧工程文件里的遗留 items 字段：忽略而非报错（字段已删除）', () => {
    const legacy = {
      dimensions: { width: 1600, depth: 850, height: 1600 },
      profile: ['GB', '4040'],
      columns: { front: 0, back: 0, left: 0, right: 0, top: 0, bottom: 0 },
      layers: [
        {
          id: 'shelf1', type: 'shelf', label: '隔板', color: '#4f8cff',
          // v1.x 曾用过字符串数组形式的 items（与 placedItems 无关，已废弃）
          detail: { elevation: 550, thickness: 10, layout: '3X2', items: ['pda', 'printer'] },
        },
      ],
    };
    const norm = normalizeAppState(legacy);
    expect(norm).not.toBeNull();
    expect(norm!.droppedLayers).toBe(0);
    expect(norm!.state.layers).toHaveLength(1);
    expect('items' in norm!.state.layers[0].detail).toBe(false);
    expect(() => buildSceneGeometry(norm!.state)).not.toThrow();
    expect(() => computeBom(norm!.state)).not.toThrow();
  });

  it('旧版文件缺 placedItems / topColumns / bottomFrame：补默认值而非白屏', () => {
    // 模拟 v1.0 工程文件：层只有裸参数，没有 placedItems / topColumns
    const legacy = {
      dimensions: { width: 1800, depth: 800, height: 2000 },
      profile: ['GB', '4040'],
      columns: { front: 0, back: 0, left: 0, right: 0, top: 0, bottom: 0 },
      layers: [
        { id: 'top', type: 'top', label: '顶板', color: '#999999', detail: { elevation: 2000, thickness: 10 } },
        {
          id: 'shelf1', type: 'shelf', label: '隔板', color: '#4f8cff',
          detail: { elevation: 550, thickness: 10, layout: '3X2' },
        },
      ],
    };
    const norm = normalizeAppState(legacy);
    expect(norm).not.toBeNull();
    expect(norm!.droppedLayers).toBe(0);
    expect(norm!.state.columns.bottomFrame).toBe('full'); // 缺省补 full
    expect(norm!.state.layers[1].detail.placedItems).toEqual([]);
    expect(norm!.state.layers[1].detail.topColumns).toEqual({ fl: true, fr: true, bl: true, br: true });
    expect(norm!.state.layers[1].detail.ribCount).toBe(0);
    expect(norm!.state.layers[1].detail.halign).toBe('left');
    // 关键：归一化后几何/校验/BOM 均可安全运行（此前会因 placedItems undefined 抛异常白屏）
    expect(() => buildSceneGeometry(norm!.state)).not.toThrow();
    expect(() => computeBom(norm!.state)).not.toThrow();
  });

  it('无法识别的层类型被丢弃并计数', () => {
    const state = fourLayerState();
    const raw = {
      ...state,
      layers: [...state.layers, { id: 'x', type: 'stair', detail: {} }, null, 42],
    };
    const norm = normalizeAppState(raw);
    expect(norm!.state.layers).toHaveLength(4);
    expect(norm!.droppedLayers).toBe(3);
  });

  it('非法布局串被清空，物品随之清空（避免 NaN 网格）', () => {
    const state = fourLayerState();
    const shelf = state.layers.find((l) => l.type === 'shelf')!;
    const raw = {
      ...state,
      layers: state.layers.map((l) =>
        l.id === shelf.id
          ? { ...l, detail: { ...l.detail, layout: '3x2', placedItems: [{ col: 0, row: 0, itemType: 'printer' }] } }
          : l
      ),
    };
    const norm = normalizeAppState(raw);
    const fixed = norm!.state.layers.find((l) => l.id === shelf.id)!;
    expect(fixed.detail.layout).toBe('');
    expect(fixed.detail.placedItems).toEqual([]);
  });

  it('物品条目：越界坐标/未知类型丢弃，旋转吸附到 90 的倍数，缩放纠正为非正数', () => {
    const state = fourLayerState();
    const shelf = state.layers.find((l) => l.type === 'shelf')!;
    const raw = {
      ...state,
      layers: state.layers.map((l) =>
        l.id === shelf.id
          ? {
              ...l,
              detail: {
                ...l.detail,
                layout: '3X2',
                placedItems: [
                  { col: 0, row: 0, itemType: 'printer', rotation: 47, scale: 0 },
                  { col: -1, row: 0, itemType: 'printer' },        // 坐标非法
                  { col: 1, row: 1, itemType: 'not-an-item' },      // 类型未知
                  { col: 2, row: 1, itemType: 'pda', rotation: 270 },
                ],
              },
            }
          : l
      ),
    };
    const norm = normalizeAppState(raw);
    const items = norm!.state.layers.find((l) => l.id === shelf.id)!.detail.placedItems;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ col: 0, row: 0, itemType: 'printer', rotation: 90, scale: 1 });
    expect(items[1]).toMatchObject({ col: 2, row: 1, itemType: 'pda', rotation: 270 });
  });

  it('非工程文件返回 null（调用方提示格式错误）', () => {
    expect(normalizeAppState(null)).toBeNull();
    expect(normalizeAppState('hello')).toBeNull();
    expect(normalizeAppState(42)).toBeNull();
    expect(normalizeAppState([])).toBeNull();
    expect(normalizeAppState({})).toBeNull();
    expect(normalizeAppState({ foo: 1, bar: [1, 2] })).toBeNull();
  });

  it('只有 layers 的残缺文件也能加载（其余字段取默认）', () => {
    const norm = normalizeAppState({ layers: Object.values(makeFourLayerScene()) });
    expect(norm).not.toBeNull();
    expect(norm!.state.dimensions).toEqual(DEFAULT_STATE.dimensions);
    expect(norm!.state.profile).toEqual(DEFAULT_STATE.profile);
    expect(norm!.state.layers).toHaveLength(4);
  });

  it('isAppState 保持严格语义（顶层契约校验）', () => {
    expect(isAppState(fourLayerState())).toBe(true);
    expect(isAppState({ layers: [] })).toBe(false);
    expect(isAppState({ dimensions: { width: 1, depth: 1, height: 1 }, profile: [], columns: {}, layers: [] })).toBe(false);
  });
});
