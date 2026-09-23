import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line, Html } from '@react-three/drei';
import CameraController from './CameraController';
import * as THREE from 'three';
import { useMemo, useEffect, useState, useRef } from 'react';
import type { Layer } from './LeftPanel';
import type { ItemType } from './items';
import { ITEM_COMPONENTS, ITEM_MAP } from './items';
import type { OrbitControlsLike } from './threeTypes';
import type { SceneGeometry } from '../geometry';

interface SceneProps {
  dimensions: { width: number; depth: number; height: number };
  profile: string[];
  layers: Layer[];
  /** 共享几何内核实例（由 App 统一计算一次，BOM/校验/3D 共用，勿在本组件重算） */
  geometry: SceneGeometry;
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

const SceneView: React.FC<SceneProps> = ({ dimensions, profile, layers, geometry, selectedLayerId, selectedItemType, selectedPlacedItem, onPlaceItem, onSelectPlacedItem, onTransformPlacedItem }) => {
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

  // 共享几何内核：机架级型材 + 各层几何（板材/边框/连接/加强筋/物品占位）
  const beams = geometry.frameBeams;
  const layerGeom = useMemo(
    () => new Map(geometry.layers.map((lg) => [lg.layerId, lg] as const)),
    [geometry]
  );

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
          const shelfNum = isShelf ? shelfLayers.indexOf(layer) + 1 : 0;
          // 搁板对齐位置：靠左/居中/靠右
          const halign = layer.detail.halign || 'left';
          const zOffset = halign === 'left' ? 0 : halign === 'right' ? D - lz : (D - lz) / 2;
          // 该层几何（共享内核生成：板材/边框/连接/加强筋/物品占位）
          const lg = layerGeom.get(layer.id);

          return (
            <group key={layer.id}>
              {/* 层板本体（共享内核） */}
              {lg && (
                <mesh position={lg.board.pos}>
                  <boxGeometry args={lg.board.size} />
                  <meshStandardMaterial
                    color={layer.color}
                    roughness={0.5}
                    metalness={0.1}
                    transparent={true}
                    opacity={selectedLayerId ? (layer.id === selectedLayerId ? 1.0 : 0.15) : 1.0}
                  />
                </mesh>
              )}
              {/* 边框 / 上连下连型材 / 加强筋（共享内核生成，含尺寸真实性缩放） */}
              {lg?.beams.map((b, i) => (
                <ProfileBeam key={`lg-beam-${i}`} pos={b.pos} size={b.size} shape={shape} />
              ))}
              {isShelf && (
                <ShelfLabel position={[lx + 0.08, ly, zOffset + lz / 2]} label={`#${shelfNum}`} />
              )}
              {/* 已放置的物品 — 仅选中层可见（占位由共享内核计算） */}
              {layer.detail.layout && lg && lg.placements.length > 0 && (!selectedLayerId || selectedLayerId === layer.id) && (() => {
                const cw = lx / lg.gridCols;
                const ch = lz / lg.gridRows;
                const topY = ly + lt / 2;
                return lg.placements.map((p) => {
                  const Comp = ITEM_COMPONENTS[p.itemType];
                  const info = ITEM_MAP.get(p.itemType);
                  if (!Comp || !info) return null;
                  const isSelected = selectedPlacedItem?.layerId === layer.id && selectedPlacedItem?.col === p.col && selectedPlacedItem?.row === p.row;
                  return (
                    <group key={`${p.col}-${p.row}`}>
                      {/* 选中高亮 */}
                      {isSelected && (
                        <mesh position={[p.x, topY + 0.002, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
                          <planeGeometry args={[cw * 0.9, ch * 0.9]} />
                          <meshBasicMaterial color="#4f8cff" transparent opacity={0.3} depthWrite={false} />
                        </mesh>
                      )}
                      <mesh position={[p.x, topY + 0.002, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[cw * 0.85, ch * 0.85]} />
                        <meshBasicMaterial color="#4f8cff" transparent opacity={0.12} depthWrite={false} />
                      </mesh>
                      <group
                        position={[p.x, p.y, p.z]}
                        rotation={[0, (p.rotation * Math.PI) / 180, 0]}
                      >
                        <group scale={[
                          p.scale * (p.flipX ? -1 : 1),
                          p.scale,
                          p.scale * (p.flipY ? -1 : 1),
                        ]}>
                          <Comp scale={1} />
                        </group>
                      </group>
                      {/* 3D 浮窗变形工具栏 */}
                      {isSelected && (
                        <Html position={[p.x, topY + 0.15, p.z]} center style={{ pointerEvents: 'none' }}>
                          <div style={{
                            background: '#fff', borderRadius: 10, padding: '8px 14px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                            display: 'flex', gap: 4, alignItems: 'center',
                            pointerEvents: 'auto', userSelect: 'none',
                            fontSize: 15,
                          }}>
                            <Btn onClick={() => onTransformPlacedItem?.(layer.id, p.col, p.row, 'scale', Math.max(0.3, p.userScale - 0.1))}>−</Btn>
                            <span style={{ fontWeight: 700, minWidth: 30, textAlign: 'center', fontSize: 14 }}>{p.userScale.toFixed(1)}</span>
                            <Btn onClick={() => onTransformPlacedItem?.(layer.id, p.col, p.row, 'scale', Math.min(3, p.userScale + 0.1))}>+</Btn>
                            <Div />
                            <Btn onClick={() => onTransformPlacedItem?.(layer.id, p.col, p.row, 'rotation', ((p.rotation || 0) - 90 + 360) % 360)}>↺</Btn>
                            <Btn onClick={() => onTransformPlacedItem?.(layer.id, p.col, p.row, 'rotation', ((p.rotation || 0) + 90) % 360)}>↻</Btn>
                            <Div />
                            <Btn active={!!p.flipX} onClick={() => onTransformPlacedItem?.(layer.id, p.col, p.row, 'flipX', !p.flipX)}>↔</Btn>
                            <Btn active={!!p.flipY} onClick={() => onTransformPlacedItem?.(layer.id, p.col, p.row, 'flipY', !p.flipY)}>↕</Btn>
                            <Div />
                            <Btn onClick={() => onPlaceItem?.(layer.id, p.col, p.row, null)} style={{ background: '#fee', color: '#e33' }}>🗑</Btn>
                            <Btn onClick={() => onSelectPlacedItem?.(layer.id, p.col, p.row)} style={{ color: '#999' }}>✕</Btn>
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
