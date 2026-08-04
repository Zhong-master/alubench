# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

VisionAI 3D Workbench — 基于 Semi Design + React Three Fiber 的工业铝型材机架 3D 场景编辑器。支持多层隔板/台面/顶底板结构设计、铝型材骨架（带 T 型槽截面）、物品放置与变形、以及独立 HTML 导出。

## 技术栈

- **构建**: Vite 8 + TypeScript 6
- **前端框架**: React 19
- **3D 引擎**: @react-three/fiber + @react-three/drei + Three.js
- **UI 组件库**: @douyinfe/semi-ui + semi-icons
- **拖拽**: 原生 HTML5 drag（底栏表格行）；`@dnd-kit/*` 是**未使用的死依赖**（package.json 中声明但 src 零引用，勿被误导）

## 常用命令

```bash
npm run dev       # 启动开发服务器 (默认 :5173)
npm run build     # TypeScript 检查 + Vite 生产构建
npm run preview   # 预览构建产出的 dist/
npm run lint      # ESLint (flat config: eslint.config.js)
npm run test      # vitest 单元测试（src/**/*.test.ts）
npm run check     # 质量门 = lint + tsc + vitest + build（提交/改动前必跑）
```

**自动化测试**：vitest 覆盖共享几何内核的核心逻辑（BOM 聚合、标高截断状态机、物品占位、干涉校验），见 `src/geometry/__tests__/`。测试数据用 `helpers.ts` 的 `makeLayer`/`makeFourLayerScene` 构造。`npm run check` 是唯一防线；另有两份手工回归文档：`ROBUSTNESS_TEST_REPORT.md`（60+ 项健壮性用例）和 `WORKBENCH_SCENARIO_TEST.md`（真实设计场景流程）。

**eslint 约定**：`react-hooks/immutability` / `refs` / `set-state-in-effect` 三条规则已显式关闭（见 `eslint.config.js` 注释）——它们与本库的 R3F 命令式场景操作、撤销栈 ref 模式、mount 期草稿恢复冲突，属有意为之。其余规则（类型安全、hook 顺序、未使用变量、依赖完整性）保持严格，新增代码不应出现 `any` 逃逸。

## 代码架构

### 数据流（集中在 App.tsx）

所有场景数据集中在 `App.tsx` 中，通过 props 向下传递给子组件。层次结构：

```
App (状态管理 + 撤销栈 + 持久化)
├── SceneView.tsx          ← 3D 场景渲染（React Three Fiber Canvas）
│   ├── CameraController.tsx   ← 视角动画
│   ├── MiniCube.tsx           ← 浮动工具栏（视角、背景、标识开关）
│   └── items/*                ← 3D 物品组件（在场景中实例化）
├── LeftPanel.tsx          ← 左侧面板（整体尺寸、骨架编辑、层管理、型材型号）
├── LayerEditor.tsx        ← 右侧面板（选中层的详细参数）
└── BottomBarTable.tsx     ← 底栏（层参数表格，支持拖拽排序）
```

### 场景状态、撤销与持久化 (`src/state.ts` + App.tsx)

- **`AppState`**（`src/state.ts`）：`{ dimensions, profile, columns, layers }` 的可序列化结构，是**工程文件 / localStorage 草稿 / 撤销栈三者共享的唯一数据形状**。`isAppState()` 用于防御性反序列化校验。
- **撤销/重做**：`App.tsx` 用 `historyRef`/`futureRef` 两个栈（各 60 步）+ `useEffect` 监听 `appState` 引用变化自动记录历史；`skipRecordRef` 标记跳过撤销/重做/加载/新建时的自我记录。`stateRef` 始终指向最新值供事件处理器读取。
- **持久化**：`localStorage` key `visionai-workbench-draft-v1`，500ms 防抖自动保存草稿，启动时恢复；顶栏按钮可下载/加载 `.json` 工程文件、新建（清草稿）。

**⚠️ 修改场景数据的入口都必须经过 `setAppState`**（或 `updateLayers` 包装），否则不会进入撤销栈。注意 `_lastHeight`/`_cappedElev`（模块级，`App.tsx` 顶部）在整体尺寸变更时处理标高截断/恢复，跨渲染持久。

### BOM 系统 (`src/utils/bom.ts`)

`computeBom(state)` 委托共享内核生成型材实例后聚合（`aggregateBom`），输出型材下料清单（规格×长度×数量）与板材清单。`bomToCsv()` 输出 UTF-8 BOM CSV，`bomToHtml()` 输出可打印的自包含 HTML 报告。几何算法在内核统一，无需再同步多端。

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

### 共享几何内核 (`src/geometry/`)

**场景几何算法只有一份实现**——`buildSceneGeometry(state)` 生成全部型材实例（`BeamInstance`，含渲染坐标与 BOM 长度）、板材（`BoardInstance`）与物品占位（`ItemPlacement`，含 0.85 填充系数的基准缩放）。SceneView / exportHtml / bom 三端全部消费内核数据，不再各自实现几何，根治历史 EXPORT-1~5 类漂移回归。

```
src/geometry/
├── types.ts        # BeamInstance / BoardInstance / ItemPlacement / FrameContext
├── context.ts      # getFrameContext（尺寸/规格/立杆截断上下文）、profileMMOf
├── frame.ts        # buildFrameBeams（角柱/横梁/立柱/顶底梁/无顶板顶框）
├── layer.ts        # buildLayerGeometry（层板/边框/连接/加强筋）、boardLabel、zOffsetOf
├── items.ts        # computePlacements（物品占位，尺寸真实性）
├── aggregate.ts    # aggregateBom / bomTotals（BOM 聚合）
├── dimension.ts    # applyDimensionChange（标高截断/恢复状态机，纯函数）
├── validate.ts     # validate（干涉/越界校验）
└── index.ts        # buildSceneGeometry 统一入口
```

**⚠️ 修改骨架/层/物品几何时必须改内核**（`SceneView.tsx` 只消费 `BeamInstance`/`BoardInstance` 渲染，`exportHtml.ts` 只消费 `DATA.frameBeams`/`DATA.layerGeom` 渲染，`bom.ts` 只聚合），三端渲染端不再包含几何计算。物品 3D 模型本身保持各端实现（R3F 组件 vs `createItemMesh`）。

**校验**：`validate(state)` 检测层板越界/超高、层间重叠、物品超出网格单元（含 90° 旋转包围盒），顶栏「⚠」按钮展示报告。

### 导出系统 (`src/utils/exportHtml.ts`)

`generateExportHtml()` 将场景序列化为自包含 HTML（内嵌 vanilla Three.js r128 CDN）。构建期调用 `buildSceneGeometry` 把几何注入 `DATA`，模板 JS 只遍历渲染，**无几何计算**。物品模型用 `createItemMesh`（各端实现，需与 R3F 物品组件保持外观一致）。

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
