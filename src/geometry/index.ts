import type { AppState } from '../state';
import type { BeamInstance, BoardInstance, SceneGeometry } from './types';
import { getFrameContext, layerMM, layerSpec, profileMMOf, profileSpec } from './context';
import { buildFrameBeams } from './frame';
import { boardLabel, buildAllLayers, buildLayerGeometry, zOffsetOf } from './layer';
import { computePlacements } from './items';
import { aggregateBom, bomTotals } from './aggregate';
import { validate } from './validate';

export type {
  BeamInstance, BoardInstance, FrameContext, ItemPlacement, SceneGeometry,
  Face, CornerKey, TopColumns, LayerGeometry,
} from './types';
export type { BomProfileRow } from './aggregate';
export type { ValidationIssue } from './validate';

export {
  getFrameContext, layerMM, layerSpec, profileMMOf, profileSpec,
  buildFrameBeams, buildLayerGeometry, buildAllLayers, boardLabel, zOffsetOf,
  computePlacements, aggregateBom, bomTotals, validate,
};

/**
 * 构建全场景几何：机架级型材 + 各层几何（板材/型材/物品占位）。
 * SceneView / exportHtml / bom 三方统一从本函数取数。
 */
export function buildSceneGeometry(state: AppState): SceneGeometry {
  const ctx = getFrameContext(state);
  const frameBeams = buildFrameBeams(ctx, state.columns);
  const layers = buildAllLayers(state.layers, ctx, (layer) => computePlacements(layer, ctx.D));
  return { frameBeams, layers };
}

export type { BeamInstance as Beam, BoardInstance as Board };
