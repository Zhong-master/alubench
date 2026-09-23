import { describe, it, expect } from 'vitest';
import { DEFAULT_STATE } from '../../state';
import { validate, validateGeometry } from '../validate';
import { buildSceneGeometry } from '../index';
import { makeFourLayerScene } from './helpers';

describe('validate — 干涉/越界校验', () => {
  it('标准四层场景无问题', () => {
    const state = { ...DEFAULT_STATE, layers: Object.values(makeFourLayerScene()) };
    expect(validate(state)).toEqual([]);
  });

  it('层板长度超出机架宽 → error', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.length = 2000; // 机架宽 1600
    const state = { ...DEFAULT_STATE, layers: Object.values(layers) };
    const issues = validate(state);
    const err = issues.find((i) => i.code === 'board-overflow');
    expect(err).toBeDefined();
    expect(err!.severity).toBe('error');
  });

  it('层板标高超出机架高 → error', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.elevation = 1650; // > 机架高 1600
    const state = { ...DEFAULT_STATE, layers: Object.values(layers) };
    expect(validate(state).some((i) => i.code === 'board-height-overflow')).toBe(true);
  });

  it('两层板标高重叠 → warning layer-collision', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.elevation = 800; // 与台面(800,厚10)重叠
    const state = { ...DEFAULT_STATE, layers: Object.values(layers) };
    expect(validate(state).some((i) => i.code === 'layer-collision')).toBe(true);
  });

  it('物品缩放后超出网格单元 → warning item-overflow', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.layout = '2X2';
    layers.shelf.detail.placedItems = [
      { col: 0, row: 0, itemType: 'printer', scale: 3 }, // 打印机 0.4×0.35，单元 0.8×0.425，3× 后超界
    ];
    const state = { ...DEFAULT_STATE, layers: Object.values(layers) };
    const issues = validate(state);
    expect(issues.some((i) => i.code === 'item-overflow')).toBe(true);
  });

  it('物品默认缩放不越界（尺寸真实但仍合理填充）', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.layout = '2X2';
    layers.shelf.detail.placedItems = [{ col: 0, row: 0, itemType: 'printer' }];
    const state = { ...DEFAULT_STATE, layers: Object.values(layers) };
    expect(validate(state).some((i) => i.code === 'item-overflow')).toBe(false);
  });

  it('默认放置：物品按净空自适应，不报与上层板的干涉', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.layout = '2X2';
    layers.shelf.detail.placedItems = [{ col: 0, row: 0, itemType: 'printer' }];
    const state = { ...DEFAULT_STATE, layers: Object.values(layers) };
    expect(validate(state).some((i) => i.code === 'item-clearance')).toBe(false);
  });

  it('用户放大导致穿透上方层板 → warning item-clearance（含层名与超出量）', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.layout = '2X2';
    layers.shelf.detail.placedItems = [{ col: 0, row: 0, itemType: 'printer', scale: 2 }];
    const state = { ...DEFAULT_STATE, layers: Object.values(layers) };
    const issue = validate(state).find((i) => i.code === 'item-clearance');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.message).toContain('台面');
    expect(issue!.message).toMatch(/\d+mm/);
  });

  it('顶板上的物品不受机架高度限制（上方无层不报净空）', () => {
    const layers = makeFourLayerScene();
    layers.top.detail.layout = '1X1';
    layers.top.detail.placedItems = [{ col: 0, row: 0, itemType: 'printer', scale: 3 }];
    const state = { ...DEFAULT_STATE, layers: Object.values(layers) };
    expect(validate(state).some((i) => i.code === 'item-clearance')).toBe(false);
  });

  it('同一层多个物品穿透时只报一次（取最深者）', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.layout = '2X2';
    layers.shelf.detail.placedItems = [
      { col: 0, row: 0, itemType: 'printer', scale: 2 },
      { col: 1, row: 1, itemType: 'printer', scale: 3 },
    ];
    const state = { ...DEFAULT_STATE, layers: Object.values(layers) };
    const issues = validate(state).filter((i) => i.code === 'item-clearance');
    expect(issues).toHaveLength(1);
  });

  it('validateGeometry（UI 复用一份几何）与 validate 结果一致', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.layout = '2X2';
    layers.shelf.detail.placedItems = [{ col: 0, row: 0, itemType: 'printer', scale: 3 }];
    layers.top.detail.length = 2000;
    const state = { ...DEFAULT_STATE, layers: Object.values(layers) };
    const geo = buildSceneGeometry(state);
    expect(validateGeometry(state, geo)).toEqual(validate(state));
    expect(validateGeometry(state, geo).length).toBeGreaterThan(0);
  });
});
