import { describe, it, expect } from 'vitest';
import { ITEM_REGISTRY } from '../../components/items';
import { getItemPrimitives } from '../itemModel';

describe('getItemPrimitives — 物品图元完整性', () => {
  const types = ITEM_REGISTRY.map((i) => i.type);

  it('每个注册物品都有非空图元列表', () => {
    for (const t of types) {
      const prims = getItemPrimitives(t);
      expect(prims.length, `${t} 图元列表为空`).toBeGreaterThan(0);
    }
  });

  it('每个物品第一个图元为合理尺寸的主体（直径/边长 > 0）', () => {
    for (const t of types) {
      const first = getItemPrimitives(t)[0];
      // 主体可能是 box/roundedBox/cylinder（球型监控圆盘底座）
      expect(first.args[0], `${t} 首个图元尺寸非法`).toBeGreaterThan(0);
      const last = first.args[first.args.length - 1];
      if (typeof last === 'number') expect(last, `${t} 首个图元深度非法`).toBeGreaterThan(0);
    }
  });

  it('图元均含合法颜色（3/6 位十六进制）与正尺寸', () => {
    for (const t of types) {
      for (const p of getItemPrimitives(t)) {
        expect(p.color).toMatch(/^#[0-9a-f]{3,6}$/i);
        for (const a of p.args) {
          if (typeof a === 'number') expect(a).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('未知类型回退默认盒', () => {
    const prims = getItemPrimitives('product-box' as never);
    expect(prims.length).toBeGreaterThan(0);
  });
});
