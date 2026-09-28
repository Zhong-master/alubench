/**
 * AluBench — 物品资源系统
 *
 * ═══════════════════════════════════════════════════════════
 * 3D 资源风格指南
 * ═══════════════════════════════════════════════════════════
 *
 * 1. 单位: 1 = 1 米（与场景保持一致）
 * 2. 所有物品用 <group> 包裹，中心在原点
 * 3. 材质:
 *    - 金属件:  metalness≈0.4-0.7, roughness≈0.3-0.5, color="#b0b8c0"~"#e0e8f0"
 *    - 塑料壳:  metalness≈0.0-0.1, roughness≈0.5-0.8, color 随功能
 *    - 玻璃:    metalness≈0.0, roughness≈0.0, transparent, opacity≈0.3-0.6
 *    - 橡胶:    roughness≈0.9, color="#222"
 * 4. 圆角用 @react-three/drei 的 RoundedBox，radius=0.003~0.008
 * 5. 每个组件接受 props: scale?: number
 * 6. 物品尺寸 = 实际占用空间（用于布局计算）
 * 7. 细节以少量几何体实现（通风口格栅、LED、接口等）
 */

import type { Locale } from '../../i18n';

export type ItemCategory =
  | 'computer'
  | 'camera'
  | 'lighting'
  | 'controller'
  | 'electronics'
  | 'box'
  | 'storage'
  | 'other';

/** 物品唯一标识 */
export type ItemType =
  | 'industrial-pc'
  | 'industrial-camera'
  | 'dome-camera'
  | 'bullet-camera'
  | 'power-controller'
  | 'power-strip'
  | 'printer'
  | 'pda'
  | 'product-box'
  | 'light-controller'
  | 'bar-light'
  | 'area-light'
  | 'ring-light'
  | 'laptop'
  | 'monitor'
  | 'keyboard'
  | 'ethernet-switch'
  | 'ups'
  | 'drawer-unit';

/** 物品元数据 */
export interface ItemInfo {
  type: ItemType;
  name: string;
  nameEn: string;
  /** 尺寸 [长(X), 宽(Z), 高(Y)] 单位: 米 */
  size: [number, number, number];
  category: ItemCategory;
  description: string;
  /** 英文描述（界面语言为 en 时显示，见下方 itemDescription()） */
  descriptionEn: string;
}

/** 物品注册表 */
export const ITEM_REGISTRY: ItemInfo[] = [
  {
    type: 'industrial-pc',
    name: '工控机',
    nameEn: 'Industrial PC',
    size: [0.32, 0.28, 0.095],
    category: 'computer',
    description: '无风扇嵌入式工控机，铝合金外壳，壁挂安装',
    descriptionEn: "Fanless embedded industrial PC, aluminium enclosure, wall-mount",
  },
  {
    type: 'laptop',
    name: '笔记本电脑',
    nameEn: 'Laptop',
    size: [0.35, 0.25, 0.025],
    category: 'computer',
    description: '15.6寸工业加固笔记本',
    descriptionEn: '15.6" ruggedised industrial laptop',
  },
  {
    type: 'industrial-camera',
    name: '工业相机',
    nameEn: 'Industrial Camera',
    size: [0.055, 0.14, 0.055],
    category: 'camera',
    description: '500万像素 GigE 工业相机，含镜头',
    descriptionEn: "5 MP GigE industrial camera with lens",
  },
  {
    type: 'dome-camera',
    name: '球型监控',
    nameEn: 'Dome Camera',
    size: [0.12, 0.12, 0.1],
    category: 'camera',
    description: '室内半球形网络摄像机',
    descriptionEn: "Indoor dome network camera",
  },
  {
    type: 'bullet-camera',
    name: '防水监控',
    nameEn: 'Bullet Camera',
    size: [0.25, 0.08, 0.08],
    category: 'camera',
    description: '室外防水枪式摄像机，IP67',
    descriptionEn: "Outdoor bullet camera, IP67 rated",
  },
  {
    type: 'power-controller',
    name: '电源控制器',
    nameEn: 'Power Controller',
    size: [0.22, 0.18, 0.07],
    category: 'controller',
    description: '24V DC 工业开关电源',
    descriptionEn: "24 V DC industrial switching power supply",
  },
  {
    type: 'light-controller',
    name: '光源控制器',
    nameEn: 'Light Controller',
    size: [0.2, 0.18, 0.08],
    category: 'controller',
    description: '数字式LED光源控制器，4通道',
    descriptionEn: "Digital LED light controller, 4 channels",
  },
  {
    type: 'power-strip',
    name: '插线板',
    nameEn: 'Power Strip',
    size: [0.3, 0.06, 0.04],
    category: 'controller',
    description: '8位工业级PDU插线板',
    descriptionEn: "8-way industrial PDU power strip",
  },
  {
    type: 'printer',
    name: '打印机',
    nameEn: 'Printer',
    size: [0.4, 0.35, 0.28],
    category: 'electronics',
    description: '工业级条码/标签打印机',
    descriptionEn: "Industrial barcode / label printer",
  },
  {
    type: 'pda',
    name: 'PDA扫码器',
    nameEn: 'PDA Scanner',
    size: [0.15, 0.06, 0.07],
    category: 'electronics',
    description: '工业级手持数据终端，扫码枪式',
    descriptionEn: "Industrial handheld data terminal with barcode scanner",
  },
  {
    type: 'bar-light',
    name: '工业条光',
    nameEn: 'Bar Light',
    size: [0.25, 0.03, 0.03],
    category: 'lighting',
    description: 'LED 条形光源，铝合金外壳',
    descriptionEn: "LED bar light, aluminium housing",
  },
  {
    type: 'area-light',
    name: '工业面光',
    nameEn: 'Area Light',
    size: [0.25, 0.2, 0.02],
    category: 'lighting',
    description: 'LED 面光源，漫射板出光',
    descriptionEn: "LED area light with diffuser panel",
  },
  {
    type: 'ring-light',
    name: '工业环光',
    nameEn: 'Ring Light',
    size: [0.12, 0.12, 0.025],
    category: 'lighting',
    description: 'LED 环形光源，0° 直射',
    descriptionEn: "LED ring light, 0° direct illumination",
  },
  {
    type: 'product-box',
    name: '产品箱子',
    nameEn: 'Product Box',
    size: [0.3, 0.2, 0.15],
    category: 'box',
    description: '工业产品纸箱包装',
    descriptionEn: "Industrial cardboard product box",
  },
  // ── 工作台常用件（v1.1 扩充：显示器 / 键盘 / 交换机 / UPS / 工具柜）──
  {
    type: 'monitor',
    name: '显示器',
    nameEn: 'Monitor',
    size: [0.55, 0.16, 0.36],
    category: 'computer',
    description: '24 寸工业显示器，含底座支架',
    descriptionEn: '24" industrial monitor with stand',
  },
  {
    type: 'keyboard',
    name: '键盘',
    nameEn: 'Keyboard',
    size: [0.44, 0.14, 0.02],
    category: 'computer',
    description: '104 键工业键盘，金属面板',
    descriptionEn: '104-key industrial keyboard with metal plate',
  },
  {
    type: 'ethernet-switch',
    name: '工业交换机',
    nameEn: 'Ethernet Switch',
    size: [0.2, 0.12, 0.045],
    category: 'electronics',
    description: '8 口千兆工业交换机，导轨/桌面两用',
    descriptionEn: '8-port gigabit industrial switch, DIN-rail or desktop',
  },
  {
    type: 'ups',
    name: 'UPS 电源',
    nameEn: 'UPS',
    size: [0.15, 0.3, 0.19],
    category: 'electronics',
    description: '在线式 UPS，掉电时保护工控机与相机',
    descriptionEn: 'Online UPS keeping the PC and cameras alive through power loss',
  },
  {
    type: 'drawer-unit',
    name: '工具柜',
    nameEn: 'Drawer Unit',
    size: [0.4, 0.44, 0.33],
    category: 'storage',
    description: '三层抽屉工具柜，可推入工作台下方',
    descriptionEn: 'Three-drawer tool cabinet that rolls under the bench',
  },
];

export const ITEM_MAP = new Map<ItemType, ItemInfo>(
  ITEM_REGISTRY.map((item) => [item.type, item])
);

export const ITEMS_BY_CATEGORY = ITEM_REGISTRY.reduce<
  Record<ItemCategory, ItemInfo[]>
>((acc, item) => {
  (acc[item.category] ??= []).push(item);
  return acc;
}, {} as Record<ItemCategory, ItemInfo[]>);

/** 分类中文名 */
export const CATEGORY_NAMES_EN: Record<ItemCategory, string> = {
  storage: 'Storage',
  computer: 'Computers',
  camera: 'Cameras & lenses',
  lighting: 'Lighting',
  controller: 'Controllers',
  electronics: 'Electronics',
  box: 'Packaging',
  other: 'Other',
};

export const CATEGORY_NAMES: Record<ItemCategory, string> = {
  storage: '收纳柜',
  computer: '计算机',
  camera: '相机 & 镜头',
  lighting: '光源',
  controller: '控制器',
  electronics: '电子设备',
  box: '包装箱',
  other: '其他',
};

/** 物品名 / 描述 / 分类名的语言选择（纯函数：locale 显式传入，默认中文） */
export function itemName(item: ItemInfo, locale: Locale = 'zh'): string {
  return locale === 'en' && item.nameEn ? item.nameEn : item.name;
}

/** 反查：内核 ItemPlacement 里存的是中文名，显示给 en 用户时查表换名 */
export function itemNameByName(name: string, locale: Locale = 'zh'): string {
  if (locale !== 'en') return name;
  const hit = ITEM_REGISTRY.find((i) => i.name === name);
  return hit ? itemName(hit, locale) : name;
}

export function itemDescription(item: ItemInfo, locale: Locale = 'zh'): string {
  return locale === 'en' && item.descriptionEn ? item.descriptionEn : item.description;
}

export function categoryName(cat: ItemCategory, locale: Locale = 'zh'): string {
  const dict = locale === 'en' ? CATEGORY_NAMES_EN : CATEGORY_NAMES;
  return dict[cat] ?? cat;
}

export interface Item3DProps {
  scale?: number;
}
