import type { Layer } from '../components/LeftPanel';
import { ITEM_REGISTRY } from '../components/items';

interface ExportState {
  dimensions: { width: number; depth: number; height: number };
  profile: string[];
  columns: { front: number; back: number; left: number; right: number; top: number; bottom: number; bottomFrame: string };
  layers: Layer[];
}

const ITEM_COLORS: Record<string, string> = {
  'industrial-pc': '#c8d0d8',
  laptop: '#666',
  pda: '#ff6600',
  'industrial-camera': '#c0c8d0',
  'dome-camera': '#e8eef0',
  'bullet-camera': '#c0c6cc',
  'bar-light': '#c0c8d0',
  'area-light': '#b0b8c0',
  'ring-light': '#c0c8d0',
  'power-controller': '#c8d0d8',
  'light-controller': '#2a2e32',
  'power-strip': '#e8e8e8',
  printer: '#e8e8e8',
  'product-box': '#a07030',
};

export function generateExportHtml(state: ExportState): string {
  const itemData = ITEM_REGISTRY.map((item) => ({
    type: item.type,
    name: item.name,
    size: item.size,
    color: ITEM_COLORS[item.type] || '#888',
    category: item.category,
  }));

  const data = {
    dimensions: state.dimensions,
    profile: state.profile,
    columns: state.columns,
    layers: state.layers.map((l) => ({
      id: l.id,
      type: l.type,
      color: l.color,
      detail: {
        length: l.detail.length,
        width: l.detail.width,
        elevation: l.detail.elevation,
        thickness: l.detail.thickness,
        layout: l.detail.layout,
        frontConnect: l.detail.frontConnect,
        halign: l.detail.halign || 'left',
        profileType: l.detail.profileType || '',
        ribCount: l.detail.ribCount || 0,
        ribDirection: l.detail.ribDirection || 'x',
        topColumns: l.detail.topColumns || { fl: true, fr: true, bl: true, br: true },
        placedItems: l.detail.placedItems.map((p) => ({
          col: p.col,
          row: p.row,
          itemType: p.itemType,
          rotation: p.rotation || 0,
          scale: p.scale || 1,
          flipX: p.flipX || false,
          flipY: p.flipY || false,
        })),
      },
    })),
    items: itemData,
  };

  const json = JSON.stringify(data);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>3D Workbench - 导出视图</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #canvas { width: 100%; height: 100%; overflow: hidden; background: #2d2d2d; }
#cube-btn {
  position: fixed; right: 20px; top: 20px;
  width: 48px; height: 48px; border-radius: 8px;
  background: rgba(255,255,255,0.12); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.18);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  z-index: 10; transition: background 0.15s;
}
#cube-btn:hover { background: rgba(255,255,255,0.22); }
#cube-btn canvas { width: 36px; height: 36px; pointer-events: none; }
#info {
  position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%);
  color: rgba(255,255,255,0.4); font: 13px/1.4 sans-serif;
  text-align: center; pointer-events: none; z-index: 10;
  background: rgba(0,0,0,0.3); padding: 6px 16px; border-radius: 20px;
}
</style>
</head>
<body>
<div id="canvas"></div>
<button id="cube-btn"><canvas id="cube-canvas" width="72" height="72"></canvas></button>
<div id="info">鼠标拖拽旋转 · 滚轮缩放 · 右键平移</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script>
// ─── 场景数据 ───
const DATA = ${json};

// ─── 场景初始化 ───
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2d2d2d);
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.01, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.getElementById('canvas').appendChild(renderer.domElement);

const W = DATA.dimensions.width / 1000;
const H = DATA.dimensions.height / 1000;
const D = DATA.dimensions.depth / 1000;
const cx = W / 2, cy = H / 2, cz = D / 2;
const maxDim = Math.max(W, H, D);
const dist = maxDim * 2.5;
camera.position.set(cx - dist * 0.65, cy + dist * 0.7, cz + dist * 0.8);
camera.lookAt(cx, cy, cz);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(cx, cy, cz);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.minDistance = 0.3;
controls.maxDistance = maxDim * 5;
controls.update();

// ─── 灯光 ───
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dl = new THREE.DirectionalLight(0xffffff, 1);
dl.position.set(5, 10, 5);
scene.add(dl);
const dl2 = new THREE.DirectionalLight(0xffffff, 0.3);
dl2.position.set(-5, -5, -5);
scene.add(dl2);
const pl = new THREE.PointLight(0xffffff, 0.5);
pl.position.set(0, 5, 0);
scene.add(pl);

// ─── 环境贴图（赋予材质真实反射光泽） ───
(function() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const gradientColors = [
    [0.9, 0.9, 0.95], [0.7, 0.7, 0.75], [0.5, 0.5, 0.55],
  ];
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(2, 8, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(gradientColors[i][0], gradientColors[i][1], gradientColors[i][2]), side: THREE.BackSide })
    );
    mesh.position.y = i - 1;
    envScene.add(mesh);
  }
  scene.environment = pmrem.fromScene(envScene).texture;
  scene.environmentIntensity = 0.4;
  pmrem.dispose();
})();

// ─── 辅助：标准长方体 ───
function box(w, h, d, color, opacity) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.MeshStandardMaterial({
    color, roughness: 0.5, metalness: 0.1,
    transparent: opacity !== undefined && opacity < 1,
    opacity: opacity !== undefined ? opacity : 1,
  });
  return new THREE.Mesh(g, m);
}

// ─── 辅助：圆角长方体几何体 ───
function roundedBoxGeo(w, h, d, r) {
  const s = new THREE.Shape();
  const hw = w / 2 - r, hh = h / 2 - r;
  s.moveTo(-hw, -hh);
  s.lineTo(hw, -hh);
  s.quadraticCurveTo(hw + r, -hh, hw + r, -hh + r);
  s.lineTo(hw + r, hh - r);
  s.quadraticCurveTo(hw + r, hh, hw, hh);
  s.lineTo(-hw, hh);
  s.quadraticCurveTo(-hw - r, hh, -hw - r, hh - r);
  s.lineTo(-hw - r, -hh + r);
  s.quadraticCurveTo(-hw - r, -hh, -hw, -hh);
  const ex = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: r * 0.5, bevelSize: r * 0.3, bevelSegments: 4 });
  ex.translate(0, 0, -d / 2);
  return ex;
}

function roundedBox(w, h, d, color, radius, opacity) {
  const geo = roundedBoxGeo(w, h, d, radius || Math.min(w, h, d) * 0.04);
  const m = new THREE.MeshStandardMaterial({
    color, roughness: 0.5, metalness: 0.1,
    transparent: opacity !== undefined && opacity < 1,
    opacity: opacity !== undefined ? opacity : 1,
  });
  return new THREE.Mesh(geo, m);
}

// ─── 标签精灵 ───
function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 44px "Microsoft YaHei", "PingFang SC", sans-serif';
  const tw = ctx.measureText(text).width;
  const pad = 20;
  const bw = tw + pad * 2;
  const bh = 72;
  const bx = (512 - bw) / 2;
  const by = (128 - bh) / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  const r = 12;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
  ctx.lineTo(bx + r, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.28, 0.07, 1);
  return sprite;
}

// ─── 物品形状生成 ───
function mat(color, opts) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, ...opts });
}

function createItemMesh(type, w, h, d, color) {
  const c = parseInt(color.replace('#', ''), 16);
  const g = new THREE.Group();
  const M = mat;

  switch (type) {
    case 'ring-light': {
      const r = Math.max(w, d) * 0.45;
      const tube = Math.min(w, d, h) * 0.2;
      const torus = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 14, 28), M(c));
      torus.rotation.x = Math.PI / 2;
      g.add(torus);
      break;
    }
    case 'dome-camera': {
      const rd = Math.min(w, d) * 0.42;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(rd, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2),
        M(c, { transparent: true, opacity: 0.45 })
      );
      g.add(dome);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(rd * 1.05, rd * 1.15, h * 0.12, 28),
        M(0xc0c8d0, { metalness: 0.3 })
      );
      base.position.y = -h * 0.35;
      g.add(base);
      break;
    }
    case 'industrial-camera': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
      g.add(body);
      const lensR = d * 0.18;
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(lensR, lensR * 1.3, d * 0.7, 14),
        M(0x222222, { metalness: 0.4 })
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0, d * 0.6);
      g.add(lens);
      break;
    }
    case 'bullet-camera': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d * 0.65), M(c));
      g.add(body);
      const lensR = d * 0.1;
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(lensR, lensR * 1.2, d * 0.25, 14),
        M(0x222222, { metalness: 0.3 })
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0, d * 0.5);
      g.add(lens);
      break;
    }
    case 'laptop': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.25, d), M(c));
      base.position.y = -h * 0.2;
      g.add(base);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, h * 0.55, d * 0.04), M(0x222222));
      screen.position.set(0, h * 0.45, -d * 0.2);
      g.add(screen);
      break;
    }
    case 'pda': {
      const body = roundedBox(w, h, d, c, Math.min(w, h, d) * 0.06);
      g.add(body);
      const scr = new THREE.Mesh(new THREE.BoxGeometry(w * 0.65, h * 0.08, d * 0.02), M(0x0a1520, { metalness: 0.3 }));
      scr.position.set(0, 0, d * 0.51);
      g.add(scr);
      break;
    }
    case 'industrial-pc': {
      const body = roundedBox(w, h * 0.6, d, c, Math.min(w, h, d) * 0.015);
      g.add(body);
      // 散热鳍片
      for (let i = 0; i < 8; i++) {
        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.85, h * 0.06, d * 0.75),
          M(0xb0b8c0, { metalness: 0.5 })
        );
        fin.position.set(0, h * 0.4 + i * (h * 0.08), 0);
        g.add(fin);
      }
      break;
    }
    case 'printer': {
      const body = roundedBox(w, h, d, c, Math.min(w, h, d) * 0.02);
      g.add(body);
      // 出纸口
      const slot = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, h * 0.02, d * 0.02), M(0x333333));
      slot.position.set(0, h * 0.35, d * 0.51);
      g.add(slot);
      break;
    }
    case 'power-controller': {
      const body = roundedBox(w, h * 0.7, d, c, Math.min(w, h, d) * 0.015);
      g.add(body);
      for (let i = 0; i < 5; i++) {
        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.85, h * 0.05, d * 0.8),
          M(0xb0b8c0, { metalness: 0.5 })
        );
        fin.position.set(0, -h * 0.4 + i * (h * 0.12), 0);
        g.add(fin);
      }
      break;
    }
    case 'light-controller': {
      const body = roundedBox(w, h, d, c, Math.min(w, h, d) * 0.015);
      g.add(body);
      break;
    }
    case 'product-box': {
      const body = roundedBox(w, h, d, c, Math.min(w, h, d) * 0.01);
      g.add(body);
      // 胶带纹路
      const tape = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, h * 1.01, d * 0.02), M(0xc09040, { transparent: true, opacity: 0.3 }));
      tape.position.set(0, 0, d * 0.51);
      g.add(tape);
      break;
    }
    default: {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c)));
    }
  }

  return g;
}

// ─── T 型槽铝型材截面 ───
function makeProfileShape(t, profile) {
  const h = t / 2;
  const std = (profile[0] || 'GB').toUpperCase();
  const openRatio = std === 'GB' ? 0.22 : std === 'JIS' ? 0.2 : 0.18;
  const open = t * openRatio;
  const inner = t * (openRatio + 0.08);
  const gd = t * 0.12;
  const g = open / 2;
  const i = inner / 2;
  const s = new THREE.Shape();
  s.moveTo(-h, h);
  s.lineTo(-g, h);
  s.lineTo(-i, h - gd);
  s.lineTo(i, h - gd);
  s.lineTo(g, h);
  s.lineTo(h, h);
  s.lineTo(h, g);
  s.lineTo(h - gd, i);
  s.lineTo(h - gd, -i);
  s.lineTo(h, -g);
  s.lineTo(h, -h);
  s.lineTo(g, -h);
  s.lineTo(i, -h + gd);
  s.lineTo(-i, -h + gd);
  s.lineTo(-g, -h);
  s.lineTo(-h, -h);
  s.lineTo(-h, -g);
  s.lineTo(-h + gd, -i);
  s.lineTo(-h + gd, i);
  s.lineTo(-h, g);
  s.closePath();
  return s;
}

// ─── 型材梁（带 T 型槽截面拉伸） ───
var PROFILE_SHAPE = null;
function beam(x, y, z, lx, ly, lz) {
  const axis = lx > ly && lx > lz ? 'x' : ly > lx && ly > lz ? 'y' : 'z';
  const len = Math.max(lx, ly, lz);
  const g = new THREE.ExtrudeGeometry(PROFILE_SHAPE, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.5, metalness: 0.4 }));
  m.position.set(x, y, z);
  if (axis === 'x') m.rotation.y = Math.PI / 2;
  else if (axis === 'y') m.rotation.x = -Math.PI / 2;
  return m;
}

// ─── 框架 ───
const profileMM = parseInt((DATA.profile[1] || '4040').substring(0, 2)) || 40;
const t = profileMM / 1000;
PROFILE_SHAPE = makeProfileShape(t, DATA.profile);

// 查找顶板及其立杆连接设置
const topLayerData = DATA.layers.find(l => l.type === 'top');
const cols = topLayerData ? topLayerData.detail.topColumns : { fl: true, fr: true, bl: true, br: true };

// 顶板以下第一个延伸至立柱的层，用于截断未勾选的立杆
const topElev = topLayerData ? topLayerData.detail.elevation / 1000 : H;
const fullWidthLayers = DATA.layers
  .filter(l => l.type !== 'top' && (l.detail.elevation / 1000) < topElev - 0.001 && l.detail.frontConnect === 'extend')
  .sort((a, b) => b.detail.elevation - a.detail.elevation);
const capY = fullWidthLayers.length > 0
  ? fullWidthLayers[0].detail.elevation / 1000 - fullWidthLayers[0].detail.thickness / 2000
  : H;

// 各面额外立柱截止层（空字符串=全高），从 DATA.columns.*Cap 读取层 ID
function getFaceCap(side) {
  var key = side + 'Cap';
  var capId = DATA.columns[key];
  if (!capId) return H;
  var capLayer = DATA.layers.find(function(l) { return l.id === capId; });
  if (!capLayer) return H;
  return capLayer.detail.elevation / 1000;
}

// 四角立柱（支持立杆连接截断）
function addCornerPillar(x, cyPos, z, fullH) {
  var colH = fullH ? H : capY;
  var colCy = colH / 2;
  scene.add(beam(x, colCy, z, t, colH, t));
}
addCornerPillar(0, cy, D, cols.fl !== false);
addCornerPillar(W, cy, D, cols.fr !== false);
addCornerPillar(0, cy, 0, cols.bl !== false);
addCornerPillar(W, cy, 0, cols.br !== false);

// 底部横梁
const bf = DATA.columns.bottomFrame || 'full';
if (bf === 'full' || bf === 'frontback') {
  scene.add(beam(cx, t / 2, D, W - t, t, t));
  scene.add(beam(cx, t / 2, 0, W - t, t, t));
}
if (bf === 'full' || bf === 'leftright') {
  scene.add(beam(0, t / 2, cz, t, t, D - t));
  scene.add(beam(W, t / 2, cz, t, t, D - t));
}

// 额外立柱（四面）
function addExtraCols(count, len, xFixed, zFixed, side) {
  const arr = Array.from({ length: count }, (_, i) => (len / (count + 1)) * (i + 1));
  const capped = (xFixed === null && (zFixed === D && (cols.fl === false || cols.fr === false))) ||
                 (xFixed === null && (zFixed === 0 && (cols.bl === false || cols.br === false))) ||
                 (zFixed === null && (xFixed === 0 && (cols.fl === false || cols.bl === false))) ||
                 (zFixed === null && (xFixed === W && (cols.fr === false || cols.br === false)));
  const cornerCap = capped ? capY : H;
  const faceCap = getFaceCap(side);
  const pillarCap = Math.min(cornerCap, faceCap);
  const h = Math.max(pillarCap - t, 0.01);
  const y = t + h / 2;
  arr.forEach(p => {
    const x = xFixed !== null ? xFixed : p;
    const z = zFixed !== null ? zFixed : p;
    scene.add(beam(x, y, z, t, h, t));
  });
}
addExtraCols(DATA.columns.front, W, null, D, 'front');
addExtraCols(DATA.columns.back, W, null, 0, 'back');
addExtraCols(DATA.columns.left, D, 0, null, 'left');
addExtraCols(DATA.columns.right, D, W, null, 'right');

// 顶面/底面横向加强筋（沿 Z 方向）
function spaced(count, len) {
  return Array.from({ length: count }, (_, i) => (len / (count + 1)) * (i + 1));
}
spaced(DATA.columns.top, W).forEach(x => {
  scene.add(beam(x, H - t / 2, cz, t, t, D - t));
});
spaced(DATA.columns.bottom, W).forEach(x => {
  scene.add(beam(x, t / 2, cz, t, t, D - t));
});

// 无顶板时生成顶部边框横梁
const hasTop = DATA.layers.some(l => l.type === 'top');
if (!hasTop) {
  const tf = cols.fl !== false ? t / 2 : -t / 2;
  const tF = cols.fr !== false ? W - t / 2 : W + t / 2;
  const tb = cols.bl !== false ? t / 2 : -t / 2;
  const tB = cols.br !== false ? W - t / 2 : W + t / 2;
  scene.add(beam((tf + tF) / 2, H - t / 2, D, tF - tf, t, t));
  scene.add(beam((tb + tB) / 2, H - t / 2, 0, tB - tb, t, t));
  scene.add(beam(0, H - t / 2, cz, t, t, D - t));
  scene.add(beam(W, H - t / 2, cz, t, t, D - t));
}

	// ─── 层板 ───
	DATA.layers.forEach(layer => {
	  const lx = layer.detail.length / 1000;
	  const lz = layer.detail.width / 1000;
	  const ly = layer.detail.elevation / 1000;
	  const lt = layer.detail.thickness / 1000;
	  const col = parseInt(layer.color.replace('#', ''), 16);
	  const halign = layer.detail.halign || 'left';
	  const zOff = halign === 'left' ? 0 : halign === 'right' ? D - lz : (D - lz) / 2;

	  // 层板本体
	  const board = box(lx, lt, lz, isNaN(col) ? 0x888888 : col);
	  board.position.set(lx / 2, ly, zOff + lz / 2);
	  scene.add(board);

	  // 边框型材
	  if (layer.type === 'countertop' || layer.type === 'shelf' || layer.type === 'top') {
	    const fc = layer.detail.frontConnect || 'extend';
	    const isFull = lz >= D - 0.001;
	    const connect = isFull ? 'extend' : (fc === 'up' || fc === 'down' || fc === 'drop' || fc === 'none') ? 'none' : 'extend';
	    const lrZ = connect === 'extend' ? cz : zOff + (t + lz) / 2;
	    const lrLen = connect === 'extend' ? D - t : lz;
	    const pt = (() => {
	      const raw = layer.detail.profileType || DATA.profile[1] || '';
	      const parts = raw.split('-');
	      const numStr = parts[parts.length - 1]?.substring(0, 2) || '';
	      return (parseInt(numStr) || profileMM) / 1000;
	    })();
	    scene.add(beam(lx / 2, ly - lt / 2 - pt / 2, zOff + lz, lx - pt, pt, pt));
	    scene.add(beam(lx / 2, ly - lt / 2 - pt / 2, zOff, lx - pt, pt, pt));
	    scene.add(beam(0, ly - lt / 2 - pt / 2, lrZ, pt, pt, lrLen));
	    scene.add(beam(lx, ly - lt / 2 - pt / 2, lrZ, pt, pt, lrLen));
	  }

	  // 上连型材（原 drop）
	  if ((layer.type === 'countertop' || layer.type === 'shelf' || layer.type === 'top') && (layer.detail.frontConnect === 'up' || layer.detail.frontConnect === 'drop')) {
	    const above = DATA.layers.filter(l => {
	      const le = l.detail.elevation / 1000;
	      return le > ly + 0.001 && (l.type === 'countertop' || l.type === 'shelf' || l.type === 'top');
	    }).sort((a, b) => a.detail.elevation - b.detail.elevation)[0];
	    if (above) {
	      const aly = above.detail.elevation / 1000;
	      const alt = above.detail.thickness / 1000;
	      const abovePT = (() => {
	        const raw = above.detail.profileType || DATA.profile[1] || '';
	        const parts = raw.split('-');
	        const numStr = parts[parts.length - 1]?.substring(0, 2) || '';
	        return (parseInt(numStr) || profileMM) / 1000;
	      })();
	      const aboveLz = above.detail.width / 1000;
	      const aboveExtends = aboveLz >= D - 0.001 || above.detail.frontConnect === 'extend';
	      const dropTop = above.type === 'top' ? aly - alt / 2 : aly - alt / 2 - abovePT;
	      const dropBot = ly - lt / 2;
	      const dropH = Math.max(dropTop - dropBot, 0.001);
	      const pt = (() => {
	        const raw = layer.detail.profileType || DATA.profile[1] || '';
	        const parts = raw.split('-');
	        const numStr = parts[parts.length - 1]?.substring(0, 2) || '';
	        return (parseInt(numStr) || profileMM) / 1000;
	      })();
	      const frontZ = aboveExtends ? D : zOff + lz;
	      const backZ = aboveExtends ? 0 : zOff;
	      if (aboveExtends && zOff + lz < D - 0.001) {
	        scene.add(beam(0, dropBot + pt / 2, (zOff + lz + D) / 2, pt, pt, D - (zOff + lz)));
	        scene.add(beam(lx, dropBot + pt / 2, (zOff + lz + D) / 2, pt, pt, D - (zOff + lz)));
	      }
	      if (aboveExtends && zOff > 0.001) {
	        scene.add(beam(0, dropBot + pt / 2, zOff / 2, pt, pt, zOff));
	        scene.add(beam(lx, dropBot + pt / 2, zOff / 2, pt, pt, zOff));
	      }
	      scene.add(beam(0, dropBot + dropH / 2, frontZ, pt, dropH, pt));
	      scene.add(beam(lx, dropBot + dropH / 2, frontZ, pt, dropH, pt));
	      if (aboveExtends) {
	        scene.add(beam(0, dropBot + dropH / 2, backZ, pt, dropH, pt));
	        scene.add(beam(lx, dropBot + dropH / 2, backZ, pt, dropH, pt));
	      }
	    }
	  }

	  // 下连型材
	  if ((layer.type === 'countertop' || layer.type === 'shelf' || layer.type === 'top') && layer.detail.frontConnect === 'down') {
	    const below = DATA.layers.slice().reverse().filter(l => {
	      const le = l.detail.elevation / 1000;
	      return le < ly - 0.001 && (l.type === 'countertop' || l.type === 'shelf' || l.type === 'bottom');
	    }).sort((a, b) => b.detail.elevation - a.detail.elevation)[0];
	    if (below) {
	      const bly = below.detail.elevation / 1000;
	      const blt = below.detail.thickness / 1000;
	      const belowPT = (() => {
	        const raw = below.detail.profileType || DATA.profile[1] || '';
	        const parts = raw.split('-');
	        const numStr = parts[parts.length - 1]?.substring(0, 2) || '';
	        return (parseInt(numStr) || profileMM) / 1000;
	      })();
	      const belowLz = below.detail.width / 1000;
	      const belowExtends = belowLz >= D - 0.001 || below.detail.frontConnect === 'extend';
	      const dropBot = below.type === 'bottom' ? bly + blt / 2 : bly + blt / 2 + belowPT;
	      const dropTop = ly - lt / 2;
	      const dropH = Math.max(dropTop - dropBot, 0.001);
	      const pt = (() => {
	        const raw = layer.detail.profileType || DATA.profile[1] || '';
	        const parts = raw.split('-');
	        const numStr = parts[parts.length - 1]?.substring(0, 2) || '';
	        return (parseInt(numStr) || profileMM) / 1000;
	      })();
	      const frontZ = belowExtends ? D : zOff + lz;
	      const backZ = belowExtends ? 0 : zOff;
	      if (belowExtends && zOff + lz < D - 0.001) {
	        scene.add(beam(0, dropBot + dropH / 2 - pt / 2, (zOff + lz + D) / 2, pt, pt, D - (zOff + lz)));
	        scene.add(beam(lx, dropBot + dropH / 2 - pt / 2, (zOff + lz + D) / 2, pt, pt, D - (zOff + lz)));
	      }
	      if (belowExtends && zOff > 0.001) {
	        scene.add(beam(0, dropBot + dropH / 2 - pt / 2, zOff / 2, pt, pt, zOff));
	        scene.add(beam(lx, dropBot + dropH / 2 - pt / 2, zOff / 2, pt, pt, zOff));
	      }
	      scene.add(beam(0, dropBot + dropH / 2, frontZ, pt, dropH, pt));
	      scene.add(beam(lx, dropBot + dropH / 2, frontZ, pt, dropH, pt));
	      if (belowExtends) {
	        scene.add(beam(0, dropBot + dropH / 2, backZ, pt, dropH, pt));
	        scene.add(beam(lx, dropBot + dropH / 2, backZ, pt, dropH, pt));
	      }
	    }
	  }

	  // 加强筋
	  if (layer.type === 'countertop' || layer.type === 'shelf' || layer.type === 'top') {
	    const ribN = layer.detail.ribCount || 0;
	    const ribDir = layer.detail.ribDirection || 'x';
	    if (ribN > 0) {
	      const ribPT = (() => {
	        const raw = layer.detail.profileType || DATA.profile[1] || '';
	        const parts = raw.split('-');
	        const numStr = parts[parts.length - 1]?.substring(0, 2) || '';
	        return (parseInt(numStr) || profileMM) / 1000;
	      })();
	      for (let ri = 0; ri < ribN; ri++) {
	        if (ribDir === 'x') {
	          const zPos = zOff + (lz / (ribN + 1)) * (ri + 1);
	          scene.add(beam(lx / 2, ly - lt / 2 - ribPT / 2, zPos, lx - ribPT, ribPT, ribPT));
	        } else {
	          const xPos = (lx / (ribN + 1)) * (ri + 1);
	          scene.add(beam(xPos, ly - lt / 2 - ribPT / 2, zOff + lz / 2, ribPT, ribPT, lz - ribPT));
	        }
	      }
	    }
	  }

	  // 布局网格
	  if (layer.detail.layout) {
	    const [cols, rows] = layer.detail.layout.split('X').map(Number);
	    if (cols && rows) {
	      const cw = lx / cols;
	      const ch = lz / rows;
	      const topY = ly + lt / 2 + 0.0005;
	      const gridMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
	      const borderMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthTest: true });
	      for (let c = 0; c < cols; c++) {
	        for (let r = 0; r < rows; r++) {
	          const cx2 = c * cw + cw / 2;
	          const cz2 = zOff + r * ch + ch / 2;
	          const g = new THREE.PlaneGeometry(cw * 0.94, ch * 0.94);
	          const m = new THREE.Mesh(g, gridMat);
	          m.rotation.x = -Math.PI / 2;
	          m.position.set(cx2, topY, cz2);
	          scene.add(m);
	          // 网格边框
	          const pts = [
	            new THREE.Vector3(cx2 - cw / 2, topY, cz2 - ch / 2),
	            new THREE.Vector3(cx2 + cw / 2, topY, cz2 - ch / 2),
	            new THREE.Vector3(cx2 + cw / 2, topY, cz2 + ch / 2),
	            new THREE.Vector3(cx2 - cw / 2, topY, cz2 + ch / 2),
	            new THREE.Vector3(cx2 - cw / 2, topY, cz2 - ch / 2),
	          ];
	          const bg = new THREE.BufferGeometry().setFromPoints(pts);
	          scene.add(new THREE.Line(bg, borderMat));
	        }
	      }
	    }
	  }

	  // 已放置物品
	  if (layer.detail.layout && layer.detail.placedItems.length > 0) {
	    const [cols, rows] = layer.detail.layout.split('X').map(Number);
	    if (cols && rows) {
	      const cw = lx / cols;
	      const ch = lz / rows;
	      const topY = ly + lt / 2;

	      layer.detail.placedItems.forEach(pi => {
	        const info = DATA.items.find(i => i.type === pi.itemType);
	        if (!info) return;
	        const cellX = pi.col * cw + cw / 2;
	        const cellZ = zOff + pi.row * ch + ch / 2;
	        const baseS = Math.min((cw * 0.65) / info.size[0], (ch * 0.65) / info.size[1], 0.35);
	        const userS = pi.scale || 1;
	        const finalS = baseS * userS;
	        const iw = info.size[0] * finalS;
	        const ih = info.size[2] * finalS;
	        const id = info.size[1] * finalS;
	        const iy = topY + ih / 2 + 0.001;

	        const itemGroup = createItemMesh(pi.itemType, iw, ih, id, info.color);
	        const rot = (pi.rotation || 0) * Math.PI / 180;
	        itemGroup.position.set(cellX, iy, cellZ);
	        itemGroup.rotation.y = rot;
	        itemGroup.scale.set(pi.flipX ? -1 : 1, 1, pi.flipY ? -1 : 1);
	        scene.add(itemGroup);

	        // 标签
	        const label = makeLabel(info.name);
	        label.position.set(cellX, iy + ih / 2 + 0.04, cellZ);
	        scene.add(label);
	      });
	    }
	  }
	});
// ─── 尺寸标注 ───
const g = 0.1;
const dimLineMat = new THREE.LineBasicMaterial({ color: 0x999999 });
function makeDimLine(pts) {
  const bg = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  scene.add(new THREE.Line(bg, dimLineMat));
}
// 长 标注（沿 Z 方向外扩）
makeDimLine([[0, 0, D], [0, 0, D + g]]);
makeDimLine([[W, 0, D], [W, 0, D + g]]);
makeDimLine([[0, 0, D + g], [W, 0, D + g]]);
// 长文字
const lenLabel = makeLabel(DATA.dimensions.width + 'mm');
lenLabel.position.set(W / 2, -0.02, D + g + 0.08);
lenLabel.scale.set(0.28, 0.07, 1);
scene.add(lenLabel);

// 宽 标注（沿 X 负方向外扩）
makeDimLine([[0, 0, 0], [-g, 0, 0]]);
makeDimLine([[0, 0, D], [-g, 0, D]]);
makeDimLine([[-g, 0, 0], [-g, 0, D]]);
const depLabel = makeLabel(DATA.dimensions.depth + 'mm');
depLabel.position.set(-g - 0.08, -0.02, D / 2);
depLabel.scale.set(0.28, 0.07, 1);
scene.add(depLabel);

// 高 标注（沿 X 负方向）
makeDimLine([[0, 0, 0], [-g, 0, 0]]);
makeDimLine([[0, H, 0], [-g, H, 0]]);
makeDimLine([[-g, 0, 0], [-g, H, 0]]);
const heiLabel = makeLabel(DATA.dimensions.height + 'mm');
heiLabel.position.set(-g - 0.08, H / 2, 0);
heiLabel.scale.set(0.28, 0.07, 1);
scene.add(heiLabel);

// ─── 小轴 ───
scene.add(new THREE.AxesHelper(0.15));

// ─── MiniCube ───
const cubeCanvas = document.getElementById('cube-canvas');
const ctx = cubeCanvas.getContext('2d');
const S = 72;

function drawCube() {
  ctx.clearRect(0, 0, S, S);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const pts = [
    { label: 'X', color: '#ff6666', pos: [0.7, 0] },
    { label: 'Y', color: '#66ff66', pos: [0, 0.7] },
    { label: 'Z', color: '#6666ff', pos: [-0.7, 0] },
  ];
  ctx.save();
  ctx.translate(S / 2, S / 2);
  const s = S * 0.35;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-s, -s, s * 2, s * 2);
  ctx.strokeRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4);
  ctx.restore();
}

drawCube();

document.getElementById('cube-btn').addEventListener('click', () => {
  camera.position.set(cx - dist * 0.65, cy + dist * 0.7, cz + dist * 0.8);
  controls.target.set(cx, cy, cz);
  controls.update();
});

// ─── 窗口自适应 ───
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── 动画循环 ───
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
</script>
</body>
</html>`;
}
