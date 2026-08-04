import type { Item3DProps, ItemType } from './types';
import * as React from 'react';

import { ItemModel } from './ItemModel';

export type { ItemType, ItemInfo, ItemCategory, Item3DProps } from './types';
export { ITEM_REGISTRY, ITEM_MAP, ITEMS_BY_CATEGORY, CATEGORY_NAMES } from './types';

/** 单类型物品组件工厂（绑定类型，渲染共享几何描述） */
function makeItemComponent(type: ItemType): React.FC<Item3DProps> {
  const C: React.FC<Item3DProps> = ({ scale = 1 }) => <ItemModel type={type} scale={scale} />;
  C.displayName = `Item_${type}`;
  return C;
}

/** ItemType → 3D 组件映射（统一由共享物品几何描述渲染） */
export const ITEM_COMPONENTS: Record<ItemType, React.FC<Item3DProps>> = {
  'industrial-pc': makeItemComponent('industrial-pc'),
  laptop: makeItemComponent('laptop'),
  pda: makeItemComponent('pda'),
  'industrial-camera': makeItemComponent('industrial-camera'),
  'dome-camera': makeItemComponent('dome-camera'),
  'bullet-camera': makeItemComponent('bullet-camera'),
  'bar-light': makeItemComponent('bar-light'),
  'area-light': makeItemComponent('area-light'),
  'ring-light': makeItemComponent('ring-light'),
  'power-controller': makeItemComponent('power-controller'),
  'light-controller': makeItemComponent('light-controller'),
  'power-strip': makeItemComponent('power-strip'),
  printer: makeItemComponent('printer'),
  'product-box': makeItemComponent('product-box'),
};
