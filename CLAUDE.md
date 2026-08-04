# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

VisionAI 3D Workbench — 基于 Semi Design + React Three Fiber 的工业铝型材机架 3D 场景编辑器。支持多层隔板/台面/顶底板结构设计、铝型材骨架（带 T 型槽截面）、物品放置与变形、以及独立 HTML 导出。

## 技术栈

- **构建**: Vite 8 + TypeScript 6
- **前端框架**: React 19
- **3D 引擎**: @react-three/fiber + @react-three/drei + Three.js
- **UI 组件库**: @douyinfe/semi-ui + semi-icons
- **拖拽**: @dnd-kit

## 常用命令

```bash
npm run dev       # 启动开发服务器 (默认 :5173)
npm run build     # TypeScript 检查 + Vite 生产构建
npm run preview   # 预览构建产出的 dist/
```

**无自动化测试框架**（无 vitest/jest 等，`npm run build` 的 `tsc` 是唯一静态检查）。测试靠手动 + 根目录两份测试文档：`ROBUSTNESS_TEST_REPORT.md`（60+ 项健壮性用例）和 `WORKBENCH_SCENARIO_TEST.md`（真实设计场景流程）。修改涉及骨架/层/导出逻辑时，对照这两份文档手动回归。

## 代码架构

### 数据流（集中在 App.tsx）

所有状态集中在 `App.tsx` 中，通过 props 向下传递给子组件。层次结构：

```
App (状态管理)
├── SceneView.tsx          ← 3D 场景渲染（React Three Fiber Canvas）
│   ├── CameraController.tsx   ← 视角动画
│   ├── MiniCube.tsx           ← 浮动工具栏（视角、背景、标识开关）
│   └── items/*                ← 3D 物品组件（在场景中实例化）
├── LeftPanel.tsx          ← 左侧面板（整体尺寸、骨架编辑、层管理、型材型号）
├── LayerEditor.tsx        ← 右侧面板（选中层的详细参数）
└── BottomBarTable.tsx     ← 底栏（层参数表格，支持拖拽排序）
```

### 核心数据类型

- **Layer**: 层（`top`/`countertop`/`shelf`/`bottom`），包含尺寸、标高、厚度、布局网格、加强筋、连接方式等
- **PlacedItem**: 放置在层网格上的物品（坐标、类型、旋转变换）
- **ItemType**: 14 种 3D 物品（工控机、相机、光源、控制器等），分 6 类
- 机架整体由 `dimensions`（长宽高）、`profile`（型材标准+规格）、`columns`（各面骨架数量）定义
- **⚠️ `Layer`/`LayerDetail`/`PlacedItem` 类型定义在 `LeftPanel.tsx` 中**（无独立 types 文件），`exportHtml.ts` 也从 `../components/LeftPanel` 导入它们
- **`columns` 除 6 方向数量外还有 `bottomFrame`（底框模式 `full/frontback/leftright/none`）和 `frontCap/backCap/leftCap/rightCap`**（各面额外立柱的截止层 ID，空字符串=全高）

### 物品系统 (`src/components/items/`)

- `types.ts` — `ItemRegistry` 定义所有物品元数据（名称、尺寸、分类），以及 `ITEM_MAP` / `ITEMS_BY_CATEGORY` / `CATEGORY_NAMES` 等注册表
- `index.ts` — `ITEM_COMPONENTS` 将 `ItemType` 映射到 React 3D 组件
- 各 .tsx 文件分别实现不同类别的 3D 模型（Computer / Camera / Lighting / Controller / Electronics）
- 所有模型以 `<group>` 包裹，中心在原点，单位 1=1米
- `ItemThumbnail.tsx` — 用 Three.js Canvas 生成缩略图预览

### 导出系统 (`src/utils/exportHtml.ts`)

`generateExportHtml()` 将当前场景序列化为一个自包含的 HTML 文件，内嵌 Three.js CDN、场景重建逻辑和简化物品几何体。CAD 数据通过 `DATA` JSON 注入页面。

**⚠️ 导出 HTML 是纯 vanilla Three.js r128（CDN 脚本加载，无 React/R3F）**。导出端必须用命令式代码完整复刻 `SceneView.tsx` 中的所有几何逻辑（角柱截断、顶/底横梁、层板加强筋、边框型材、尺寸标注、物品几何）。这两处极易漂移——历史上 EXPORT-1~5 数据不一致 bug 均源于改 3D 场景时未同步导出端。**改任一处的几何渲染，必须同步另一处。**

### 通信机制

组件间通过 `window.dispatchEvent(new CustomEvent(...))` 实现松散耦合通信：
- `focus-camera` — 聚焦到指定层
- `set-bg` / `set-camera-target` / `reset-camera` — 背景/视角控制
- `set-show-dims` / `set-show-shelf-ids` — 标识可见性切换
- 模块级变量 `_showDims` / `_showIds` 配合监听器数组实现跨组件可见性同步

### 3D 场景要点

- 铝型材截面通过 `THREE.Shape` 描述 T 型槽轮廓，经 `ExtrudeGeometry` 拉伸成型
- 层板采用 `boxGeometry` + 半透明材质，选中时高亮（非选中层透明度降至 0.15）
- 物品选中后显示 3D 浮窗工具栏（缩放/旋转/翻转/删除操作）
- 环境贴图通过 `PMREMGenerator` 实时生成渐变球体场景，无需外部 HDR

## 开发注意事项

- 所有尺寸单位：代码中以米为单位（除 UI 输入显示 mm），`exportHtml.ts` 直接在 JS 中计算
- 物品 `size` 轴顺序：`[长(X), 宽(Z), 高(Y)]`，单位米（见 `types.ts` 顶部注释）
- **`sortedLayers`（标高降序）是贯穿全应用的规范顺序**：`App.tsx` 中 `useMemo` 生成，层参数、底栏表格、3D 场景、导出全部基于它，不要直接传原始 `layers`
- `main.tsx` 使用 `React.StrictMode`（开发期组件双重挂载），配合模块级可变状态（`_cappedElev`/`_lastHeight`/`_showDims`/`_showIds`）实现跨渲染持久化——这些是**有意的模式**，新增跨组件可见性状态时沿用
- 新物品需在 `types.ts` 的 `ITEM_REGISTRY` 注册、在 `index.ts` 的 `ITEM_COMPONENTS` 映射组件、在 `exportHtml.ts` 的 `createItemMesh` 中添加几何体生成逻辑（三处缺一不可）
- 层拖拽排序只允许 `countertop` 和 `shelf` 类型，通过交换标高值实现
- 顶板拆除或添加时自动调整台面标高
