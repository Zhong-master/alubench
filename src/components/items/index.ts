import type { Item3DProps, ItemType } from './types';
import * as React from 'react';

import { IndustrialPC, Laptop, PDA } from './Computers';
import { IndustrialCamera, DomeCamera, BulletCamera } from './Cameras';
import { BarLight, AreaLight, RingLight } from './Lighting';
import { PowerController, LightController, PowerStrip, ProductBox } from './Controllers';
import { Printer } from './Electronics';

export type { ItemType, ItemInfo, ItemCategory, Item3DProps } from './types';
export { ITEM_REGISTRY, ITEM_MAP, ITEMS_BY_CATEGORY, CATEGORY_NAMES } from './types';

export { IndustrialPC, Laptop, PDA } from './Computers';
export { IndustrialCamera, DomeCamera, BulletCamera } from './Cameras';
export { BarLight, AreaLight, RingLight } from './Lighting';
export { PowerController, LightController, PowerStrip, ProductBox } from './Controllers';
export { Printer } from './Electronics';

/** ItemType → 3D 组件映射 */
export const ITEM_COMPONENTS: Record<ItemType, React.FC<Item3DProps>> = {
  'industrial-pc': IndustrialPC,
  laptop: Laptop,
  pda: PDA,
  'industrial-camera': IndustrialCamera,
  'dome-camera': DomeCamera,
  'bullet-camera': BulletCamera,
  'bar-light': BarLight,
  'area-light': AreaLight,
  'ring-light': RingLight,
  'power-controller': PowerController,
  'light-controller': LightController,
  'power-strip': PowerStrip,
  printer: Printer,
  'product-box': ProductBox,
};
