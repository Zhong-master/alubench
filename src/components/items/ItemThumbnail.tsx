import { useEffect, useRef } from 'react';
import type { ItemType } from './types';

/** 用 Canvas 2D 绘制物品缩略图（零 WebGL 开销） */
function drawThumbnail(ctx: CanvasRenderingContext2D, type: ItemType, size: number) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.42;

  // 清空
  ctx.clearRect(0, 0, s, s);

  // ── 根据物品类型绘制 ──
  switch (type) {
    // ── 工控机 ──
    case 'industrial-pc':
      rect(ctx, cx - r * 0.7, cy - r * 0.5, r * 1.4, r * 0.7, '#c8d0d8', 4);
      rect(ctx, cx - r * 0.5, cy - r * 0.3, r * 1.0, r * 0.3, '#2a2e32', 2);
      // 散热孔
      for (let i = 0; i < 4; i++) {
        rect(ctx, cx - r * 0.5 + i * (r * 0.22 + 2), cy + r * 0.1, r * 0.18, r * 0.06, '#666', 1);
      }
      // LED
      dot(ctx, cx - r * 0.5, cy - r * 0.15, 2, '#00ff88');
      break;

    // ── 笔记本电脑 ──
    case 'laptop':
      // 底座
      rect(ctx, cx - r * 0.8, cy + r * 0.15, r * 1.6, r * 0.15, '#555', 3);
      // 屏幕（倾斜投影）
      ctx.save();
      ctx.translate(cx, cy - r * 0.1);
      ctx.rotate(-0.05);
      rect(ctx, -r * 0.75, -r * 0.65, r * 1.5, r * 0.8, '#333', 4);
      rect(ctx, -r * 0.6, -r * 0.5, r * 1.2, r * 0.55, '#1a2a3a', 2);
      ctx.restore();
      break;

    // ── PDA ──
    case 'pda':
      // 橙色机身
      rect(ctx, cx - r * 0.65, cy - r * 0.35, r * 1.3, r * 0.7, '#ff6600', 6);
      // 白色前面板
      rect(ctx, cx - r * 0.5, cy - r * 0.25, r * 1.0, r * 0.5, '#f5f5f5', 4);
      // 屏幕
      rect(ctx, cx - r * 0.35, cy - r * 0.18, r * 0.6, r * 0.36, '#0a1520', 3);
      // 右侧扫描头凸起
      rect(ctx, cx + r * 0.45, cy - r * 0.13, r * 0.15, r * 0.26, '#222', 2);
      // 扫描头红点
      dot(ctx, cx + r * 0.52, cy, 2, '#ff2222');
      break;

    // ── 工业相机 ──
    case 'industrial-camera':
      rect(ctx, cx - r * 0.4, cy - r * 0.4, r * 0.8, r * 0.8, '#c0c8d0', 4);
      rect(ctx, cx - r * 0.25, cy - r * 0.25, r * 0.5, r * 0.5, '#222', 3);
      dot(ctx, cx, cy, r * 0.12, '#444');
      dot(ctx, cx, cy, 2, '#00ff00');
      break;


    // ── 球型监控 ──
    case 'dome-camera':
      // 底座（纯平圆盘）
      rect(ctx, cx - r * 0.4, cy - r * 0.6, r * 0.8, r * 0.12, '#ddd', 3);
      // 半球罩
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 0.05, r * 0.38, r * 0.45, 0, 0, Math.PI);
      ctx.fillStyle = 'rgba(100,140,180,0.35)';
      ctx.fill();
      ctx.strokeStyle = '#8899aa';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 云台摄像头
      rect(ctx, cx - r * 0.08, cy - r * 0.25, r * 0.16, r * 0.18, '#333', 3);
      dot(ctx, cx, cy - r * 0.16, 3, '#4488cc');
      break;

    // ── 防水监控 ──
    case 'bullet-camera':
      // 白色机身（侧视）
      rect(ctx, cx - r * 0.6, cy - r * 0.3, r * 1.2, r * 0.6, '#c0c6cc', 4);
      // 前端镜头
      dot(ctx, cx + r * 0.55, cy + r * 0.02, 5, '#222');
      // 前罩（梯形向后延长盖住机身）
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.6, cy + r * 0.3);  // 后端底部
      ctx.lineTo(cx - r * 0.6, cy - r * 0.3);  // 后端顶部
      ctx.lineTo(cx + r * 0.6, cy - r * 0.3);  // 前端顶部
      ctx.lineTo(cx + r * 0.9, cy - r * 0.3);  // 最前端
      ctx.lineTo(cx + r * 0.75, cy + r * 0.3); // 斜边与底部交点
      ctx.closePath();
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;

    // ── 电源控制器 ──
    case 'power-controller':
      rect(ctx, cx - r * 0.6, cy - r * 0.35, r * 1.2, r * 0.7, '#d0d8e0', 4);
      rect(ctx, cx - r * 0.45, cy - r * 0.2, r * 0.9, r * 0.4, '#2a2e32', 2);
      dot(ctx, cx - r * 0.35, cy - r * 0.05, 2, '#00ff00');
      break;

    // ── 光源控制器 ──
    case 'light-controller':
      rect(ctx, cx - r * 0.55, cy - r * 0.4, r * 1.1, r * 0.8, '#333', 4);
      rect(ctx, cx - r * 0.4, cy - r * 0.25, r * 0.8, r * 0.5, '#c8d0d8', 2);
      // 4 通道指示灯
      for (let i = 0; i < 4; i++) {
        dot(ctx, cx - r * 0.25 + i * r * 0.15, cy - r * 0.1, 2, i < 2 ? '#ffff00' : '#444');
      }
      break;

    // ── 插线板 ──
    case 'power-strip':
      rect(ctx, cx - r * 0.7, cy - r * 0.3, r * 1.4, r * 0.6, '#e8e8e8', 5);
      // 插孔
      for (let i = 0; i < 5; i++) {
        rect(ctx, cx - r * 0.5 + i * r * 0.22, cy - r * 0.05, r * 0.12, r * 0.12, '#bbb', 2);
      }
      // 开关
      dot(ctx, cx + r * 0.55, cy, 3, '#444');
      break;

    // ── 打印机 ──
    case 'printer':
      rect(ctx, cx - r * 0.65, cy - r * 0.45, r * 1.3, r * 0.9, '#e8e8e8', 4);
      rect(ctx, cx - r * 0.55, cy - r * 0.3, r * 1.1, r * 0.15, '#f5f5f5', 2);
      // 出纸口
      rect(ctx, cx - r * 0.4, cy + r * 0.05, r * 0.8, r * 0.06, '#333', 2);
      // 按键
      dot(ctx, cx + r * 0.35, cy - r * 0.2, 2, '#666');
      dot(ctx, cx + r * 0.4, cy - r * 0.2, 2, '#666');
      break;

    // ── 产品箱子 ──
    case 'product-box':
      rect(ctx, cx - r * 0.6, cy - r * 0.45, r * 1.2, r * 0.9, '#a07030', 4);
      rect(ctx, cx - r * 0.3, cy - r * 0.1, r * 0.6, r * 0.3, '#d4a85c', 2);
      // 十字胶带
      ctx.strokeStyle = '#d4a85c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.4);
      ctx.lineTo(cx, cy + r * 0.4);
      ctx.moveTo(cx - r * 0.5, cy);
      ctx.lineTo(cx + r * 0.5, cy);
      ctx.stroke();
      break;

    // ── 条光 ──
    case 'bar-light':
      rect(ctx, cx - r * 0.8, cy - r * 0.15, r * 1.6, r * 0.3, '#c0c8d0', 5);
      rect(ctx, cx - r * 0.7, cy - r * 0.05, r * 1.4, r * 0.1, '#ffeecc', 2);
      dot(ctx, cx - r * 0.75, cy, 1.5, '#888');
      dot(ctx, cx + r * 0.75, cy, 1.5, '#888');
      break;

    // ── 面光 ──
    case 'area-light':
      rect(ctx, cx - r * 0.65, cy - r * 0.5, r * 1.3, r * 1.0, '#b0b8c0', 4);
      rect(ctx, cx - r * 0.55, cy - r * 0.4, r * 1.1, r * 0.8, '#eeeedd', 3);
      break;

    // ── 环光 ──
    case 'ring-light':
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#c0c8d0';
      ctx.fill();
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffeecc';
      ctx.lineWidth = 4;
      ctx.stroke();
      break;

  }
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, r = 0) {
  ctx.fillStyle = color;
  if (r) {
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
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// ── 缓存 ──
const cache = new Map<string, string>();

function getDataURL(type: ItemType): string {
  const cached = cache.get(type);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  drawThumbnail(ctx, type, 64);

  const url = canvas.toDataURL('image/png');
  cache.set(type, url);
  return url;
}

/** 单件物品的 2D 缩略图 */
const ItemThumbnail: React.FC<{ type: ItemType; size?: number }> = ({ type, size = 60 }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) {
      const canvas = ref.current;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      drawThumbnail(ctx, type, size);
    }
  }, [type, size]);

  // 也可以输出为 <img>（利用缓存）
  const url = cache.get(type);

  if (url) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 4,
          overflow: 'hidden',
          background: 'var(--semi-color-fill-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img src={url} alt={type} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    );
  }

  // 首次渲染：用 Canvas 实时绘制
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        overflow: 'hidden',
        background: 'var(--semi-color-fill-1)',
      }}
    >
      <canvas ref={ref} width={size} height={size} style={{ width: size, height: size }} />
    </div>
  );
};

export default ItemThumbnail;

// 预生成所有 data URL（首帧后空闲时执行）
export function preloadThumbnails() {
  requestIdleCallback(() => {
    const types: ItemType[] = [
      'industrial-pc', 'laptop', 'pda',
      'industrial-camera', 'dome-camera', 'bullet-camera',
      'bar-light', 'area-light', 'ring-light',
      'power-controller', 'light-controller', 'power-strip',
      'printer',
      'product-box',
    ];
    for (const type of types) {
      getDataURL(type);
    }
  });
}
