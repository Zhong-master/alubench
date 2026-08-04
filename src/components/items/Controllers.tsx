import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import type { Item3DProps } from './types';

// ─── 电源控制器 ──────────────────────────────────
export const PowerController: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  return (
    <group scale={[s, s, s]}>
      {/* 主体 — 铝合金U型外壳 */}
      <RoundedBox args={[0.22, 0.07, 0.18]} radius={0.004}>
        <meshStandardMaterial color="#c8d0d8" roughness={0.3} metalness={0.6} />
      </RoundedBox>

      {/* 底部散热鳍片 ×6 */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[i * 0.03 - 0.075, -0.038, 0]}>
          <boxGeometry args={[0.022, 0.006, 0.14]} />
          <meshStandardMaterial color="#b0b8c0" roughness={0.35} metalness={0.6} />
        </mesh>
      ))}

      {/* 前面板 — 黑色塑料面板 */}
      <mesh position={[0, 0, 0.093]}>
        <RoundedBox args={[0.18, 0.055, 0.003]} radius={0.002}>
          <meshStandardMaterial color="#1a1c1e" roughness={0.6} />
        </RoundedBox>
      </mesh>

      {/* 前面板内凹区域 */}
      <mesh position={[0, 0.005, 0.095]}>
        <planeGeometry args={[0.15, 0.036]} />
        <meshStandardMaterial color="#2a2e32" roughness={0.7} />
      </mesh>

      {/* AC输入端子排（L/N/PE）— 左侧 */}
      {Array.from({ length: 3 }, (_, i) => (
        <mesh key={`ac-${i}`} position={[-0.052 + i * 0.022, -0.015, 0.096]}>
          <boxGeometry args={[0.017, 0.008, 0.004]} />
          <meshStandardMaterial color="#889" roughness={0.7} metalness={0.3} />
        </mesh>
      ))}

      {/* DC输出端子排（+V / -V）— 右侧 */}
      {Array.from({ length: 2 }, (_, i) => (
        <mesh key={`dc-${i}`} position={[0.04 + i * 0.02, -0.015, 0.096]}>
          <boxGeometry args={[0.014, 0.008, 0.004]} />
          <meshStandardMaterial color="#889" roughness={0.7} metalness={0.3} />
        </mesh>
      ))}

      {/* 电源指示灯 DC OK */}
      <mesh position={[-0.075, 0.018, 0.096]}>
        <circleGeometry args={[0.003, 8]} />
        <meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={0.8} />
      </mesh>

      {/* 电压调节电位器 */}
      <mesh position={[0.068, 0.016, 0.096]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.003, 12]} />
        <meshStandardMaterial color="#333" roughness={0.5} />
      </mesh>

      {/* 顶面 — U型槽内凹效果 */}
      <mesh position={[0, 0.033, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.16, 0.14]} />
        <meshStandardMaterial color="#3a3e42" roughness={0.6} />
      </mesh>

      {/* 顶面铭牌 */}
      <mesh position={[0, 0.036, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.12, 0.1]} />
        <meshStandardMaterial color="#e0e4e8" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* 铭牌标签区域 */}
      <mesh position={[0, 0.037, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.09, 0.07]} />
        <meshStandardMaterial color="#d0d4d8" roughness={0.4} />
      </mesh>

      {/* 端子标识刻印（AC / DC 区域区分） */}
      <mesh position={[-0.035, -0.02, 0.096]}>
        <planeGeometry args={[0.008, 0.004]} />
        <meshStandardMaterial color="#888" roughness={0.6} />
      </mesh>
    </group>
  );
};

// ─── 光源控制器 ──────────────────────────────────
export const LightController: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  return (
    <group scale={[s, s, s]}>
      {/* 主体 */}
      <RoundedBox args={[0.2, 0.08, 0.18]} radius={0.004}>
        <meshStandardMaterial color="#2a2e32" roughness={0.5} metalness={0.2} />
      </RoundedBox>
      {/* 前面板 — 银色边框 */}
      <mesh position={[0, 0, 0.096]}>
        <RoundedBox args={[0.18, 0.065, 0.004]} radius={0.002}>
          <meshStandardMaterial color="#c8d0d8" roughness={0.3} metalness={0.5} />
        </RoundedBox>
      </mesh>
      {/* 4通道指示灯 — 第4通道往前挪避免与显示屏重叠 */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.065 + i * 0.04, 0.02, i < 3 ? 0.099 : 0.101]}>
          <circleGeometry args={[0.0025, 8]} />
          <meshStandardMaterial
            color="#ffff00"
            emissive={i < 2 ? '#ffff00' : '#444400'}
            emissiveIntensity={i < 2 ? 0.7 : 0.1}
          />
        </mesh>
      ))}
      {/* 数字显示屏 */}
      <mesh position={[0.05, 0.02, 0.099]}>
        <planeGeometry args={[0.035, 0.015]} />
        <meshStandardMaterial color="#001a00" emissive="#003300" emissiveIntensity={0.3} roughness={0.1} />
      </mesh>
      {/* 按钮 */}
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * 0.04, -0.015, 0.099]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.003, 12]} />
          <meshStandardMaterial color="#555" roughness={0.7} />
        </mesh>
      ))}
      {/* 侧面散热开孔 — 左侧 ×6 */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`vent-l-${i}`} position={[-0.102, 0, i * 0.024 - 0.06]}>
          <boxGeometry args={[0.003, 0.018, 0.014]} />
          <meshStandardMaterial color="#111" roughness={0.9} />
        </mesh>
      ))}
      {/* 侧面散热开孔 — 右侧 ×6 */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`vent-r-${i}`} position={[0.102, 0, i * 0.024 - 0.06]}>
          <boxGeometry args={[0.003, 0.018, 0.014]} />
          <meshStandardMaterial color="#111" roughness={0.9} />
        </mesh>
      ))}
      {/* 背面散热鳍片 */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[i * 0.025 - 0.05, 0, -0.082]}>
          <boxGeometry args={[0.018, 0.006, 0.004]} />
          <meshStandardMaterial color="#666" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
};

// ─── 插线板 ──────────────────────────────────────
export const PowerStrip: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  return (
    <group scale={[s, s, s]}>
      {/* 主体 */}
      <RoundedBox args={[0.3, 0.04, 0.06]} radius={0.006}>
        <meshStandardMaterial color="#e8e8e8" roughness={0.6} metalness={0.1} />
      </RoundedBox>
      {/* 插孔位 ×7 */}
      {Array.from({ length: 7 }, (_, i) => (
        <group key={i} position={[i * 0.035 - 0.105, 0.023, 0]}>
          {/* 三孔插座 */}
          <mesh position={[0, 0, -0.008]}>
            <boxGeometry args={[0.018, 0.004, 0.006]} />
            <meshStandardMaterial color="#ccc" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.008]}>
            <boxGeometry args={[0.018, 0.004, 0.006]} />
            <meshStandardMaterial color="#ccc" roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* 电源开关 */}
      <mesh position={[0.14, 0.024, 0]}>
        <RoundedBox args={[0.012, 0.008, 0.01]} radius={0.002}>
          <meshStandardMaterial color="#444" roughness={0.6} />
        </RoundedBox>
      </mesh>
      {/* 指示灯 */}
      <mesh position={[0.14, 0.024, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.002, 8]} />
        <meshStandardMaterial color="#ff3333" emissive="#ff0000" emissiveIntensity={0.4} />
      </mesh>
      {/* 电源线 */}
      <mesh position={[-0.165, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.004, 0.004, 0.05, 6]} />
        <meshStandardMaterial color="#222" roughness={0.9} />
      </mesh>
    </group>
  );
};

// ─── 产品箱子 ────────────────────────────────────
function makeBoxCanvas(
  faceW: number, faceH: number,
  tape1: boolean, tape2: boolean,
  nameplate?: boolean, label?: boolean
) {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  // 箱体底色
  ctx.fillStyle = '#a07030';
  ctx.fillRect(0, 0, S, S);

  // 顶面铭牌区域
  if (nameplate) {
    const nw = S * 0.6, nh = S * 0.55;
    const nx = (S - nw) / 2, ny = (S - nh) / 2;
    ctx.fillStyle = '#d4a85c';
    roundRect(ctx, nx, ny, nw, nh, 12);
    ctx.fill();
    ctx.fillStyle = '#c89a4a';
    roundRect(ctx, nx + nw * 0.12, ny + nh * 0.15, nw * 0.76, nh * 0.55, 8);
    ctx.fill();
  }

  // 侧面标签（右侧面）
  if (label) {
    const lw = S * 0.4, lh = S * 0.45;
    const lx = (S - lw) / 2, ly = (S - lh) / 2;
    ctx.fillStyle = '#e8c888';
    roundRect(ctx, lx, ly, lw, lh, 8);
    ctx.fill();
    ctx.fillStyle = '#d4a85c';
    ctx.fillRect(lx + lw * 0.15, ly + lh * 0.25, lw * 0.7, lh * 0.15);
    ctx.fillRect(lx + lw * 0.15, ly + lh * 0.55, lw * 0.7, lh * 0.1);
  }

  // 胶带 — 沿 faceW 方向
  if (tape1) {
    const tw = S * (0.025 / faceW);
    ctx.fillStyle = 'rgba(212,168,92,0.45)';
    ctx.fillRect(0, (S - tw) / 2, S, tw);
  }
  // 胶带 — 沿 faceH 方向
  if (tape2) {
    const tw = S * (0.025 / faceH);
    ctx.fillStyle = 'rgba(212,168,92,0.45)';
    ctx.fillRect((S - tw) / 2, 0, tw, S);
  }

  return canvas;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export const ProductBox: React.FC<Item3DProps> = ({ scale = 1 }) => {
  const s = scale;
  const W = 0.3, H = 0.15, D = 0.2;

  const textures = useMemo(() => {
    const faceConfigs = [
      { w: D, h: H, t1: true, t2: true, label: true   },  // +x
      { w: D, h: H, t1: true, t2: true                  },  // -x
      { w: W, h: D, t1: true, t2: true, nameplate: true },  // +y
      { w: W, h: D, t1: true, t2: true                  },  // -y
      { w: W, h: H, t1: true, t2: true                  },  // +z
      { w: W, h: H, t1: true, t2: true                  },  // -z
    ];
    return faceConfigs.map((cfg) => {
      const c = makeBoxCanvas(cfg.w, cfg.h, cfg.t1, cfg.t2, cfg.nameplate, cfg.label);
      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    });
  }, [W, H, D]);

  return (
    <group scale={[s, s, s]}>
      <mesh>
        <boxGeometry args={[W, H, D]} />
        {textures.map((tex, i) => (
          <meshStandardMaterial
            key={i}
            attach={`material-${i}`}
            map={tex}
            roughness={0.7}
            metalness={0}
          />
        ))}
      </mesh>
    </group>
  );
};
