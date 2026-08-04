import type { ItemType } from '../components/items';

/**
 * 物品 3D 模型共享几何描述
 *
 * 将 14 种物品的模型外观描述为「基础图元列表」（自然尺寸，米），
 * R3F 端（<ItemModel>）与导出端（createItemMesh）遍历同一描述渲染，
 * 两端视觉一致。放置缩放由外层 group 统一施加，不进入图元描述。
 */

export type ItemPrimitiveKind =
  | 'box'
  | 'roundedBox'
  | 'cylinder'
  | 'sphere'
  | 'torus'
  | 'plane'
  | 'circle';

export interface ItemPrimitive {
  kind: ItemPrimitiveKind;
  /** 图元几何参数（与 three 构造一致，米） */
  args: number[];
  /** 圆角半径（仅 roundedBox） */
  radius?: number;
  /** 相对物品中心位置（米） */
  pos?: [number, number, number];
  /** 旋转（弧度） */
  rot?: [number, number, number];
  /** 材质 */
  color: string;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  side?: 'front' | 'back' | 'double';
}

const P = (kind: ItemPrimitiveKind, args: number[], color: string, extra: Partial<ItemPrimitive> = {}): ItemPrimitive => ({
  kind, args, color, ...extra,
});

/** 生成物品模型图元列表（自然尺寸，米） */
export function getItemPrimitives(type: ItemType): ItemPrimitive[] {
  switch (type) {
    // ── 工控机：深灰铝壳 + 顶部散热鳍片 + 银色前面板 + LED ──
    case 'industrial-pc':
      return [
        P('roundedBox', [0.32, 0.065, 0.26], '#3a3e42', { radius: 0.006, roughness: 0.3, metalness: 0.5 }),
        // 散热鳍片 ×10
        ...Array.from({ length: 10 }, (_, i) =>
          P('box', [0.022, 0.008, 0.2], '#b0b8c0', { pos: [i * 0.028 - 0.126, 0.038, 0], roughness: 0.4, metalness: 0.6 })),
        P('roundedBox', [0.32, 0.065, 0.004], '#c8d0d8', { pos: [0, 0, 0.13], radius: 0.003, roughness: 0.35, metalness: 0.4 }),
        P('plane', [0.2, 0.045], '#1a1c1e', { pos: [0, 0.005, 0.133], roughness: 0.8 }),
        P('circle', [0.003, 12], '#00ff88', { pos: [-0.095, 0.017, 0.134], emissive: '#00ff88', emissiveIntensity: 0.8 }),
        P('circle', [0.003, 12], '#ff4444', { pos: [-0.08, 0.017, 0.134], emissive: '#ff4444', emissiveIntensity: 0.3 }),
        P('circle', [0.006, 16], '#555', { pos: [0.08, 0.017, 0.134], roughness: 0.5 }),
        // 侧面散热开孔
        ...Array.from({ length: 8 }, (_, i) => [
          P('box', [0.002, 0.002, 0.01], '#222', { pos: [-0.163, i * 0.004 - 0.014, 0.05] }),
          P('box', [0.002, 0.002, 0.01], '#222', { pos: [0.163, i * 0.004 - 0.014, 0.05] }),
        ]).flat(),
        // 壁挂支架
        P('box', [0.004, 0.048, 0.2], '#c8d0d8', { pos: [-0.164, 0, 0], roughness: 0.35, metalness: 0.5 }),
        P('box', [0.004, 0.048, 0.2], '#c8d0d8', { pos: [0.164, 0, 0], roughness: 0.35, metalness: 0.5 }),
        // 支架螺钉
        ...([[ -0.164, -0.015, 0.08], [-0.164, 0.015, 0.08], [-0.164, -0.015, -0.08], [-0.164, 0.015, -0.08],
          [0.164, -0.015, 0.08], [0.164, 0.015, 0.08], [0.164, -0.015, -0.08], [0.164, 0.015, -0.08]] as [number, number, number][]).map((pos) =>
          P('cylinder', [0.002, 0.002, 0.006, 8], '#888', { pos, metalness: 0.7, roughness: 0.3 })),
      ];

    // ── 笔记本：底座 + 键盘面 + 屏幕 ──
    case 'laptop':
      return [
        P('roundedBox', [0.34, 0.012, 0.24], '#2a2e32', { pos: [0, -0.006, 0], radius: 0.005, roughness: 0.5, metalness: 0.2 }),
        P('plane', [0.32, 0.22], '#1a1c1e', { pos: [0, 0.001, 0], rot: [-Math.PI / 2, 0, 0], roughness: 0.8, side: 'double' }),
        // 键盘键帽
        ...Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 12 }, (_, col) =>
            P('box', [0.018, 0.0015, 0.013], '#222', { pos: [col * 0.022 - 0.11, 0.002, row * 0.016 - 0.07], roughness: 0.8 }))).flat(),
        P('box', [0.08, 0.0015, 0.013], '#222', { pos: [0, 0.002, 0.01], roughness: 0.8 }),
        P('roundedBox', [0.05, 0.0015, 0.032], '#444', { pos: [0, 0.002, 0.05], radius: 0.003, roughness: 0.3 }),
        P('circle', [0.0015, 6], '#00ff88', { pos: [0, 0.002, 0.125], emissive: '#00ff88', emissiveIntensity: 0.5 }),
        // 转轴
        P('cylinder', [0.006, 0.006, 0.32, 12], '#555', { pos: [0, 0.002, -0.115], rot: [0, 0, Math.PI / 2], roughness: 0.5, metalness: 0.4 }),
        // 屏幕（绕转轴开合约 110°）
        P('roundedBox', [0.33, 0.235, 0.006], '#1a1c1e', { pos: [0, 0.122, -0.119], rot: [-0.35, 0, 0], radius: 0.004, roughness: 0.5, metalness: 0.3 }),
        P('plane', [0.31, 0.215], '#111', { pos: [0, 0.122, -0.1158], rot: [-0.35, 0, 0], roughness: 0.6 }),
        P('plane', [0.27, 0.18], '#0a2a4a', { pos: [0, 0.127, -0.1158], rot: [-0.35, 0, 0], roughness: 0.05, metalness: 0.6 }),
      ];

    // ── PDA：橙色机身 + 白色面板 + 扫描头 ──
    case 'pda':
      return [
        P('roundedBox', [0.15, 0.07, 0.025], '#ff6600', { radius: 0.008, roughness: 0.8 }),
        P('roundedBox', [0.13, 0.055, 0.001], '#f5f5f5', { pos: [0, 0, 0.0135], radius: 0.004, roughness: 0.5 }),
        P('roundedBox', [0.11, 0.045, 0.001], '#0a1520', { pos: [0, 0, 0.0145], radius: 0.003, roughness: 0.1, metalness: 0.5 }),
        P('roundedBox', [0.13, 0.055, 0.001], '#f5f5f5', { pos: [0, 0, -0.0135], radius: 0.004, roughness: 0.5 }),
        P('roundedBox', [0.015, 0.025, 0.003], '#222', { pos: [0.055, 0, -0.0145], radius: 0.001, roughness: 0.8 }),
        P('circle', [0.004, 12], '#ff2222', { pos: [0.055, 0, -0.017], emissive: '#ff0000', emissiveIntensity: 0.3 }),
      ];

    // ── 工业相机：银色机身 + 镜头总成 ──
    case 'industrial-camera':
      return [
        P('roundedBox', [0.055, 0.055, 0.055], '#c0c8d0', { radius: 0.003, roughness: 0.3, metalness: 0.6 }),
        P('roundedBox', [0.04, 0.04, 0.006], '#1a1c1e', { pos: [0, 0, 0.031], radius: 0.002, roughness: 0.6 }),
        // 镜筒（110mm C-mount 镜头）
        P('cylinder', [0.016, 0.022, 0.11, 24], '#111', { pos: [0, 0, 0.05], rot: [-Math.PI / 2, 0, 0], roughness: 0.4, metalness: 0.6 }),
        P('cylinder', [0.021, 0.021, 0.01, 24], '#333', { pos: [0, 0, 0.085], rot: [-Math.PI / 2, 0, 0], roughness: 0.7, metalness: 0.3 }),
        P('circle', [0.014, 24], '#4488cc', { pos: [0, 0, 0.104], roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.4 }),
        P('cylinder', [0.012, 0.014, 0.004, 16], '#555', { pos: [0, 0, 0.005], rot: [-Math.PI / 2, 0, 0], roughness: 0.6, metalness: 0.4 }),
        P('box', [0.012, 0.008, 0.004], '#666', { pos: [0.018, 0, -0.032], roughness: 0.8 }),
        P('circle', [0.002, 8], '#00ff00', { pos: [0.012, 0.02, 0.034], emissive: '#00ff00', emissiveIntensity: 0.5 }),
        ...Array.from({ length: 3 }, (_, i) =>
          P('box', [0.006, 0.004, 0.03], '#222', { pos: [0.025, i * 0.006 - 0.006, 0], roughness: 0.8 })),
      ];

    // ── 球型监控：圆盘底座 + 半球罩 + 云台 ──
    case 'dome-camera':
      return [
        P('cylinder', [0.05, 0.06, 0.015, 32], '#e8e8e8', { pos: [0, 0.026, 0], roughness: 0.5, metalness: 0.2 }),
        P('cylinder', [0.048, 0.05, 0.003, 32], '#666', { pos: [0, 0.017, 0], roughness: 0.4, metalness: 0.3 }),
        P('sphere', [0.042, 32, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2], '#8899aa', { pos: [0, 0.019, 0], roughness: 0.05, transparent: true, opacity: 0.3, side: 'double' }),
        P('sphere', [0.038, 24, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2], '#334455', { pos: [0, 0.019, 0], roughness: 0.8, transparent: true, opacity: 0.08, side: 'back' }),
        // 云台模组
        P('cylinder', [0.016, 0.022, 0.012, 16], '#333', { pos: [0, 0.02, 0], roughness: 0.5 }),
        P('cylinder', [0.01, 0.014, 0.016, 12], '#111', { pos: [0, 0.02, 0.016], rot: [0, 0, 0], roughness: 0.4, metalness: 0.3 }),
        P('circle', [0.008, 12], '#4488cc', { pos: [0, 0.02, 0.025], roughness: 0.05, metalness: 0.1 }),
        P('cylinder', [0.008, 0.01, 0.004, 12], '#333', { pos: [0, 0.034, 0], roughness: 0.8 }),
      ];

    // ── 防水监控：白机身 + 镜头 + 前罩 ──
    case 'bullet-camera':
      return [
        P('box', [0.08, 0.07, 0.18], '#c0c6cc', { roughness: 0.5, metalness: 0.1 }),
        P('cylinder', [0.016, 0.02, 0.03, 16], '#111', { pos: [0, -0.005, 0.091], rot: [-Math.PI / 2, 0, 0], roughness: 0.4, metalness: 0.3 }),
        P('circle', [0.012, 16], '#222', { pos: [0, -0.005, 0.106], roughness: 0.3, metalness: 0.5 }),
        // 前罩：左右端板 + 顶盖（用薄盒近似）
        P('box', [0.003, 0.07, 0.225], '#ffffff', { pos: [-0.0415, 0, 0.0225], roughness: 0.6 }),
        P('box', [0.003, 0.07, 0.225], '#ffffff', { pos: [0.0415, 0, 0.0225], roughness: 0.6 }),
        P('box', [0.089, 0.002, 0.225], '#ffffff', { pos: [0, 0.036, 0.0225], roughness: 0.6 }),
      ];

    // ── 电源控制器：深灰铝壳 + 散热鳍片 ──
    case 'power-controller':
      return [
        P('roundedBox', [0.22, 0.049, 0.18], '#c8d0d8', { radius: 0.015, roughness: 0.35, metalness: 0.4 }),
        // 底部散热鳍片 ×5
        ...Array.from({ length: 5 }, (_, i) =>
          P('box', [0.187, 0.005, 0.144], '#b0b8c0', { pos: [0, -0.028 + i * 0.012, 0], metalness: 0.5 })),
        P('plane', [0.15, 0.12], '#2a2e32', { pos: [0, 0, 0.091], roughness: 0.8 }),
        P('circle', [0.002, 8], '#00ff00', { pos: [-0.07, 0.015, 0.092], emissive: '#00ff00', emissiveIntensity: 0.5 }),
      ];

    // ── 光源控制器：黑壳 + 通道指示灯 ──
    case 'light-controller':
      return [
        P('roundedBox', [0.2, 0.064, 0.18], '#333333', { radius: 0.015, roughness: 0.6 }),
        P('roundedBox', [0.16, 0.04, 0.16], '#c8d0d8', { pos: [0, 0.012, 0], radius: 0.01, roughness: 0.4 }),
        ...Array.from({ length: 4 }, (_, i) =>
          P('circle', [0.002, 8], i < 2 ? '#ffff00' : '#444', { pos: [-0.045 + i * 0.03, 0.03, 0.091], emissive: i < 2 ? '#ffff00' : undefined, emissiveIntensity: i < 2 ? 0.5 : 0 })),
      ];

    // ── 插线板：白色 + 插孔 ──
    case 'power-strip':
      return [
        P('roundedBox', [0.3, 0.03, 0.06], '#e8e8e8', { radius: 0.008, roughness: 0.5 }),
        ...Array.from({ length: 5 }, (_, i) =>
          P('box', [0.012, 0.002, 0.012], '#bbb', { pos: [-0.11 + i * 0.055, 0.013, 0], roughness: 0.6 })),
        P('circle', [0.003, 8], '#444', { pos: [0.14, 0.013, 0], roughness: 0.6 }),
        P('box', [0.01, 0.014, 0.014], '#888', { pos: [-0.15, 0, 0], roughness: 0.5, metalness: 0.4 }),
      ];

    // ── 打印机：白体 + 出纸口 ──
    case 'printer':
      return [
        P('roundedBox', [0.4, 0.28, 0.35], '#e8e8e8', { radius: 0.008, roughness: 0.4 }),
        P('roundedBox', [0.36, 0.1, 0.33], '#f5f5f5', { pos: [0, 0.09, 0], radius: 0.006, roughness: 0.5 }),
        P('box', [0.22, 0.01, 0.02], '#333', { pos: [0, 0.095, 0.175], roughness: 0.7 }),
        ...Array.from({ length: 3 }, (_, i) =>
          P('circle', [0.002, 8], '#666', { pos: [0.14 + i * 0.012, 0.14, 0.177], roughness: 0.5 })),
      ];

    // ── 条光：铝壳 + 出光面 ──
    case 'bar-light':
      return [
        P('roundedBox', [0.25, 0.03, 0.03], '#c0c8d0', { radius: 0.004, roughness: 0.3, metalness: 0.5 }),
        P('plane', [0.22, 0.02], '#ffffee', { pos: [0, -0.014, 0], rot: [Math.PI / 2, 0, 0], emissive: '#ffffcc', emissiveIntensity: 0.3, roughness: 0.6 }),
        P('box', [0.004, 0.026, 0.026], '#888', { pos: [0.125, 0, 0], roughness: 0.5, metalness: 0.4 }),
        P('box', [0.004, 0.026, 0.026], '#888', { pos: [-0.125, 0, 0], roughness: 0.5, metalness: 0.4 }),
        P('cylinder', [0.003, 0.003, 0.02, 6], '#222', { pos: [-0.125, 0, 0], rot: [0, 0, Math.PI / 2], roughness: 0.9 }),
      ];

    // ── 面光：铝框 + 出光面 ──
    case 'area-light':
      return [
        P('roundedBox', [0.25, 0.02, 0.2], '#b0b8c0', { radius: 0.006, roughness: 0.4, metalness: 0.4 }),
        P('plane', [0.22, 0.17], '#eeeedd', { pos: [0, -0.009, 0], rot: [Math.PI / 2, 0, 0], emissive: '#ffffdd', emissiveIntensity: 0.25, roughness: 0.7 }),
      ];

    // ── 环光：环 + 出光环 ──
    case 'ring-light':
      return [
        P('torus', [0.054, 0.012, 14, 28], '#c0c8d0', { rot: [Math.PI / 2, 0, 0], roughness: 0.4, metalness: 0.4 }),
        P('torus', [0.045, 0.006, 14, 28], '#ffeecc', { rot: [Math.PI / 2, 0, 0], emissive: '#ffeeaa', emissiveIntensity: 0.5, roughness: 0.6 }),
      ];

    // ── 产品箱：纸箱 + 胶带 ──
    case 'product-box':
      return [
        P('roundedBox', [0.3, 0.15, 0.2], '#a07030', { radius: 0.005, roughness: 0.8 }),
        P('box', [0.302, 0.151, 0.02], '#c09040', { pos: [0, 0, 0.101], transparent: true, opacity: 0.3 }),
        P('box', [0.302, 0.02, 0.202], '#c09040', { pos: [0, 0, 0], transparent: true, opacity: 0.3 }),
      ];

    default:
      return [P('box', [0.1, 0.1, 0.1], '#888888')];
  }
}
