import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line, Html } from '@react-three/drei';
import CameraController from './CameraController';
import * as THREE from 'three';
import { useMemo, useEffect, useState, useRef } from 'react';
import type { Layer } from './LeftPanel';
import type { ItemType } from './items';
import { ITEM_COMPONENTS, ITEM_MAP } from './items';
import type { OrbitControlsLike } from './threeTypes';

interface SceneProps {
  dimensions: { width: number; depth: number; height: number };
  profile: string[];
  columns: { front: number; back: number; left: number; right: number; top: number; bottom: number; bottomFrame: string; frontCap: string; backCap: string; leftCap: string; rightCap: string };
  layers: Layer[];
  selectedLayerId?: string | null;
  selectedItemType?: ItemType | null;
  selectedPlacedItem?: { layerId: string; col: number; row: number } | null;
  onPlaceItem?: (layerId: string, col: number, row: number, itemType: ItemType | null) => void;
  onSelectPlacedItem?: (layerId: string, col: number, row: number) => void;
  onTransformPlacedItem?: (layerId: string, col: number, row: number, field: string, value: unknown) => void;
}

interface BeamDef {
  pos: [number, number, number];
  size: [number, number, number];
}

/** 生成带 T 型槽的铝型材截面 Shape */
function makeProfileShape(t: number, profile: string[]): THREE.Shape {
  const h = t / 2;
  // 不同标准的槽口宽度比例 (相对截面边长)
  const std = (profile[0] || 'GB').toUpperCase();
  const openRatio = std === 'GB' ? 0.22 : std === 'JIS' ? 0.2 : 0.18;
  const open = t * openRatio;
  const inner = t * (openRatio + 0.08); // 腔底比开口宽 8%
  const gd = t * 0.12;     // 槽深度
  const g = open / 2;
  const i = inner / 2;

  const s = new THREE.Shape();
  // 从左上角顺时针
  s.moveTo(-h, h);
  // 顶面：左 → 槽口左 → 槽底左 → 槽底右 → 槽口右 → 右
  s.lineTo(-g, h);
  s.lineTo(-i, h - gd);
  s.lineTo(i, h - gd);
  s.lineTo(g, h);
  s.lineTo(h, h);
  // 右面：上 → 槽口上 → 槽底上 → 槽底下 → 槽口下 → 下
  s.lineTo(h, g);
  s.lineTo(h - gd, i);
  s.lineTo(h - gd, -i);
  s.lineTo(h, -g);
  s.lineTo(h, -h);
  // 底面：右 → 槽口右 → 槽底右 → 槽底左 → 槽口左 → 左
  s.lineTo(g, -h);
  s.lineTo(i, -h + gd);
  s.lineTo(-i, -h + gd);
  s.lineTo(-g, -h);
  s.lineTo(-h, -h);
  // 左面：下 → 槽口下 → 槽底下 → 槽底上 → 槽口上 → 上
  s.lineTo(-h, -g);
  s.lineTo(-h + gd, -i);
  s.lineTo(-h + gd, i);
  s.lineTo(-h, g);
  s.closePath();
  return s;
}

/** 单根铝型材 — 用截面拉伸生成，四面带真实 T 型槽 */
const ProfileBeam: React.FC<BeamDef & { shape: THREE.Shape; opacity?: number }> = ({ pos, size, shape, opacity = 1 }) => {
  const [lx, ly, lz] = size;
  const axis = lx > ly && lx > lz ? 'x' : ly > lx && ly > lz ? 'y' : 'z';
  const length = Math.max(lx, ly, lz);

  const geom = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
    g.translate(0, 0, -length / 2);
    g.computeVertexNormals();
    return g;
  }, [shape, length]);

  const rotation: [number, number, number] =
    axis === 'x' ? [0, Math.PI / 2, 0] :
    axis === 'y' ? [-Math.PI / 2, 0, 0] :
    [0, 0, 0];

  return (
    <mesh position={pos} rotation={rotation} geometry={geom}>
      <meshStandardMaterial color="#c0c0c0" roughness={0.5} metalness={0.4} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
};

/** 布局网格单元格 */
const GridCell: React.FC<{ size: [number, number]; radius: number; opacity: number; position: [number, number, number]; color?: string; onPointerDown?: (e: { stopPropagation(): void }) => void }> = ({ size, radius, opacity, position, color = 'white', onPointerDown }) => {
  const [w, h] = size;
  const r = Math.min(radius, w / 2, h / 2);
  const geom = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return new THREE.ShapeGeometry(s);
  }, [w, h, r]);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onPointerDown}>
      <primitive object={geom} attach="geometry" />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false}
        polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
    </mesh>
  );
};

/** 本地生成简易环境贴图（避免依赖外部 HDR 下载） */
const LocalEnvironment: React.FC = () => {
  const { gl, scene } = useThree();
  const generated = useRef(false);

  useEffect(() => {
    if (generated.current) return;
    generated.current = true;

    const pmrem = new THREE.PMREMGenerator(gl);

    // 用简单渐变场景生成环境贴图
    const envScene = new THREE.Scene();
    const gradientColors = [
      [0.9, 0.9, 0.95],
      [0.7, 0.7, 0.75],
      [0.5, 0.5, 0.55],
    ];
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(2, 8, 8),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(gradientColors[i][0], gradientColors[i][1], gradientColors[i][2]),
          side: THREE.BackSide,
        })
      );
      mesh.position.y = i - 1;
      envScene.add(mesh);
    }

    const envMap = pmrem.fromScene(envScene).texture;
    scene.environment = envMap;
    scene.environmentIntensity = 0.4;
    pmrem.dispose();
  }, [gl, scene]);

  return null;
};

/** 俯视聚焦控制器 — 收到事件后丝滑飞到层板正上方 */
const CameraFocusController: React.FC = () => {
  const { camera } = useThree();
  const store = useThree((s) => s);
  const animRef = useRef<{
    startPos: THREE.Vector3; endPos: THREE.Vector3;
    startTarget: THREE.Vector3; endTarget: THREE.Vector3;
    progress: number;
  } | null>(null);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { center, distance } = e.detail;
      const c = new THREE.Vector3(center[0], center[1], center[2]);
      const controls = store.controls as OrbitControlsLike | null;
      animRef.current = {
        startPos: camera.position.clone(),
        endPos: new THREE.Vector3(c.x, c.y + distance, c.z + 0.01),
        startTarget: controls?.target?.clone() || c.clone(),
        endTarget: c,
        progress: 0,
      };
    };
    window.addEventListener('focus-camera', handler as EventListener);
    return () => window.removeEventListener('focus-camera', handler as EventListener);
  }, [camera, store]);

  useFrame((_, delta) => {
    const anim = animRef.current;
    if (!anim) return;
    anim.progress += delta * 2.5;
    const t = Math.min(anim.progress, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out quad
    camera.position.lerpVectors(anim.startPos, anim.endPos, ease);
    const controls = store.controls as OrbitControlsLike | null;
    if (controls) {
      controls.target.lerpVectors(anim.startTarget, anim.endTarget, ease);
      controls.update();
    }
    if (t >= 1) animRef.current = null;
  });

  return null;
};
const BackgroundSwitcher: React.FC = () => {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color('#2d2d2d');
    const handler = (e: Event) => {
      const { color } = (e as CustomEvent).detail;
      scene.background = new THREE.Color(color);
    };
    window.addEventListener('set-bg', handler);
    return () => window.removeEventListener('set-bg', handler);
  }, [scene]);
  return null;
};

/** 标识可见性（模块级变量，所有组件共享） */
let _showDims = true, _showIds = true;
const _visListeners: Array<() => void> = [];
function _notifyVis() { _visListeners.forEach((fn) => fn()); }
window.addEventListener('set-show-dims', ((e: Event) => { _showDims = (e as CustomEvent).detail.show; _notifyVis(); }) as EventListener);
window.addEventListener('set-show-shelf-ids', ((e: Event) => { _showIds = (e as CustomEvent).detail.show; _notifyVis(); }) as EventListener);

/** 隔板 ID 标签（自动响应可见性切换） */
const ShelfLabel: React.FC<{ position: [number, number, number]; label: string }> = ({ position, label }) => {
  const [, update] = useState(0);
  useEffect(() => {
    const fn = () => update((n) => n + 1);
    _visListeners.push(fn);
    return () => { const i = _visListeners.indexOf(fn); if (i >= 0) _visListeners.splice(i, 1); };
  }, []);
  if (!_showIds) return null;
  return (
    <group position={position}>
      <Text fontSize={0.055} color="#fff" anchorX="left" anchorY="middle" outlineWidth={0.008} outlineColor="#000">{label}</Text>
    </group>
  );
};

/** 尺寸标识容器（仅在 _showDims 为 true 时渲染子元素） */
const DimsGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, update] = useState(0);
  useEffect(() => {
    const fn = () => update((n) => n + 1);
    _visListeners.push(fn);
    return () => { const i = _visListeners.indexOf(fn); if (i >= 0) _visListeners.splice(i, 1); };
  }, []);
  if (!_showDims) return null;
  return <>{children}</>;
};

/** 浮窗工具栏按钮 */
const Btn: React.FC<{ onClick: () => void; active?: boolean; style?: React.CSSProperties; children: React.ReactNode }> = ({ onClick, active, style, children }) => (
  <button onClick={onClick} style={{
    width: 34, height: 34, borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 18, lineHeight: '34px', textAlign: 'center', padding: 0,
    background: active ? '#4f8cff' : '#f0f0f0',
    color: active ? '#fff' : '#333',
    transition: 'all 0.1s',
    ...style,
  }}>{children}</button>
);
const Div: React.FC = () => <div style={{ width: 1, height: 26, background: '#e0e0e0', margin: '0 4px', flexShrink: 0 }} />;

const SceneView: React.FC<SceneProps> = ({ dimensions, profile, columns, layers, selectedLayerId, selectedItemType, selectedPlacedItem, onPlaceItem, onSelectPlacedItem, onTransformPlacedItem }) => {
  const W = dimensions.width / 1000;
  const H = dimensions.height / 1000;
  const D = dimensions.depth / 1000;
  const cx = W / 2, cy = H / 2, cz = D / 2;
  const maxDim = Math.max(W, H, D);
  const dist = maxDim * 2.5;
  const g = 0.1;

  const profileStr = profile[1] || '';
  const profileMM = parseInt(profileStr.substring(0, 2)) || 40;
  const t = profileMM / 1000;

  const shape = useMemo(() => makeProfileShape(t, profile), [t, profile]);

  // 顶板立杆连接状态
  const topLayer = layers.find((l) => l.type === 'top');
  const cols = topLayer?.detail.topColumns || { fl: true, fr: true, bl: true, br: true };

  // 顶板下第一个延伸至立柱的层，用于截断未勾选的立杆
  const topElev = topLayer ? topLayer.detail.elevation / 1000 : H;
  const fullWidthLayers = layers
    .filter((l) => l.type !== 'top' && (l.detail.elevation / 1000) < topElev - 0.001)
    .filter((l) => l.detail.frontConnect === 'extend')
    .sort((a, b) => b.detail.elevation - a.detail.elevation);
  const capY = fullWidthLayers.length > 0
    ? fullWidthLayers[0].detail.elevation / 1000 - fullWidthLayers[0].detail.thickness / 2000
    : H;

  // 各面额外立柱截止层（空字符串=全高），从 columns.*Cap 读取层 ID
  const getFaceCap = (side: 'front' | 'back' | 'left' | 'right') => {
    const capKey = side + 'Cap' as 'frontCap' | 'backCap' | 'leftCap' | 'rightCap';
    const capLayerId = columns[capKey];
    if (!capLayerId) return H;
    const capLayer = layers.find(l => l.id === capLayerId);
    if (!capLayer) return H;
    return capLayer.detail.elevation / 1000;
  };

  // 4 根角柱 — 顶板立杆连接决定是否延伸到顶
  const cornerBeams: BeamDef[] = (() => {
    const colDefs: Array<{ pos: [number, number, number]; key: keyof typeof cols }> = [
      { pos: [0, cy, D], key: 'fl' },
      { pos: [W, cy, D], key: 'fr' },
      { pos: [0, cy, 0], key: 'bl' },
      { pos: [W, cy, 0], key: 'br' },
    ];

    return colDefs.map(({ pos, key }) => {
      const fullH = cols[key] !== false;
      const colH = fullH ? H : capY;
      const colCy = colH / 2;
      return fullH
        ? { pos: [pos[0], cy, pos[2]], size: [t, H, t] }
        : { pos: [pos[0], colCy, pos[2]], size: [t, colH, t] };
    });
  })();

  // 额外加强筋（不接触地面，在上下横梁之间）
  const extraBeams: BeamDef[] = [];

  const addCols = (positions: number[], xFixed: number | null, zFixed: number | null, side: 'front' | 'back' | 'left' | 'right') => {
    const capped =
      (side === 'front' && (cols.fl === false || cols.fr === false)) ||
      (side === 'back' && (cols.bl === false || cols.br === false)) ||
      (side === 'left' && (cols.fl === false || cols.bl === false)) ||
      (side === 'right' && (cols.fr === false || cols.br === false));
    for (const p of positions) {
      const x = xFixed !== null ? xFixed : p;
      const z = zFixed !== null ? zFixed : p;
      // 各面立柱截止标高由 columns.*Cap 控制（0=全高）
      const cornerCap = capped ? capY : H;
      const faceCap = getFaceCap(side);
      const pillarCap = Math.min(cornerCap, faceCap);
      const h = Math.max(pillarCap - t, 0.01);
      const y = t + h / 2;
      extraBeams.push({ pos: [x, y, z], size: [t, h, t] });
    }
  };

  const spaced = (count: number, len: number) =>
    Array.from({ length: count }, (_, i) => (len / (count + 1)) * (i + 1));

  addCols(spaced(columns.front, W), null, D, 'front');
  addCols(spaced(columns.back, W), null, 0, 'back');
  addCols(spaced(columns.left, D), 0, null, 'left');
  addCols(spaced(columns.right, D), W, null, 'right');

  // 顶面/底面横向加强筋（沿 Z 方向）
  for (const x of spaced(columns.top, W)) {
    extraBeams.push({ pos: [x, H - t / 2, cz], size: [t, t, D - t] });
  }
  for (const x of spaced(columns.bottom, W)) {
    extraBeams.push({ pos: [x, t / 2, cz], size: [t, t, D - t] });
  }

  // 计算顶部横梁的起止位置（根据立杆连接补缺）
  const tf = cols.fl !== false ? t / 2 : -t / 2;
  const tF = cols.fr !== false ? W - t / 2 : W + t / 2;
  const tb = cols.bl !== false ? t / 2 : -t / 2;
  const tB = cols.br !== false ? W - t / 2 : W + t / 2;
  const hasTopLayer = layers.some((l) => l.type === 'top');

  const topBeams: BeamDef[] = hasTopLayer ? [] : [
    { pos: [(tf + tF) / 2 as number, H - t / 2, D] as [number, number, number], size: [tF - tf, t, t] as [number, number, number] },
    { pos: [(tb + tB) / 2 as number, H - t / 2, 0] as [number, number, number], size: [tB - tb, t, t] as [number, number, number] },
    { pos: [0, H - t / 2, cz] as [number, number, number], size: [t, t, D - t] as [number, number, number] },
    { pos: [W, H - t / 2, cz] as [number, number, number], size: [t, t, D - t] as [number, number, number] },
  ];

  const bf = columns.bottomFrame || 'full';
  const beams: BeamDef[] = [
    ...cornerBeams,
    ...extraBeams,
    // 底部横向
    ...((bf === 'full' || bf === 'frontback') ? [
      { pos: [cx, t / 2, D] as [number, number, number], size: [W - t, t, t] as [number, number, number] },
      { pos: [cx, t / 2, 0] as [number, number, number], size: [W - t, t, t] as [number, number, number] },
    ] : []),
    ...((bf === 'full' || bf === 'leftright') ? [
      { pos: [0, t / 2, cz] as [number, number, number], size: [t, t, D - t] as [number, number, number] },
      { pos: [W, t / 2, cz] as [number, number, number], size: [t, t, D - t] as [number, number, number] },
    ] : []),
    ...topBeams,
  ];

  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      camera={{ position: [cx - dist * 0.65, cy + dist * 0.7, cz + dist * 0.8], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1} />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />
      <pointLight position={[0, 5, 0]} intensity={0.5} />

      {beams.map((b, i) => <ProfileBeam key={i} pos={b.pos} size={b.size} shape={shape} />)}

      {/* 层板 */}
      {(() => {
        const shelfLayers = layers.filter((l) => l.type === 'shelf');
        return layers.map((layer) => {
          const lx = layer.detail.length / 1000;
          const lz = layer.detail.width / 1000;
          const ly = layer.detail.elevation / 1000;
          const lt = layer.detail.thickness / 1000;
          const isShelf = layer.type === 'shelf';
          const hasFrame = layer.type === 'countertop' || layer.type === 'shelf' || layer.type === 'top';
          const shelfNum = isShelf ? shelfLayers.indexOf(layer) + 1 : 0;
          // 搁板对齐位置：靠左/居中/靠右
          const halign = layer.detail.halign || 'left';
          const zOffset = halign === 'left' ? 0 : halign === 'right' ? D - lz : (D - lz) / 2;

          // 该层边框型材尺寸
          const pt = (() => {
            const raw = layer.detail.profileType || profile[1] || '';
            const parts = raw.split('-');
            const numStr = parts[parts.length - 1]?.substring(0, 2) || '';
            return (parseInt(numStr) || profileMM) / 1000;
          })();

          return (
            <group key={layer.id}>
              {/* 层板本体 */}
              <mesh position={[lx / 2, ly, zOffset + lz / 2]}>
                <boxGeometry args={[lx, lt, lz]} />
                <meshStandardMaterial
                  color={layer.color}
                  roughness={0.5}
                  metalness={0.1}
                  transparent={true}
                  opacity={selectedLayerId ? (layer.id === selectedLayerId ? 1.0 : 0.15) : 1.0}
                />
              </mesh>
              {/* 底部边框 — 前端连接方式决定左右横杆长度 */}
              {hasFrame && (() => {
                const isTop = layer.type === 'top';
                const fc = layer.detail.frontConnect || 'extend';
                // 'up'/'down'/'drop' 时侧梁不延伸（垂直柱另外处理）, 'extend' 时延伸至立柱
                const connect = isTop ? 'none' : ((lz >= D - 0.001) ? 'extend' :
                  (fc === 'up' || fc === 'down' || fc === 'drop' || fc === 'none') ? 'none' : 'extend');
                const lrZ = connect === 'extend' ? cz : zOffset + (t + lz) / 2;
                const lrLen = connect === 'extend' ? D - t : lz;
                return (
                  <>
                    <ProfileBeam pos={[lx / 2, ly - lt / 2 - pt / 2, zOffset + lz]} size={[lx - pt, pt, pt]} shape={shape} />
                    <ProfileBeam pos={[lx / 2, ly - lt / 2 - pt / 2, zOffset]} size={[lx - pt, pt, pt]} shape={shape} />
                    <ProfileBeam pos={[0, ly - lt / 2 - pt / 2, lrZ]} size={[pt, pt, lrLen]} shape={shape} />
                    <ProfileBeam pos={[lx, ly - lt / 2 - pt / 2, lrZ]} size={[pt, pt, lrLen]} shape={shape} />
                  </>
                );
              })()}
              {/* 上连/下连型材（取代原 drop） — 竖柱连接到型材而非层面 */}
              {hasFrame && (layer.detail.frontConnect === 'up' || layer.detail.frontConnect === 'drop') && (() => {
                // 查找上层结构（用于确定连接目标高度）
                const above = layers.find((l) => {
                  const le = l.detail.elevation / 1000;
                  return le > ly + 0.001 && (l.type === 'countertop' || l.type === 'shelf' || l.type === 'top');
                });
                if (!above) return null;
                const aly = above.detail.elevation / 1000;
                const alt = above.detail.thickness / 1000;
                const abovePT = (() => {
                  const raw = above.detail.profileType || profile[1] || '';
                  const parts = raw.split('-');
                  const numStr = parts[parts.length - 1]?.substring(0, 2) || '';
                  return (parseInt(numStr) || profileMM) / 1000;
                })();
                const aboveLz = above.detail.width / 1000;
                // 判断上层是否延伸至立柱（型材在 z=0 和 z=D）
                const aboveExtends = aboveLz >= D - 0.001 || above.detail.frontConnect === 'extend';
                // 连接目标 Y：到上层型材底部（而非层面）
                const dropTop = above.type === 'top' ? aly - alt / 2 : aly - alt / 2 - abovePT;
                const dropBot = ly - lt / 2;
                const dropH = Math.max(dropTop - dropBot, 0.001);
                // 如果上层延伸至立柱，竖柱放到立柱位置(z=D/z=0)，并加过渡横梁连接搁板边缘
                const frontZ = aboveExtends ? D : zOffset + lz;
                const backZ = aboveExtends ? 0 : zOffset;
                return (
                  <>
                    {/* 过渡横梁：从搁板前缘到立柱 */}
                    {aboveExtends && zOffset + lz < D - 0.001 && (
                      <>
                        <ProfileBeam pos={[0, dropBot + pt / 2, (zOffset + lz + D) / 2]} size={[pt, pt, D - (zOffset + lz)]} shape={shape} />
                        <ProfileBeam pos={[lx, dropBot + pt / 2, (zOffset + lz + D) / 2]} size={[pt, pt, D - (zOffset + lz)]} shape={shape} />
                      </>
                    )}
                    {/* 过渡横梁：从立柱到搁板后缘 */}
                    {aboveExtends && zOffset > 0.001 && (
                      <>
                        <ProfileBeam pos={[0, dropBot + pt / 2, zOffset / 2]} size={[pt, pt, zOffset]} shape={shape} />
                        <ProfileBeam pos={[lx, dropBot + pt / 2, zOffset / 2]} size={[pt, pt, zOffset]} shape={shape} />
                      </>
                    )}
                    {/* 前柱（z=D） */}
                    <ProfileBeam pos={[0, dropBot + dropH / 2, frontZ]} size={[pt, dropH, pt]} shape={shape} />
                    <ProfileBeam pos={[lx, dropBot + dropH / 2, frontZ]} size={[pt, dropH, pt]} shape={shape} />
                    {/* 后柱（z=0） */}
                    {aboveExtends && (
                      <>
                        <ProfileBeam pos={[0, dropBot + dropH / 2, backZ]} size={[pt, dropH, pt]} shape={shape} />
                        <ProfileBeam pos={[lx, dropBot + dropH / 2, backZ]} size={[pt, dropH, pt]} shape={shape} />
                      </>
                    )}
                  </>
                );
              })()}

              {/* 下连型材 — 竖柱向下连接到下层型材 */}
              {hasFrame && layer.detail.frontConnect === 'down' && (() => {
                const below = [...layers].reverse().find((l) => {
                  const le = l.detail.elevation / 1000;
                  return le < ly - 0.001 && (l.type === 'countertop' || l.type === 'shelf' || l.type === 'bottom');
                });
                if (!below) return null;
                const bly = below.detail.elevation / 1000;
                const blt = below.detail.thickness / 1000;
                const belowPT = (() => {
                  const raw = below.detail.profileType || profile[1] || '';
                  const parts = raw.split('-');
                  const numStr = parts[parts.length - 1]?.substring(0, 2) || '';
                  return (parseInt(numStr) || profileMM) / 1000;
                })();
                const belowLz = below.detail.width / 1000;
                const belowExtends = belowLz >= D - 0.001 || below.detail.frontConnect === 'extend';
                // 连接目标 Y：到下层型材顶部（而非层面）
                const dropBot = below.type === 'bottom' ? bly + blt / 2 : bly + blt / 2 + belowPT;
                const dropTop = ly - lt / 2;
                const dropH = Math.max(dropTop - dropBot, 0.001);
                const frontZ = belowExtends ? D : zOffset + lz;
                const backZ = belowExtends ? 0 : zOffset;
                return (
                  <>
                    {/* 过渡横梁 */}
                    {belowExtends && zOffset + lz < D - 0.001 && (
                      <>
                        <ProfileBeam pos={[0, dropBot + dropH / 2 - pt / 2, (zOffset + lz + D) / 2]} size={[pt, pt, D - (zOffset + lz)]} shape={shape} />
                        <ProfileBeam pos={[lx, dropBot + dropH / 2 - pt / 2, (zOffset + lz + D) / 2]} size={[pt, pt, D - (zOffset + lz)]} shape={shape} />
                      </>
                    )}
                    {belowExtends && zOffset > 0.001 && (
                      <>
                        <ProfileBeam pos={[0, dropBot + dropH / 2 - pt / 2, zOffset / 2]} size={[pt, pt, zOffset]} shape={shape} />
                        <ProfileBeam pos={[lx, dropBot + dropH / 2 - pt / 2, zOffset / 2]} size={[pt, pt, zOffset]} shape={shape} />
                      </>
                    )}
                    {/* 前柱 */}
                    <ProfileBeam pos={[0, dropBot + dropH / 2, frontZ]} size={[pt, dropH, pt]} shape={shape} />
                    <ProfileBeam pos={[lx, dropBot + dropH / 2, frontZ]} size={[pt, dropH, pt]} shape={shape} />
                    {/* 后柱 */}
                    {belowExtends && (
                      <>
                        <ProfileBeam pos={[0, dropBot + dropH / 2, backZ]} size={[pt, dropH, pt]} shape={shape} />
                        <ProfileBeam pos={[lx, dropBot + dropH / 2, backZ]} size={[pt, dropH, pt]} shape={shape} />
                      </>
                    )}
                  </>
                );
              })()}
              {/* 加强筋 */}
              {hasFrame && layer.detail.ribCount > 0 && (() => {
                const n = layer.detail.ribCount;
                const dir = layer.detail.ribDirection || 'x';
                return Array.from({ length: n }, (_, i) => {
                  if (dir === 'x') {
                    const zPos = zOffset + (lz / (n + 1)) * (i + 1);
                    return <ProfileBeam key={`rib-${i}`} pos={[lx / 2, ly - lt / 2 - pt / 2, zPos]} size={[lx - pt, pt, pt]} shape={shape} />;
                  } else {
                    const xPos = (lx / (n + 1)) * (i + 1);
                    return <ProfileBeam key={`rib-${i}`} pos={[xPos, ly - lt / 2 - pt / 2, zOffset + lz / 2]} size={[pt, pt, lz - pt]} shape={shape} />;
                  }
                });
              })()}
              {isShelf && (
                <ShelfLabel position={[lx + 0.08, ly, zOffset + lz / 2]} label={`#${shelfNum}`} />
              )}
              {/* 已放置的物品 — 仅选中层可见 */}
              {layer.detail.layout && layer.detail.placedItems.length > 0 && (!selectedLayerId || selectedLayerId === layer.id) && (() => {
                const [cols, rows] = layer.detail.layout.split('X').map(Number);
                if (!cols || !rows) return null;
                const cw = lx / cols;
                const ch = lz / rows;
                const topY = ly + lt / 2;
                return layer.detail.placedItems.map((pi) => {
                  const Comp = ITEM_COMPONENTS[pi.itemType];
                  const info = ITEM_MAP.get(pi.itemType);
                  if (!Comp || !info) return null;
                  const cellX = pi.col * cw + cw / 2;
                  const cellZ = zOffset + pi.row * ch + ch / 2;
                  const scaleX = (cw * 0.65) / info.size[0];
                  const scaleZ = (ch * 0.65) / info.size[1];
                  const s = Math.min(scaleX, scaleZ, 0.35);
                  const userScale = pi.scale || 1;
                  const itemH = info.size[2] * s * userScale;
                  const itemY = topY + itemH / 2 + 0.001;
                  const isSelected = selectedPlacedItem?.layerId === layer.id && selectedPlacedItem?.col === pi.col && selectedPlacedItem?.row === pi.row;
                  return (
                    <group key={`${pi.col}-${pi.row}`}>
                      {/* 选中高亮 */}
                      {isSelected && (
                        <mesh position={[cellX, topY + 0.002, cellZ]} rotation={[-Math.PI / 2, 0, 0]}>
                          <planeGeometry args={[cw * 0.9, ch * 0.9]} />
                          <meshBasicMaterial color="#4f8cff" transparent opacity={0.3} depthWrite={false} />
                        </mesh>
                      )}
                      <mesh position={[cellX, topY + 0.002, cellZ]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[cw * 0.85, ch * 0.85]} />
                        <meshBasicMaterial color="#4f8cff" transparent opacity={0.12} depthWrite={false} />
                      </mesh>
                      <group
                        position={[cellX, itemY, cellZ]}
                        rotation={[0, ((pi.rotation || 0) * Math.PI) / 180, 0]}
                      >
                        <group scale={[
                          s * userScale * (pi.flipX ? -1 : 1),
                          s * userScale,
                          s * userScale * (pi.flipY ? -1 : 1),
                        ]}>
                          <Comp scale={1} />
                        </group>
                      </group>
                      {/* 3D 浮窗变形工具栏 */}
                      {isSelected && (
                        <Html position={[cellX, topY + 0.15, cellZ]} center style={{ pointerEvents: 'none' }}>
                          <div style={{
                            background: '#fff', borderRadius: 10, padding: '8px 14px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                            display: 'flex', gap: 4, alignItems: 'center',
                            pointerEvents: 'auto', userSelect: 'none',
                            fontSize: 15,
                          }}>
                            <Btn onClick={() => onTransformPlacedItem?.(layer.id, pi.col, pi.row, 'scale', Math.max(0.3, userScale - 0.1))}>−</Btn>
                            <span style={{ fontWeight: 700, minWidth: 30, textAlign: 'center', fontSize: 14 }}>{userScale.toFixed(1)}</span>
                            <Btn onClick={() => onTransformPlacedItem?.(layer.id, pi.col, pi.row, 'scale', Math.min(3, userScale + 0.1))}>+</Btn>
                            <Div />
                            <Btn onClick={() => onTransformPlacedItem?.(layer.id, pi.col, pi.row, 'rotation', ((pi.rotation || 0) - 90 + 360) % 360)}>↺</Btn>
                            <Btn onClick={() => onTransformPlacedItem?.(layer.id, pi.col, pi.row, 'rotation', ((pi.rotation || 0) + 90) % 360)}>↻</Btn>
                            <Div />
                            <Btn active={!!pi.flipX} onClick={() => onTransformPlacedItem?.(layer.id, pi.col, pi.row, 'flipX', !pi.flipX)}>↔</Btn>
                            <Btn active={!!pi.flipY} onClick={() => onTransformPlacedItem?.(layer.id, pi.col, pi.row, 'flipY', !pi.flipY)}>↕</Btn>
                            <Div />
                            <Btn onClick={() => onPlaceItem?.(layer.id, pi.col, pi.row, null)} style={{ background: '#fee', color: '#e33' }}>🗑</Btn>
                            <Btn onClick={() => onSelectPlacedItem?.(layer.id, pi.col, pi.row)} style={{ color: '#999' }}>✕</Btn>
                          </div>
                        </Html>
                      )}
                    </group>
                  );
                });
              })()}
              {/* 编辑网格 — 仅选中时显示 */}
              {layer.id === selectedLayerId && layer.detail.layout && (() => {
                const [cols, rows] = layer.detail.layout.split('X').map(Number);
                if (!cols || !rows) return null;
                const cw = lx / cols;
                const ch = lz / rows;
                const pad = 0.005;
                const topY = ly + lt / 2;
                return (
                  <group>
                    {Array.from({ length: rows }, (_, ri) =>
                      Array.from({ length: cols }, (_, ci) => {
                        const cellX = ci * cw + cw / 2;
                        const cellZ = zOffset + ri * ch + ch / 2;
                        const hasItem = layer.detail.placedItems.some(
                          (p) => p.col === ci && p.row === ri
                        );
                        const isSelected = selectedPlacedItem?.layerId === layer.id && selectedPlacedItem?.col === ci && selectedPlacedItem?.row === ri;
                        const canPlace = !hasItem && !!selectedItemType;
                        const canSelect = hasItem && !selectedItemType;
                        return (
                          <GridCell
                            key={`${ri}-${ci}`}
                            size={[cw - pad * 2, ch - pad * 2]}
                            radius={0.008}
                            opacity={isSelected ? 0.5 : canPlace ? 0.45 : canSelect ? 0.2 : 0.08}
                            color={isSelected ? '#4f8cff' : canPlace ? '#4f8cff' : canSelect ? '#4f8cff' : 'white'}
                            position={[cellX, topY + 0.003, cellZ]}
                            onPointerDown={
                              canPlace ? (e) => { e.stopPropagation(); onPlaceItem?.(layer.id, ci, ri, selectedItemType!); } :
                              canSelect || isSelected ? (e) => { e.stopPropagation(); onSelectPlacedItem?.(layer.id, ci, ri); } :
                              undefined
                            }
                          />
                        );
                      })
                    )}
                  </group>
                );
              })()}
            </group>
          );
        });
      })()}

      <DimsGroup>
      <Line points={[[0, 0, D], [0, 0, D + g]]} color="#999" lineWidth={1} />
      <Line points={[[W, 0, D], [W, 0, D + g]]} color="#999" lineWidth={1} />
      <Line points={[[0, 0, D + g], [W, 0, D + g]]} color="#999" lineWidth={1} />
      <Text position={[W / 2, -0.02, D + g + 0.04]} fontSize={0.05} color="#fff" anchorX="center" anchorY="middle" outlineWidth={0.006} outlineColor="#000">{dimensions.width}mm</Text>

      <Line points={[[0, 0, 0], [-g, 0, 0]]} color="#999" lineWidth={1} />
      <Line points={[[0, 0, D], [-g, 0, D]]} color="#999" lineWidth={1} />
      <Line points={[[-g, 0, 0], [-g, 0, D]]} color="#999" lineWidth={1} />
      <Text position={[-g - 0.06, -0.02, D / 2]} fontSize={0.05} color="#fff" anchorX="center" anchorY="middle" outlineWidth={0.006} outlineColor="#000">{dimensions.depth}mm</Text>

      {/* 高 标注 — 延 X 负方向 */}
      <Line points={[[0, 0, 0], [-g, 0, 0]]} color="#999" lineWidth={1} />
      <Line points={[[0, H, 0], [-g, H, 0]]} color="#999" lineWidth={1} />
      <Line points={[[-g, 0, 0], [-g, H, 0]]} color="#999" lineWidth={1} />
      <Text position={[-g - 0.06, H / 2, 0]} fontSize={0.05} color="#fff" anchorX="center" anchorY="middle" outlineWidth={0.006} outlineColor="#000">{dimensions.height}mm</Text>

      </DimsGroup>
      <axesHelper args={[0.15]} />
      <Text position={[0.18, 0, 0]} fontSize={0.025} color="#ff6666" anchorX="center" anchorY="middle">X</Text>
      <Text position={[0, 0.18, 0]} fontSize={0.025} color="#66ff66" anchorX="center" anchorY="middle">Y</Text>
      <Text position={[0, 0, 0.18]} fontSize={0.025} color="#6666ff" anchorX="center" anchorY="middle">Z</Text>

      <CameraController />
      <CameraFocusController />
      <BackgroundSwitcher />
      <OrbitControls enableDamping dampingFactor={0.1} minDistance={0.3} maxDistance={20} target={[cx, cy, cz]} />
      <LocalEnvironment />
    </Canvas>
  );
};

export default SceneView;
