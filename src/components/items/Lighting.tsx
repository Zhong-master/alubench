import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { Item3DProps } from './types';

// ─── 工业条光 ────────────────────────────────────
export const BarLight: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  return (
    <group scale={[s, s, s]}>
      {/* 外壳 */}
      <RoundedBox args={[0.25, 0.03, 0.03]} radius={0.004}>
        <meshStandardMaterial color="#c0c8d0" roughness={0.3} metalness={0.5} />
      </RoundedBox>
      {/* 出光面 */}
      <mesh position={[0, -0.014, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.22, 0.02]} />
        <meshStandardMaterial
          color="#ffffee"
          emissive="#ffffcc"
          emissiveIntensity={0.3}
          roughness={0.6}
        />
      </mesh>
      {/* 端盖 */}
      <mesh position={[0.125, 0, 0]}>
        <boxGeometry args={[0.004, 0.026, 0.026]} />
        <meshStandardMaterial color="#888" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[-0.125, 0, 0]}>
        <boxGeometry args={[0.004, 0.026, 0.026]} />
        <meshStandardMaterial color="#888" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* 线缆出线 */}
      <mesh position={[-0.125, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.003, 0.003, 0.02, 6]} />
        <meshStandardMaterial color="#222" roughness={0.9} />
      </mesh>
    </group>
  );
};

// ─── 工业面光 ────────────────────────────────────
export const AreaLight: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  return (
    <group scale={[s, s, s]}>
      {/* 外壳 */}
      <RoundedBox args={[0.25, 0.025, 0.2]} radius={0.005}>
        <meshStandardMaterial color="#b0b8c0" roughness={0.3} metalness={0.5} />
      </RoundedBox>
      {/* 漫射板 */}
      <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.22, 0.17]} />
        <meshStandardMaterial
          color="#eeeedd"
          emissive="#ffffcc"
          emissiveIntensity={0.2}
          roughness={0.8}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* 安装孔 */}
      {[
        [-0.1, 0, -0.08],
        [0.1, 0, -0.08],
        [-0.1, 0, 0.08],
        [0.1, 0, 0.08],
      ].map((p, i) => (
        <mesh key={i} position={[p[0], 0.016, p[2]]}>
          <cylinderGeometry args={[0.003, 0.003, 0.004, 8]} />
          <meshStandardMaterial color="#666" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {/* 边框装饰 */}
      <mesh position={[0, 0.016, 0]}>
        <boxGeometry args={[0.23, 0.003, 0.005]} />
        <meshStandardMaterial color="#888" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
};

// ─── 工业环光 ────────────────────────────────────
export const RingLight: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  return (
    <group scale={[s, s, s]}>
      {/* 外壳 — 环形 */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.05, 0.015, 12, 32]} />
        <meshStandardMaterial color="#c0c8d0" roughness={0.3} metalness={0.5} />
      </mesh>
      {/* 内圈 — 出光面 */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.038, 0.05, 32]} />
        <meshStandardMaterial
          color="#ffffee"
          emissive="#ffffcc"
          emissiveIntensity={0.3}
          roughness={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 内孔 */}
      <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, 0.035, 32]} />
        <meshStandardMaterial color="#111" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* 线缆 */}
      <mesh position={[0.05, 0.015, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.003, 0.003, 0.025, 6]} />
        <meshStandardMaterial color="#222" roughness={0.9} />
      </mesh>
      {/* 安装螺丝 */}
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}-${z}`} position={[x * 0.042, 0.013, z * 0.042]}>
            <cylinderGeometry args={[0.002, 0.002, 0.003, 6]} />
            <meshStandardMaterial color="#666" roughness={0.6} metalness={0.4} />
          </mesh>
        ))
      )}
    </group>
  );
};
