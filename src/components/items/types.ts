/**
 * VisionAI 3D Workbench — 物品资源系统
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

export type ItemCategory =
  | 'computer'
  | 'camera'
  | 'lighting'
  | 'controller'
  | 'electronics'
  | 'box'
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
  | 'laptop';

/** 物品元数据 */
export interface ItemInfo {
  type: ItemType;
  name: string;
  nameEn: string;
  /** 尺寸 [长(X), 宽(Z), 高(Y)] 单位: 米 */
  size: [number, number, number];
  category: ItemCategory;
  description: string;
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
  },
  {
    type: 'laptop',
    name: '笔记本电脑',
    nameEn: 'Laptop',
    size: [0.35, 0.25, 0.025],
    category: 'computer',
    description: '15.6寸工业加固笔记本',
  },
  {
    type: 'industrial-camera',
    name: '工业相机',
    nameEn: 'Industrial Camera',
    size: [0.055, 0.14, 0.055],
    category: 'camera',
    description: '500万像素 GigE 工业相机，含镜头',
  },
  {
    type: 'dome-camera',
    name: '球型监控',
    nameEn: 'Dome Camera',
    size: [0.12, 0.12, 0.1],
    category: 'camera',
    description: '室内半球形网络摄像机',
  },
  {
    type: 'bullet-camera',
    name: '防水监控',
    nameEn: 'Bullet Camera',
    size: [0.25, 0.08, 0.08],
    category: 'camera',
    description: '室外防水枪式摄像机，IP67',
  },
  {
    type: 'power-controller',
    name: '电源控制器',
    nameEn: 'Power Controller',
    size: [0.22, 0.18, 0.07],
    category: 'controller',
    description: '24V DC 工业开关电源',
  },
  {
    type: 'light-controller',
    name: '光源控制器',
    nameEn: 'Light Controller',
    size: [0.2, 0.18, 0.08],
    category: 'controller',
    description: '数字式LED光源控制器，4通道',
  },
  {
    type: 'power-strip',
    name: '插线板',
    nameEn: 'Power Strip',
    size: [0.3, 0.06, 0.04],
    category: 'controller',
    description: '8位工业级PDU插线板',
  },
  {
    type: 'printer',
    name: '打印机',
    nameEn: 'Printer',
    size: [0.4, 0.35, 0.28],
    category: 'electronics',
    description: '工业级条码/标签打印机',
  },
  {
    type: 'pda',
    name: 'PDA扫码器',
    nameEn: 'PDA Scanner',
    size: [0.15, 0.06, 0.07],
    category: 'electronics',
    description: '工业级手持数据终端，扫码枪式',
  },
  {
    type: 'bar-light',
    name: '工业条光',
    nameEn: 'Bar Light',
    size: [0.25, 0.03, 0.03],
    category: 'lighting',
    description: 'LED 条形光源，铝合金外壳',
  },
  {
    type: 'area-light',
    name: '工业面光',
    nameEn: 'Area Light',
    size: [0.25, 0.2, 0.02],
    category: 'lighting',
    description: 'LED 面光源，漫射板出光',
  },
  {
    type: 'ring-light',
    name: '工业环光',
    nameEn: 'Ring Light',
    size: [0.12, 0.12, 0.025],
    category: 'lighting',
    description: 'LED 环形光源，0° 直射',
  },
  {
    type: 'product-box',
    name: '产品箱子',
    nameEn: 'Product Box',
    size: [0.3, 0.2, 0.15],
    category: 'box',
    description: '工业产品纸箱包装',
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
export const CATEGORY_NAMES: Record<ItemCategory, string> = {
  computer: '计算机',
  camera: '相机 & 镜头',
  lighting: '光源',
  controller: '控制器',
  electronics: '电子设备',
  box: '包装箱',
  other: '其他',
};

export interface Item3DProps {
  scale?: number;
}
