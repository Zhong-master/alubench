import { ITEM_REGISTRY } from '../components/items';
import type { AppState } from '../state';
import { buildSceneGeometry } from '../geometry';
import { getItemPrimitives } from '../geometry/itemModel';
// 离线内嵌 three r128 构建（?raw 打包进 bundle），导出 HTML 断网/内网亦可打开
import threeRaw from '../export/vendor/three-r128.min.js?raw';
import orbitRaw from '../export/vendor/OrbitControls-r128.js?raw';

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

export function generateExportHtml(state: AppState): string {
  const itemData = ITEM_REGISTRY.map((item) => ({
    type: item.type,
    name: item.name,
    size: item.size,
    color: ITEM_COLORS[item.type] || '#888',
    category: item.category,
    // 物品模型图元（共享几何描述，导出端遍历渲染，与 3D 端视觉一致）
    primitives: getItemPrimitives(item.type),
  }));

  // 几何全部由共享内核计算，导出端只做渲染（根治与 3D 场景的漂移）
  const geo = buildSceneGeometry(state);
  const shelfNumberFor = (layerId: string) => {
    const shelves = state.layers.filter((l) => l.type === 'shelf');
    const idx = shelves.findIndex((l) => l.id === layerId);
    return idx >= 0 ? idx + 1 : 0;
  };

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
    // ── 共享内核几何数据 ──
    frameBeams: geo.frameBeams,
    layerGeom: geo.layers.map((lg) => ({
      layerId: lg.layerId,
      board: lg.board,
      beams: lg.beams,
      placements: lg.placements,
      gridCols: lg.gridCols,
      gridRows: lg.gridRows,
      shelfNumber: shelfNumberFor(lg.layerId),
    })),
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
#label-btn {
  position: fixed; right: 20px; top: 76px;
  width: 48px; height: 48px; border-radius: 8px;
  background: rgba(255,255,255,0.12); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.18);
  cursor: pointer; z-index: 10; transition: background 0.15s;
  color: #ccc; font: 600 14px/48px sans-serif; text-align: center;
}
#label-btn:hover { background: rgba(255,255,255,0.22); }
#label-menu {
  position: fixed; right: 20px; top: 132px;
  background: rgba(40,40,40,0.92); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.18); border-radius: 8px;
  padding: 10px 12px; z-index: 10; display: none;
  color: #ccc; font: 12px/1.6 sans-serif;
}
#label-menu label { display: flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; }
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
<button id="label-btn">标</button>
<div id="label-menu">
  <label><input type="checkbox" id="chk-dims" checked> 尺寸标识</label>
  <label><input type="checkbox" id="chk-ids" checked> 层ID标识</label>
</div>
<div id="info">鼠标拖拽旋转 · 滚轮缩放 · 右键平移</div>

<script>${threeRaw}</script>
<script>${orbitRaw}</script>
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

// ─── 物品形状生成（遍历共享图元描述，与 3D 端视觉一致） ───
function buildPrimitiveMesh(p) {
  const mat = new THREE.MeshStandardMaterial({
    color: parseInt(p.color.replace('#', ''), 16),
    roughness: p.roughness !== undefined ? p.roughness : 0.5,
    metalness: p.metalness !== undefined ? p.metalness : 0.1,
    transparent: p.transparent,
    opacity: p.opacity,
    emissive: p.emissive ? new THREE.Color(p.emissive) : undefined,
    emissiveIntensity: p.emissiveIntensity,
    side: p.side === 'double' ? THREE.DoubleSide : p.side === 'back' ? THREE.BackSide : THREE.FrontSide,
  });
  switch (p.kind) {
    case 'box': return new THREE.Mesh(new THREE.BoxGeometry(...p.args), mat);
    case 'roundedBox': return new THREE.Mesh(roundedBoxGeo(...p.args, p.radius || 0.004), mat);
    case 'cylinder': return new THREE.Mesh(new THREE.CylinderGeometry(...p.args), mat);
    case 'sphere': return new THREE.Mesh(new THREE.SphereGeometry(...p.args), mat);
    case 'torus': return new THREE.Mesh(new THREE.TorusGeometry(...p.args), mat);
    case 'plane': return new THREE.Mesh(new THREE.PlaneGeometry(...p.args), mat);
    case 'circle': return new THREE.Mesh(new THREE.CircleGeometry(...p.args), mat);
    default: return null;
  }
}

function createItemMesh(type, s) {
  const g = new THREE.Group();
  const info = DATA.items.find(function(i) { return i.type === type; });
  if (!info || !info.primitives) return g;
  info.primitives.forEach(function(p) {
    const m = buildPrimitiveMesh(p);
    if (!m) return;
    m.scale.setScalar(s);
    m.position.set(p.pos ? p.pos[0] : 0, p.pos ? p.pos[1] : 0, p.pos ? p.pos[2] : 0);
    if (p.rot) m.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
    g.add(m);
  });
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

const profileMM = parseInt((DATA.profile[1] || '4040').substring(0, 2)) || 40;
PROFILE_SHAPE = makeProfileShape(profileMM / 1000, DATA.profile);

// ─── 框架（共享内核生成） ───
DATA.frameBeams.forEach(function(b) {
  scene.add(beam(b.pos[0], b.pos[1], b.pos[2], b.size[0], b.size[1], b.size[2]));
});

// ─── 标识分组（尺寸标注 / 层 ID 标签，经「标」按钮切换显隐） ───
const dimGroup = new THREE.Group();
const idGroup = new THREE.Group();
scene.add(dimGroup);
scene.add(idGroup);

// ─── 层板（共享内核生成） ───
DATA.layerGeom.forEach(function(lg) {
  const board = lg.board;
  const col = parseInt(board.color.replace('#', ''), 16);

  // 层板本体
  const m = box(board.size[0], board.size[1], board.size[2], isNaN(col) ? 0x888888 : col);
  m.position.set(board.pos[0], board.pos[1], board.pos[2]);
  scene.add(m);

  // 该层边框/连接/加强筋型材
  lg.beams.forEach(function(b) {
    scene.add(beam(b.pos[0], b.pos[1], b.pos[2], b.size[0], b.size[1], b.size[2]));
  });

  // 布局网格
  if (lg.gridCols > 0) {
    const cw = board.size[0] / lg.gridCols;
    const ch = board.size[2] / lg.gridRows;
    const zOff = board.pos[2] - board.size[2] / 2;
    const topY = board.pos[1] + board.size[1] / 2 + 0.0005;
    const gridMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
    const borderMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthTest: true });
    for (let c = 0; c < lg.gridCols; c++) {
      for (let r = 0; r < lg.gridRows; r++) {
        const cx2 = c * cw + cw / 2;
        const cz2 = zOff + r * ch + ch / 2;
        const gm = new THREE.Mesh(new THREE.PlaneGeometry(cw * 0.94, ch * 0.94), gridMat);
        gm.rotation.x = -Math.PI / 2;
        gm.position.set(cx2, topY, cz2);
        scene.add(gm);
        const pts = [
          new THREE.Vector3(cx2 - cw / 2, topY, cz2 - ch / 2),
          new THREE.Vector3(cx2 + cw / 2, topY, cz2 - ch / 2),
          new THREE.Vector3(cx2 + cw / 2, topY, cz2 + ch / 2),
          new THREE.Vector3(cx2 - cw / 2, topY, cz2 + ch / 2),
          new THREE.Vector3(cx2 - cw / 2, topY, cz2 - ch / 2),
        ];
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), borderMat));
      }
    }
  }

  // 已放置物品 + 标签（占位由共享内核计算，模型由共享图元描述渲染）
  lg.placements.forEach(function(p) {
    const info = DATA.items.find(function(i) { return i.type === p.itemType; });
    if (!info) return;
    // 物品图元为自然尺寸，整体按放置缩放（含用户缩放）放大
    const itemGroup = createItemMesh(p.itemType, p.scale);
    itemGroup.position.set(p.x, p.y, p.z);
    itemGroup.rotation.y = p.rotation * Math.PI / 180;
    itemGroup.scale.set(p.flipX ? -1 : 1, 1, p.flipY ? -1 : 1);
    scene.add(itemGroup);
    const label = makeLabel(info.name);
    label.position.set(p.x, p.y + p.worldSize[2] / 2 + 0.04, p.z);
    scene.add(label);
  });

  // 层 ID 标签（与 3D 场景一致，可经「标」按钮切换）
  if (lg.shelfNumber > 0) {
    const idLabel = makeLabel('#' + lg.shelfNumber);
    idLabel.position.set(board.size[0] + 0.08, board.pos[1], board.pos[2]);
    idGroup.add(idLabel);
  }
});

// ─── 尺寸标注（可经「标」按钮切换） ───
const g = 0.1;
const dimLineMat = new THREE.LineBasicMaterial({ color: 0x999999 });
function makeDimLine(pts) {
  const bg = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  dimGroup.add(new THREE.Line(bg, dimLineMat));
}
// 长 标注（沿 Z 方向外扩）
makeDimLine([[0, 0, D], [0, 0, D + g]]);
makeDimLine([[W, 0, D], [W, 0, D + g]]);
makeDimLine([[0, 0, D + g], [W, 0, D + g]]);
// 长文字
const lenLabel = makeLabel(DATA.dimensions.width + 'mm');
lenLabel.position.set(W / 2, -0.02, D + g + 0.08);
lenLabel.scale.set(0.28, 0.07, 1);
dimGroup.add(lenLabel);

// 宽 标注（沿 X 负方向外扩）
makeDimLine([[0, 0, 0], [-g, 0, 0]]);
makeDimLine([[0, 0, D], [-g, 0, D]]);
makeDimLine([[-g, 0, 0], [-g, 0, D]]);
const depLabel = makeLabel(DATA.dimensions.depth + 'mm');
depLabel.position.set(-g - 0.08, -0.02, D / 2);
depLabel.scale.set(0.28, 0.07, 1);
dimGroup.add(depLabel);

// 高 标注（沿 X 负方向）
makeDimLine([[0, 0, 0], [-g, 0, 0]]);
makeDimLine([[0, H, 0], [-g, H, 0]]);
makeDimLine([[-g, 0, 0], [-g, H, 0]]);
const heiLabel = makeLabel(DATA.dimensions.height + 'mm');
heiLabel.position.set(-g - 0.08, H / 2, 0);
heiLabel.scale.set(0.28, 0.07, 1);
dimGroup.add(heiLabel);

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

// ─── 「标」显示控制（尺寸 / 层ID，与编辑器行为对齐） ───
document.getElementById('label-btn').addEventListener('click', () => {
  const menu = document.getElementById('label-menu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('chk-dims').addEventListener('change', (e) => { dimGroup.visible = e.target.checked; });
document.getElementById('chk-ids').addEventListener('change', (e) => { idGroup.visible = e.target.checked; });

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
