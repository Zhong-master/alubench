import type { AppState } from '../state';
import type { BeamInstance, BoardInstance, SceneGeometry } from './types';
import { getFrameContext, layerMM, layerSpec, profileMMOf, profileSpec } from './context';
import { buildFrameBeams } from './frame';
import { boardLabel, buildAllLayers, buildLayerGeometry, nearestLayerAbove, nearestLayerBelow, shelfIndex, zOffsetOf } from './layer';
import { computePlacements } from './items';
import { aggregateBom, aggregateBoards, bomTotals } from './aggregate';
import { validate, validateGeometry } from './validate';

export type {
  BeamInstance, BoardInstance, FrameContext, ItemPlacement, SceneGeometry,
  Face, CornerKey, TopColumns, LayerGeometry,
} from './types';
export type { BomProfileRow, BoardRow } from './aggregate';
export type { ValidationIssue } from './validate';

export {
  getFrameContext, layerMM, layerSpec, profileMMOf, profileSpec,
  buildFrameBeams, buildLayerGeometry, buildAllLayers, boardLabel, shelfIndex, zOffsetOf,
  nearestLayerAbove, nearestLayerBelow,
  computePlacements, aggregateBom, aggregateBoards, bomTotals, validate, validateGeometry,
};

/**
 * 构建全场景几何：机架级型材 + 各层几何（板材/型材/物品占位）。
 * SceneView / exportHtml / bom 三方统一从本函数取数。
 */
export function buildSceneGeometry(state: AppState): SceneGeometry {
  const ctx = getFrameContext(state);
  const frameBeams = buildFrameBeams(ctx, state.columns);
  const layers = buildAllLayers(state.layers, ctx, (layer) => {
    // 上方最近层的底面标高（mm）作为物品净空上限；上方无层则不限
    const above = nearestLayerAbove(state.layers, layer.detail.elevation, layer.id);
    const ceiling = above ? above.detail.elevation - above.detail.thickness / 2 : undefined;
    return computePlacements(layer, ctx.D, ceiling);
  });
  return { frameBeams, layers };
}

export type { BeamInstance as Beam, BoardInstance as Board };
