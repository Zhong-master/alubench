import { describe, it, expect } from 'vitest';
import { DEFAULT_STATE } from '../../state';
import { validate } from '../validate';
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
});
