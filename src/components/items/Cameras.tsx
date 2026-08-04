import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { Item3DProps } from './types';

// ─── 防水监控前罩截面（梯形向后延长至盖住整个机身）──
const bulletHoodShape = new THREE.Shape();
bulletHoodShape.moveTo(-0.18, 0);      // 后端底部
bulletHoodShape.lineTo(-0.18, 0.035);  // 后端顶部
bulletHoodShape.lineTo(0, 0.035);      // 前端顶部（前罩起点）
bulletHoodShape.lineTo(0.045, 0.035);  // 前罩最前端
bulletHoodShape.lineTo(0.0225, 0);     // 斜边与底部交点
bulletHoodShape.closePath();

// ─── 工业相机（含镜头总成）─────────────────────────
export const IndustrialCamera: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  return (
    <group scale={[s, s, s]}>
      {/* 主体 — 银色金属方块 */}
      <RoundedBox args={[0.055, 0.055, 0.055]} radius={0.003}>
        <meshStandardMaterial color="#c0c8d0" roughness={0.3} metalness={0.6} />
      </RoundedBox>
      {/* 前面板 — 黑色 */}
      <mesh position={[0, 0, 0.031]}>
        <RoundedBox args={[0.04, 0.04, 0.006]} radius={0.002}>
          <meshStandardMaterial color="#1a1c1e" roughness={0.6} />
        </RoundedBox>
      </mesh>
      {/* 镜头总成 — 前移到相机面板前方 */}
      <group position={[0, 0, 0.050]}>
        {/* 镜筒 (110mm C-mount 工业镜头) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.016, 0.022, 0.110, 24]} />
          <meshStandardMaterial color="#111" roughness={0.4} metalness={0.6} />
        </mesh>
        {/* 调焦环 */}
        <mesh position={[0, 0, 0.035]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.021, 0.021, 0.01, 24]} />
          <meshStandardMaterial color="#333" roughness={0.7} metalness={0.3} />
        </mesh>
        {/* 前端玻璃（在镜筒顶端） */}
        <mesh position={[0, 0, 0.054]}>
          <circleGeometry args={[0.014, 24]} />
          <meshStandardMaterial
            color="#4488cc"
            roughness={0.05}
            metalness={0.1}
            transparent
            opacity={0.4}
          />
        </mesh>
        {/* C 接口螺纹 */}
        <mesh position={[0, 0, -0.045]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.014, 0.004, 16]} />
          <meshStandardMaterial color="#555" roughness={0.6} metalness={0.4} />
        </mesh>
      </group>
      {/* 网口 */}
      <mesh position={[0.018, 0, -0.032]}>
        <boxGeometry args={[0.012, 0.008, 0.004]} />
        <meshStandardMaterial color="#666" roughness={0.8} />
      </mesh>
      {/* LED 指示灯 */}
      <mesh position={[0.012, 0.02, 0.034]}>
        <circleGeometry args={[0.002, 8]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} />
      </mesh>
      {/* 散热槽 */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0.025, i * 0.006 - 0.006, 0]}>
          <boxGeometry args={[0.006, 0.004, 0.03]} />
          <meshStandardMaterial color="#222" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
};

// ─── 球型监控 ────────────────────────────────────
export const DomeCamera: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  return (
    <group scale={[s, s, s]}>
      {/* 顶部大平移 — 简洁纯平圆盘（上半部分就是平面，没别的东西） */}
      <group position={[0, -0.015, 0]}>
        {/* 天花板底座 — 加厚圆盘 */}
        <mesh position={[0, 0.041, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.015, 32]} />
          <meshStandardMaterial color="#e8e8e8" roughness={0.5} metalness={0.2} />
        </mesh>
        {/* 底座下沿装饰环 */}
        <mesh position={[0, 0.032, 0]}>
          <cylinderGeometry args={[0.048, 0.05, 0.003, 32]} />
          <meshStandardMaterial color="#666" roughness={0.4} metalness={0.3} />
        </mesh>

        {/* 半球透明遮罩 — 下半球 */}
        <mesh position={[0, 0.034, 0]}>
          <sphereGeometry args={[0.042, 32, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial
            color="#8899aa"
            roughness={0.05}
            metalness={0.0}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* 内层磨砂半球 */}
        <mesh position={[0, 0.034, 0]}>
          <sphereGeometry args={[0.038, 24, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial
            color="#334"
            roughness={0.8}
            transparent
            opacity={0.08}
            side={THREE.BackSide}
          />
        </mesh>

        {/* 摄像头云台模组 */}
        <group position={[0, 0.02, 0]}>
          {/* 云台基座 */}
          <mesh>
            <cylinderGeometry args={[0.016, 0.022, 0.012, 16]} />
            <meshStandardMaterial color="#333" roughness={0.5} />
          </mesh>
          {/* 镜头筒 */}
          <mesh position={[0, 0, 0.016]}>
            <cylinderGeometry args={[0.01, 0.014, 0.016, 12]} />
            <meshStandardMaterial color="#111" roughness={0.4} metalness={0.3} />
          </mesh>
          {/* 镜头玻璃 */}
          <mesh position={[0, 0, 0.025]}>
            <circleGeometry args={[0.008, 12]} />
            <meshStandardMaterial color="#4488cc" roughness={0.05} metalness={0.1} />
          </mesh>
        </group>

        {/* 底座线缆口 */}
        <mesh position={[0, 0.049, 0]}>
          <cylinderGeometry args={[0.008, 0.01, 0.004, 12]} />
          <meshStandardMaterial color="#333" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
};

// ─── 防水监控（枪机）─────────────────────────
export const BulletCamera: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  return (
    <group scale={[s, s, s]}>
      {/* 主体长方体 — 截面对 +Z */}
      <mesh>
        <boxGeometry args={[0.08, 0.07, 0.18]} />
        <meshStandardMaterial color="#c0c6cc" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* 前端镜头 */}
      <group position={[0, -0.005, 0.091]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.016, 0.02, 0.03, 16]} />
          <meshStandardMaterial color="#111" roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.015]}>
          <circleGeometry args={[0.012, 16]} />
          <meshStandardMaterial color="#222" roughness={0.3} metalness={0.5} />
        </mesh>
      </group>
      {/* 前罩 — 掏空斜面，保留端板 */}
      {/* 左侧三角端板 */}
      <mesh position={[-0.0415, 0, 0.09]} rotation={[0, -Math.PI / 2, 0]}>
        <extrudeGeometry args={[bulletHoodShape, { depth: 0.003, bevelEnabled: false }]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} metalness={0.0} />
      </mesh>
      {/* 右侧三角端板（depth 负值使挤压朝 +X 向外） */}
      <mesh position={[0.0415, 0, 0.09]} rotation={[0, -Math.PI / 2, 0]}>
        <extrudeGeometry args={[bulletHoodShape, { depth: -0.003, bevelEnabled: false }]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} metalness={0.0} />
      </mesh>
      {/* 顶部盖板（从后到前全覆盖） */}
      <mesh position={[0, 0.036, 0.0225]}>
        <boxGeometry args={[0.089, 0.002, 0.225]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} metalness={0.0} />
      </mesh>
    </group>
  );
};
