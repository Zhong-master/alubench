import { describe, it, expect } from 'vitest';
import { DEFAULT_STATE } from '../../state';
import { buildSceneGeometry, boardLabel, shelfIndex } from '../index';
import { computeBom } from '../../utils/bom';
import { makeLayer, makeFourLayerScene } from './helpers';

/** 便捷：把四层场景 + 层数组拼成 state */
function stateWith(layers: ReturnType<typeof makeFourLayerScene> & Record<string, ReturnType<typeof makeLayer>>) {
  return { ...DEFAULT_STATE, layers: Object.values(layers) };
}

describe('buildFrameBeams — 机架级型材（复杂连接/立杆截断）', () => {
  it('默认四层：4 角柱全高（顶板立杆 fl/fr/bl/br 全勾选）', () => {
    const geo = buildSceneGeometry(stateWith(makeFourLayerScene()));
    const corners = geo.frameBeams.filter((b) => b.length === 1600 && b.size[1] > b.size[0]);
    expect(corners).toHaveLength(4);
  });

  it('顶板取消 fl/fr 后：该两角柱截断到 capY', () => {
    const layers = makeFourLayerScene();
    layers.top.detail.topColumns = { fl: false, fr: false, bl: true, br: true };
    const geo = buildSceneGeometry(stateWith(layers));
    // capY = 台面(800) - 厚/2 = 795；bl/br 全高 1600
    const full = geo.frameBeams.filter((b) => b.length === 1600);
    const capped = geo.frameBeams.filter((b) => b.length === 795);
    expect(full).toHaveLength(2);
    expect(capped).toHaveLength(2);
  });

  it('立柱截止层：前侧立柱高度 ≤ 截止层标高', () => {
    const layers = makeFourLayerScene();
    const state = {
      ...DEFAULT_STATE,
      columns: { ...DEFAULT_STATE.columns, front: 2, frontCap: 'shelf1' },
      layers: Object.values(layers),
    };
    const geo = buildSceneGeometry(state);
    // 前侧立柱 → z=D
    const frontCols = geo.frameBeams.filter((b) => Math.abs(b.pos[2] - 0.85) < 0.001 && b.size[1] > b.size[0] && b.length < 1600);
    expect(frontCols.length).toBeGreaterThan(0);
    for (const c of frontCols) {
      // 截止到 shelf1 标高 550
      expect(c.length).toBeLessThanOrEqual(550);
    }
  });

  it('无顶板时生成 4 根顶部边框', () => {
    const layers = makeFourLayerScene();
    const rest = Object.fromEntries(Object.entries(layers).filter(([k]) => k !== 'top')) as typeof layers;
    const state = stateWith(rest);
    // 4 角柱 + 4 底梁 + 4 顶框 = 12
    const geo = buildSceneGeometry(state);
    expect(geo.frameBeams).toHaveLength(12);
    // 顶框 4 根：2 根长边(W-40) + 2 根短边(D-40)
    const topFrame = geo.frameBeams.filter((b) => b.length === 1560 || b.length === 810).filter((b) => Math.abs(b.pos[1] - 1.58) < 0.01);
    expect(topFrame).toHaveLength(4);
  });
});

describe('buildLayerGeometry — 层板连接与加强筋', () => {
  it('frontConnect=up：连到上方最近一层（台面 800），不跨层直插顶板', () => {
    const layers = makeFourLayerScene();
    // 隔板(550) up 应连到台面(800)，而非顶板(1600)
    layers.shelf.detail.frontConnect = 'up';
    layers.shelf.detail.width = 600;
    const geo = buildSceneGeometry(stateWith(layers));
    const shelfGeom = geo.layers.find((l) => l.layerId === 'shelf1')!;
    // dropTop = 台面标高 800 - 台面厚/2 5 - 台面型材 40 = 755
    // dropBot = 隔板标高 550 - 隔板厚/2 5 = 545 → dropH = 210
    const uprights = shelfGeom.beams.filter((b) => b.size[1] > b.size[0]);
    expect(uprights.length).toBe(4);
    for (const u of uprights) {
      expect(u.length).toBe(210);
    }
  });

  it('frontConnect=up：中间隔板跳过多层，只看最近的上层', () => {
    // 顶板1600 / 隔板3 1450 / 隔板2 1150 / 台面800 / 隔板1 550 / 底板40
    const layers = {
      ...makeFourLayerScene(),
      shelf2: makeLayer({ id: 'shelf2', type: 'shelf', elevation: 1150 }),
      shelf3: makeLayer({ id: 'shelf3', type: 'shelf', elevation: 1450 }),
    };
    layers.shelf.detail.frontConnect = 'up';
    layers.shelf.detail.width = 600;
    const geo = buildSceneGeometry(stateWith(layers));
    const shelf1 = geo.layers.find((l) => l.layerId === 'shelf1')!;
    // 隔板1(550) 之上最近的是台面(800) → 210，而不是隔板2(1150)
    const up1 = shelf1.beams.filter((b) => b.size[1] > b.size[0]);
    expect(up1.every((b) => b.length === 210)).toBe(true);
  });

  it('frontConnect=down：连到下方最近一层（中间隔板对中间隔板）', () => {
    const layers = {
      ...makeFourLayerScene(),
      shelf2: makeLayer({ id: 'shelf2', type: 'shelf', elevation: 1150 }),
    };
    layers.shelf2.detail.frontConnect = 'down';
    layers.shelf2.detail.width = 600;
    const geo = buildSceneGeometry(stateWith(layers));
    const shelf2 = geo.layers.find((l) => l.layerId === 'shelf2')!;
    // 隔板2(1150) 之下最近的是台面(800)：dropBot = 800 + 5 + 40(台面型材) = 845
    // dropTop = 1150 - 5 = 1145 → dropH = 300（而非跨到底板）
    const uprights = shelf2.beams.filter((b) => b.size[1] > b.size[0]);
    expect(uprights.length).toBeGreaterThan(0);
    expect(uprights.every((b) => b.length === 300)).toBe(true);
  });

  it('层间连接与传入数组顺序无关（3D 降序 / BOM 插入顺序结果一致）', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.frontConnect = 'up';
    layers.shelf.detail.width = 600;
    const values = Object.values(layers);
    const ascending = [...values].sort((a, b) => a.detail.elevation - b.detail.elevation);
    const descending = [...values].sort((a, b) => b.detail.elevation - a.detail.elevation);
    const uprightLengths = (ls: typeof values) =>
      buildSceneGeometry({ ...DEFAULT_STATE, layers: ls })
        .layers.find((l) => l.layerId === 'shelf1')!
        .beams.filter((b) => b.size[1] > b.size[0])
        .map((b) => b.length)
        .sort((a, b) => a - b);
    expect(uprightLengths(ascending)).toEqual(uprightLengths(descending));
    expect(uprightLengths(descending)).toEqual([210, 210, 210, 210]);
  });

  it('frontConnect=down：向下连接到底板', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.frontConnect = 'down';
    layers.shelf.detail.width = 600;
    const geo = buildSceneGeometry(stateWith(layers));
    const shelfGeom = geo.layers.find((l) => l.layerId === 'shelf1')!;
    // 隔板1(550) 之下只有底板(40)：底板无边框，dropBot = 40 + 5 = 45
    // dropTop = 550 - 5 = 545 → dropH = 500
    const uprights = shelfGeom.beams.filter((b) => b.size[1] > b.size[0]);
    const drop = uprights.find((b) => b.length === 500);
    expect(drop).toBeDefined();
  });

  it('boardLabel：隔板编号按标高降序，与数组顺序无关', () => {
    const layers = makeFourLayerScene();
    const shuffled = [layers.shelf, layers.bottom, layers.top, layers.countertop];
    expect(boardLabel(layers.shelf, shuffled)).toBe('隔板 #1');
    const withTwo = {
      ...layers,
      shelf2: makeLayer({ id: 'shelf2', type: 'shelf', elevation: 1150 }),
    };
    const list = Object.values(withTwo);
    expect(boardLabel(withTwo.shelf2, list)).toBe('隔板 #1'); // 标高最高
    expect(boardLabel(withTwo.shelf, [...list].reverse())).toBe('隔板 #2');
  });

  it('shelfIndex：与 boardLabel 同源（导出/右侧面板/底栏共用一处编号）', () => {
    const layers = makeFourLayerScene();
    const withTwo = {
      ...layers,
      shelf2: makeLayer({ id: 'shelf2', type: 'shelf', elevation: 1150 }),
    };
    const list = Object.values(withTwo);
    expect(shelfIndex(withTwo.shelf2, list)).toBe(1);
    expect(shelfIndex(withTwo.shelf, list)).toBe(2);
    // 非隔板返回 0（调用方据此决定是否显示 #N）
    expect(shelfIndex(withTwo.top, list)).toBe(0);
    // 与 boardLabel 编号一致
    for (const l of [withTwo.shelf, withTwo.shelf2]) {
      expect(boardLabel(l, list)).toBe(`隔板 #${shelfIndex(l, list)}`);
    }
  });

  it('加强筋：ribCount=3 横向生成 3 根', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.ribCount = 3;
    layers.shelf.detail.ribDirection = 'x';
    const geo = buildSceneGeometry(stateWith(layers));
    const shelfGeom = geo.layers.find((l) => l.layerId === 'shelf1')!;
    const ribs = shelfGeom.beams.filter((b) => b.length === 1560); // 边框前后 2 + 加强筋 3
    expect(ribs).toHaveLength(5);
  });

  it('层板自定义 profileType：边框长度按该层截面减去', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.profileType = 'GB-3030';
    const geo = buildSceneGeometry(stateWith(layers));
    const shelfGeom = geo.layers.find((l) => l.layerId === 'shelf1')!;
    const beams = shelfGeom.beams;
    expect(beams.some((b) => b.length === 1570)).toBe(true); // 1600-30
  });

  it('层板自定义 profileType：截面尺寸与 BOM 规格同步跟随，清空后回落机架规格', () => {
    const layers = makeFourLayerScene();
    layers.shelf.detail.profileType = 'GB-3030';
    const geo = buildSceneGeometry(stateWith(layers));
    const border = geo.layers.find((l) => l.layerId === 'shelf1')!.beams.find((b) => b.length === 1570)!;
    expect(border.spec).toBe('GB-3030');
    expect(border.size[1]).toBeCloseTo(0.03, 6); // 边框截面 30mm（非机架 40mm）

    // 清空（UI 选「跟随机架」）→ 回到 GB-4040 / 40mm / 1560
    layers.shelf.detail.profileType = '';
    const geo2 = buildSceneGeometry(stateWith(layers));
    const beams2 = geo2.layers.find((l) => l.layerId === 'shelf1')!.beams;
    const border2 = beams2.find((b) => b.length === 1560)!;
    expect(border2.spec).toBe('GB-4040');
    expect(border2.size[1]).toBeCloseTo(0.04, 6);
  });
});

describe('computeBom — 工作台场景（1800×800×2000，6 层）', () => {
  it('顶板+台面+3 隔板+底板：型材总数与关键规格聚合', () => {
    const layers = makeFourLayerScene();
    const extraShelves = [
      makeLayer({ id: 'shelf2', type: 'shelf', elevation: 1150 }),
      makeLayer({ id: 'shelf3', type: 'shelf', elevation: 1450 }),
    ];
    const all = { ...layers, shelf2: extraShelves[0], shelf3: extraShelves[1] };
    const state = {
      ...DEFAULT_STATE,
      dimensions: { width: 1800, depth: 800, height: 2000 },
      layers: Object.values(all),
    };
    const bom = computeBom(state);
    // 4 角柱 + 4 底梁 + 5 层边框(顶/台/3隔板) = 20 + 底板(无边框) = 20
    // 每层边框 4 根 → 4 + 4 + 5*4 = 28
    expect(bom.totalProfileCount).toBe(28);
    // 顶板 2000×4（角柱）+ 台面框 + 隔板框
    const byKey = new Map(bom.profiles.map((p) => [`${p.spec}:${p.length}`, p.count]));
    expect(byKey.get('GB-4040:2000')).toBe(4);
    // 底板不加边框 → 板材 6 块
    expect(bom.boards).toHaveLength(6);
  });
});
