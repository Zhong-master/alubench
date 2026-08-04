import { RoundedBox } from '@react-three/drei';
import type { Item3DProps } from './types';

// ─── 打印机 ──────────────────────────────────────
export const Printer: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  return (
    <group scale={[s, s, s]}>
      {/* 机身 */}
      <RoundedBox args={[0.4, 0.20, 0.35]} radius={0.006}>
        <meshStandardMaterial color="#e8e8e8" roughness={0.5} metalness={0.1} />
      </RoundedBox>
      {/* 上盖 — 略凸 */}
      <RoundedBox args={[0.38, 0.03, 0.33]} radius={0.004} position={[0, 0.09, 0]}>
        <meshStandardMaterial color="#f0f0f0" roughness={0.4} metalness={0.1} />
      </RoundedBox>
      {/* 出纸口 */}
      <mesh position={[0, 0.108, 0.18]}>
        <boxGeometry args={[0.25, 0.008, 0.01]} />
        <meshStandardMaterial color="#222" roughness={0.8} />
      </mesh>
      {/* 进纸口 */}
      <mesh position={[0, -0.092, 0.18]}>
        <boxGeometry args={[0.28, 0.006, 0.008]} />
        <meshStandardMaterial color="#444" roughness={0.8} />
      </mesh>
      {/* 操作面板 */}
      <RoundedBox args={[0.14, 0.015, 0.06]} radius={0.003} position={[0, 0.105, 0.09]}>
        <meshStandardMaterial color="#2a2e32" roughness={0.6} />
      </RoundedBox>
      {/* 屏幕 */}
      <mesh position={[0.035, 0.113, 0.11]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.04, 0.024]} />
        <meshStandardMaterial color="#002244" emissive="#003366" emissiveIntensity={0.3} roughness={0.1} />
      </mesh>
      {/* 按键 */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.045 + i * 0.025, 0.113, 0.105]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.0035, 8]} />
          <meshStandardMaterial color="#555" roughness={0.7} />
        </mesh>
      ))}
      {/* 电源指示灯 */}
      <mesh position={[-0.055, 0.113, 0.115]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.002, 8]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} />
      </mesh>
      {/* 出纸托架 */}
      <mesh position={[0, -0.067, 0.185]}>
        <RoundedBox args={[0.3, 0.005, 0.06]} radius={0.003}>
          <meshStandardMaterial color="#ccc" roughness={0.6} />
        </RoundedBox>
      </mesh>
      {/* 通风口格栅 */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[i * 0.03 - 0.105, 0.067, -0.18]}>
          <boxGeometry args={[0.022, 0.003, 0.005]} />
          <meshStandardMaterial color="#555" roughness={0.8} />
        </mesh>
      ))}
      {/* 底脚 */}
      {[[-0.15, -0.108, -0.14], [0.15, -0.108, -0.14], [-0.15, -0.108, 0.14], [0.15, -0.108, 0.14]].map(
        (p, i) => (
          <mesh key={i} position={[p[0], p[1], p[2]]}>
            <cylinderGeometry args={[0.008, 0.01, 0.006, 8]} />
            <meshStandardMaterial color="#333" roughness={0.9} />
          </mesh>
        )
      )}
    </group>
  );
};
