import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { Item3DProps } from './types';

// ─── 工控机 ─────────────────────────────────────
export const IndustrialPC: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  return (
    <group scale={[s, s, s]}>
      {/* 主体 — 深灰色铝合金外壳 */}
      <RoundedBox args={[0.32, 0.065, 0.26]} radius={0.006}>
        <meshStandardMaterial color="#3a3e42" roughness={0.3} metalness={0.5} />
      </RoundedBox>
      {/* 顶部散热鳍片 ×10 */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[i * 0.028 - 0.126, 0.038, 0]}>
          <boxGeometry args={[0.022, 0.008, 0.2]} />
          <meshStandardMaterial color="#b0b8c0" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
      {/* 前面板 — 银色 */}
      <mesh position={[0, 0, 0.13]}>
        <RoundedBox args={[0.32, 0.065, 0.004]} radius={0.003}>
          <meshStandardMaterial color="#c8d0d8" roughness={0.35} metalness={0.4} />
        </RoundedBox>
      </mesh>
      {/* 前面板凹陷区域 */}
      <mesh position={[0, 0.005, 0.133]}>
        <planeGeometry args={[0.2, 0.045]} />
        <meshStandardMaterial color="#1a1c1e" roughness={0.8} />
      </mesh>
      {/* 电源指示灯 LED */}
      <mesh position={[-0.095, 0.017, 0.134]}>
        <circleGeometry args={[0.003, 12]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.8} />
      </mesh>
      {/* 运行指示灯 LED */}
      <mesh position={[-0.08, 0.017, 0.134]}>
        <circleGeometry args={[0.003, 12]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff4444" emissiveIntensity={0.3} />
      </mesh>
      {/* 电源按钮 */}
      <mesh position={[0.08, 0.017, 0.134]}>
        <circleGeometry args={[0.006, 16]} />
        <meshStandardMaterial color="#555" roughness={0.5} />
      </mesh>
      {/* 侧面散热开孔（左侧 ×8） */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`vent-l-${i}`} position={[-0.163, i * 0.004 - 0.014, 0.05]}>
          <boxGeometry args={[0.002, 0.002, 0.01]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}
      {/* 侧面散热开孔（右侧 ×8） */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`vent-r-${i}`} position={[0.163, i * 0.004 - 0.014, 0.05]}>
          <boxGeometry args={[0.002, 0.002, 0.01]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}
      {/* 壁挂安装支架 — 左侧 */}
      <mesh position={[-0.164, 0, 0]}>
        <boxGeometry args={[0.004, 0.048, 0.2]} />
        <meshStandardMaterial color="#c8d0d8" roughness={0.35} metalness={0.5} />
      </mesh>
      {/* 壁挂安装支架 — 右侧 */}
      <mesh position={[0.164, 0, 0]}>
        <boxGeometry args={[0.004, 0.048, 0.2]} />
        <meshStandardMaterial color="#c8d0d8" roughness={0.35} metalness={0.5} />
      </mesh>
      {/* 支架固定螺钉 ×4 */}
      {[[-0.164, -0.015, 0.08], [-0.164, 0.015, 0.08], [-0.164, -0.015, -0.08], [-0.164, 0.015, -0.08]].map((pos, i) => (
        <mesh key={`scr-l-${i}`} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.002, 0.002, 0.006, 8]} />
          <meshStandardMaterial color="#888" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {[[0.164, -0.015, 0.08], [0.164, 0.015, 0.08], [0.164, -0.015, -0.08], [0.164, 0.015, -0.08]].map((pos, i) => (
        <mesh key={`scr-r-${i}`} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.002, 0.002, 0.006, 8]} />
          <meshStandardMaterial color="#888" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
};

// ─── 笔记本电脑（敞开展示）────────────────────────
export const Laptop: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  const screenAngle = -0.35; // ~110° 开合角度（略大于直角）
  return (
    <group scale={[s, s, s]}>
      {/* === 底座 — 一体式机身，顶面即键盘面 === */}
      <RoundedBox args={[0.34, 0.012, 0.24]} radius={0.005} position={[0, -0.006, 0]}>
        <meshStandardMaterial color="#2a2e32" roughness={0.5} metalness={0.2} />
      </RoundedBox>
      {/* 键盘面纹理 */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.32, 0.22]} />
        <meshStandardMaterial color="#1a1c1e" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* 键盘区 — 靠近转轴（后方） */}
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 12 }, (_, col) => (
          <mesh
            key={`${row}-${col}`}
            position={[
              col * 0.022 - 0.11,
              0.002,
              row * 0.016 - 0.07,
            ]}
          >
            <boxGeometry args={[0.018, 0.0015, 0.013]} />
            <meshStandardMaterial color="#222" roughness={0.8} />
          </mesh>
        ))
      )}
      {/* 空格键 */}
      <mesh position={[0, 0.002, 0.01]}>
        <boxGeometry args={[0.08, 0.0015, 0.013]} />
        <meshStandardMaterial color="#222" roughness={0.8} />
      </mesh>
      {/* 触摸板 */}
      <RoundedBox args={[0.05, 0.0015, 0.032]} radius={0.003} position={[0, 0.002, 0.05]}>
        <meshStandardMaterial color="#444" roughness={0.3} />
      </RoundedBox>
      {/* 前置指示灯 */}
      <mesh position={[0, 0.002, 0.125]}>
        <circleGeometry args={[0.0015, 6]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.5} />
      </mesh>
      {/* 侧面接口 */}
      <mesh position={[0.175, -0.003, -0.02]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.01, 0.004, 0.004]} />
        <meshStandardMaterial color="#555" roughness={0.6} />
      </mesh>
      <mesh position={[0.175, -0.003, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.01, 0.003, 0.003]} />
        <meshStandardMaterial color="#444" roughness={0.6} />
      </mesh>

      {/* === 转轴（水平横杆） === */}
      <mesh position={[0, 0.002, -0.115]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, 0.32, 12]} />
        <meshStandardMaterial color="#555" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* === 屏幕（绕转轴旋转） === */}
      <group position={[0, 0.002, -0.115]} rotation={[screenAngle, 0, 0]}>
        {/* 屏幕 A 面外壳 */}
        <mesh position={[0, 0.12, -0.004]}>
          <RoundedBox args={[0.33, 0.235, 0.006]} radius={0.004}>
            <meshStandardMaterial color="#1a1c1e" roughness={0.5} metalness={0.3} />
          </RoundedBox>
        </mesh>
        {/* 屏幕边框 */}
        <mesh position={[0, 0.12, 0.001]}>
          <planeGeometry args={[0.31, 0.215]} />
          <meshStandardMaterial color="#111" roughness={0.6} />
        </mesh>
        {/* 屏幕显示区 — 带渐变蓝色 */}
        <mesh position={[0, 0.125, 0.002]}>
          <planeGeometry args={[0.27, 0.18]} />
          <meshStandardMaterial
            color="#0a2a4a"
            roughness={0.05}
            metalness={0.6}
          />
        </mesh>
        {/* 摄像头 */}
        <mesh position={[0, 0.235, 0.002]}>
          <circleGeometry args={[0.002, 8]} />
          <meshStandardMaterial color="#222" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};

// ─── PDA 手持扫码器 ──────────────────────────────
export const PDA: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  return (
    <group scale={[s, s, s]}>
      {/* 橙色橡胶机身 — 整体包围 */}
      <RoundedBox args={[0.15, 0.07, 0.025]} radius={0.008}>
        <meshStandardMaterial color="#ff6600" roughness={0.8} />
      </RoundedBox>

      {/* 前面板 — 白色 */}
      <mesh position={[0, 0, 0.0135]}>
        <RoundedBox args={[0.13, 0.055, 0.001]} radius={0.004}>
          <meshStandardMaterial color="#f5f5f5" roughness={0.5} />
        </RoundedBox>
      </mesh>

      {/* 屏幕 */}
      <mesh position={[0, 0, 0.0145]}>
        <RoundedBox args={[0.11, 0.045, 0.001]} radius={0.003}>
          <meshStandardMaterial color="#0a1520" roughness={0.1} metalness={0.5} />
        </RoundedBox>
      </mesh>

      {/* 后面板 — 白色 */}
      <mesh position={[0, 0, -0.0135]}>
        <RoundedBox args={[0.13, 0.055, 0.001]} radius={0.004}>
          <meshStandardMaterial color="#f5f5f5" roughness={0.5} />
        </RoundedBox>
      </mesh>

      {/* 后面板扫描头 */}
      <group position={[0.055, 0, -0.0145]}>
        <RoundedBox args={[0.015, 0.025, 0.003]} radius={0.001}>
          <meshStandardMaterial color="#222" roughness={0.8} />
        </RoundedBox>
        <mesh position={[0, 0, -0.0025]}>
          <circleGeometry args={[0.004, 12]} />
          <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.3} />
        </mesh>
      </group>
    </group>
  );
};
