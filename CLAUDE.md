# AluBench 架构与开发约定

本文件记录项目的架构骨架与**硬性约定**，供维护者与 AI 编码工具参考。改代码前请先读一遍「硬性约定」一节 —— 其中多数规则都对应曾经踩过的真实缺陷。

## 项目简介

**AluBench** — 铝型材工作台 3D 设计器。基于 Semi Design + React Three Fiber 的工业铝型材机架场景编辑器：多层隔板 / 台面 / 顶底板 + T 型槽铝型材骨架 + 物品布置 + BOM 下料清单 + 自包含 HTML 导出。纯前端，无后端。

## 技术栈

- **构建**：Vite 8 + TypeScript 6
- **框架**：React 19
- **3D**：@react-three/fiber + @react-three/drei + Three.js 0.184
- **UI**：@douyinfe/semi-ui + semi-icons（其传递依赖 @dnd-kit 项目代码未使用）
- **拖拽**：原生 HTML5 drag（底栏表格行）
- **测试**：vitest（几何内核用 node 环境，DOM 用例显式声明 jsdom）
- **部署**：Docker（多阶段 → nginx）/ npm 包（零依赖 CLI）

## 常用命令

```bash
npm run dev       # 开发服务器（默认 :5173）
npm run build     # 类型检查 + Vite 生产构建
npm run test      # 单元测试
npm run check     # 质量门 = ESLint + tsc + vitest + 生产构建（提交前必跑）

docker compose up -d --build   # 部署到本机 :5173
npm pack                       # 打包 npm 包（自动先构建）
```

## 架构

### 数据流（集中在 App.tsx）

所有场景状态集中在 `App.tsx`，向下传 props：

```
App（状态 + 撤销栈 + 持久化）
├── SceneView.tsx        ← R3F Canvas
│   ├── CameraController.tsx / MiniCube.tsx
│   └── items/*          ← 3D 物品组件
├── LeftPanel.tsx        ← 整体尺寸 / 骨架 / 层管理 / 型材型号
├── LayerEditor.tsx      ← 选中层参数
└── BottomBarTable.tsx   ← 底栏层参数表（拖拽排序）
```

### 共享几何内核 `src/geometry/`

**场景几何只有一份实现。** `buildSceneGeometry(state)` 产出型材实例（`BeamInstance`）、板材（`BoardInstance`）与物品占位（`ItemPlacement`）；`SceneView` / `exportHtml` / `bom` 三端全部消费它，不再各自算几何。

```
src/geometry/
├── types.ts       # BeamInstance / BoardInstance / ItemPlacement / FrameContext
├── context.ts     # getFrameContext、profileMMOf
├── frame.ts       # buildFrameBeams（角柱 / 横梁 / 立柱 / 顶底梁）
├── layer.ts       # buildLayerGeometry、boardLabel、zOffsetOf、nearestLayerAbove/Below
├── items.ts       # computePlacements（旋转感知 + 净空自适应缩放）
├── aggregate.ts   # aggregateBom / aggregateBoards / bomTotals
├── dimension.ts   # applyDimensionChange（标高截断 / 恢复状态机，纯函数）
├── operations.ts  # remapPlacedItems / duplicateLayer / swapLayerElevations（纯函数）
├── validate.ts    # validate（干涉 / 越界 / 净空校验）
└── index.ts       # buildSceneGeometry 统一入口
```

### 状态、撤销与持久化

- `AppState`（`src/state.ts`）是工程文件 / localStorage 草稿 / 撤销栈**三者共享的唯一数据形状**；反序列化一律走 `normalizeAppState()`（逐字段补默认、丢弃无法识别的层与物品），不要直接用 `isAppState()` 的结果强转。
- 撤销栈：`historyRef` / `futureRef` 各 60 步，`useEffect` 监听 state 引用变化自动记录；`skipRecordRef` 用于跳过撤销/重做/加载/新建时的自我记录。
- 草稿：localStorage `alubench-draft-v1`，500ms 防抖；界面语言存 `alubench-locale`。
- 有意的模块级可变状态：`_cappedElev` / `_lastHeight`（标高截断基线）、`_showDims` / `_showIds`（跨组件可见性），配合 `React.StrictMode` 双重挂载实现跨渲染持久。

### 导出系统 `src/utils/exportHtml.ts`

`generateExportHtml()` 把场景序列化成自包含 HTML。**必须用动态 `import()` 引入**（`App.tsx` 的 `doExport` / `prefetchExport`）：模块内嵌 620 KB three r128 源码，改回静态 import 会把首屏主包从 1.87 MB 顶回 2.52 MB。three r128 与 OrbitControls 经 `?raw` 内嵌（`src/export/vendor/`），断网 / 内网可打开；模板 JS 只遍历渲染，不做几何计算。

### 双语 `src/i18n/`

**语言只影响显示，不改数据。** 几何内核产出的层板标签（`顶板 / 台面 / 隔板 #N / 底板`）与 `自定义` 规格会写进工程文件、BOM、导出快照，若把语言塞进内核，切语言就会改写用户数据；因此翻译只发生在**显示最后一跳**。

- `messages.ts`：`zh` 为准（`as const` 提供 `MessageKey`），`en: Record<MessageKey, string>` —— 英文少一个键 `tsc` 直接报错。
- `index.tsx`：`LocaleProvider` / `useT()` / `interpolate()` / `detectLocale()`；同步 `<html lang>` 与标题。
- `labels.ts`：`localizeLayerLabel` / `localizeProfileSpec` / `tFor(locale)`。
- **非 React 模块一律显式传 `locale`（默认 `'zh'`）**：`validate`、`bomToCsv`、`bomToHtml`、`generateExportHtml`、`procurementText` / `procurementLinks`。
- Semi 自己的文案（表格「暂无数据」等）必须用 `LocaleProvider` 一起切（`main.tsx` 的 `SemiLocale`）。
- ⚠️ **Semi `Select` 会缓存挂载时的选项文案**，不跟随运行时切语言 —— 需要 `key={locale}` 重挂载（见 `App.tsx` 中 `LeftPanel` / `LayerEditor` / `BottomBarTable`）。

### 物品系统 `src/components/items/`

`types.ts`（注册表 + `ItemType`）/ `ItemModel.tsx`（统一渲染）/ `index.tsx`（`ITEM_COMPONENTS`）/ `ItemThumbnail.tsx`（Canvas 2D 缩略图）。

⚠️ **物品外观由 `src/geometry/itemModel.ts` 的 `getItemPrimitives(type)` 单一描述**（box / roundedBox / cylinder / sphere / torus / plane / circle + 位置 / 旋转 / 材质，单位米）；3D 端与导出端遍历同一描述渲染，两端视觉一致。新增物品**要改四处**：① `types.ts` 的 `ITEM_REGISTRY`（含 `nameEn` / `descriptionEn`）+ `ItemType` 联合；② `itemModel.ts` 的图元；③ `index.tsx` 的 `ITEM_COMPONENTS`（漏了 `tsc` 报错）；④ `ItemThumbnail.tsx` 缩略图分支（**switch 无 default**，漏了预览就是空白）。

### 部署与分发

- **Docker**：`Dockerfile` 多阶段（node:22-alpine 构建 → nginx:1.27-alpine 托管 `dist/`），`nginx.conf` 负责 SPA 回退、缓存与 gzip，`.dockerignore` 排除 `node_modules` / `dist`。容器无状态 —— 场景数据都在浏览器端，重建 / 升级不丢数据。`public/*` 的文件权限会带进镜像，Dockerfile 用 `chmod -R a+rX` 兜底。
- **npm 包**：`bin/cli.mjs` 是零依赖静态服务器，包内自带 `dist/`。① **CLI 行为必须与 `nginx.conf` 一致**（SPA 回退、`/assets/` 缺失 = 404、`.webmanifest` MIME、缓存头、gzip）—— 改一边就要改另一边；② **react / three / semi 等只能放 `devDependencies`**（它们只在构建期用，放回 `dependencies` 会让安装连带拉 100+ 个包）；③ `files` 只含 `bin/ dist/ README LICENSE CHANGELOG`，源码不进包；`prepack` 刷新 `dist`、`prepublishOnly` 跑 `npm run check`。

## 硬性约定

**几何与状态**

- 邻层关系**只按标高判断**（`nearestLayerAbove` / `nearestLayerBelow`）：三端传入的层数组顺序不同（SceneView / 导出传标高降序 `sortedLayers`，BOM 传插入顺序），任何按数组位置取邻层的写法都会让同场景出现不同结果。
- `sortedLayers`（标高降序）是贯穿全应用的规范顺序，不要直接传原始 `layers`。
- 隔板「#N」编号只认 `shelfIndex()`（按标高降序）；不要再写 `layers.filter(shelf).findIndex(...)`。
- `applyDimensionChange` 的长宽规则是**逐层逐轴**：锁定层跟随机架长宽，未锁定层原本等于机架长/宽的那一轴继续跟随，其余保留用户自定义尺寸（仅在越界时收敛）。不要退回「所有层都写成机架尺寸」。
- **每次状态变更只算一次几何**：`App.tsx` 一个 `useMemo` 产出 `sceneGeometry` 后传给 BOM / 校验 / SceneView / 导出；不要在组件内再调 `buildSceneGeometry`。
- 改场景数据的入口必须经过 `setAppState`（或 `updateLayers`），否则不进撤销栈；**更新层一律返回新对象**（`{ ...l, detail: { ...l.detail, elev } }`），原地写入会连同撤销历史一起改掉。
- 加载工程 / 恢复草稿 / 新建后必须调 `resetHeightBaseline()`。
- 层拖拽排序只允许 `countertop` 与 `shelf`，通过交换标高实现；改层布局（列 × 行）走 `remapPlacedItems`，复制层走 `duplicateLayer`。

**界面**

- 断点 `isNarrow = viewportW < 900`；**3D 视口内缩必须用派生变量 `insetLeft` / `insetRight`**（窄屏下面板是浮在 3D 之上的抽屉，内缩须为 0），面板宽度用 `leftPanelW` / `rightPanelW`。新增浮在 3D 之上的 UI 也必须放进同一个内缩容器。
- 窄屏 `BottomBarTable` 用 ↑/↓ 排序**替换**无效的 ⠿ 拖拽把手（HTML5 拖拽在触摸屏不派发事件），且必须放首列，否则会落到横向滚动区外。
- **所有数值输入必须用 `DeferredNumberInput`**：Semi `InputNumber.onChange` 每敲一个字符触发一次，直接接状态会让中间值真实入场景（输入 12 途中的 1 会经 `remapPlacedItems` 删掉 col>0 的物品），且每次都触发全量几何重建。
- 弹窗宽度一律 `isNarrow ? '94vw' : <桌面宽度>`；固定宽度在 390px 手机上会让按钮落到屏幕外（弹窗是 fixed，查 `document.scrollWidth` 查不出来）。
- 破坏性操作确认一律用 `Modal.confirm`，**不要 `window.confirm`**（阻塞渲染进程）。
- 禁用态按钮加 Tooltip 必须包一层 `<span>`（禁用按钮不派发鼠标事件）。
- 新建 / 复制出来的对象必须立刻选中它（放物品 → 设 `selectedPlacedItem`；复制层 → 选中副本），否则用户会以为操作失败。
- `main.tsx` 顶部必须保持 `import '@douyinfe/semi-ui/react19-adapter'` 在任何 Semi 组件之前；`React.StrictMode` 与上述模块级状态是有意搭配，不要"顺手"清理。

**代码边界**

- `src/geometry/*` 与 `utils/exportHtml.ts` **不得 import React 组件**：层类型走 `components/layerTypes.ts`，物品元数据走 `components/items/types.ts`。
- 采购（`src/utils/procurement.ts`）只生成平台**搜索深链**，不接下单接口（公开免费的下单 API 不存在）；搜索关键词永远是中文 —— 四个平台都是中文站点。平台改版会让链接失效，改这里时同步更新单元测试里的 URL 形态断言。
- ESLint 中 `react-hooks/immutability` / `refs` / `set-state-in-effect` 三条已显式关闭（与 R3F 命令式场景操作、撤销栈 ref、mount 期草稿恢复冲突，属有意为之）；其余规则保持严格，新增代码不应出现 `any` 逃逸。

## 验证方法

- **DOM 用例**首行声明 `// @vitest-environment jsdom`，并显式 `afterEach(cleanup)`（vitest `globals:false` 下 RTL 不会自动卸载）。Semi 桶文件静态 import 的 `lottie-web` 在模块加载期调用 `canvas.getContext('2d')`，已在 `vite.config.ts` 的 `test.alias` 指向 stub（不影响生产构建）。
- **界面语言**要用真实鼠标事件验证（CDP `Input.dispatchMouseEvent`）：`Runtime.evaluate` 里 `el.click()` 触发 Semi/React 按钮会出现"`localStorage` 已切、界面没重渲染"的假象。判断是否漏翻的正确做法是**遍历可见文本节点扫 CJK**。
- **真离线**不能靠 CDP 的 `Network.emulateNetworkConditions(offline)`（它不作用于 Service Worker 内部的 fetch）—— 要把服务器停掉再导航。
- **部署**：`docker compose build` → `up -d` → `ps` 应为 `healthy`，随后用浏览器加载容器地址验证**生产构建产物**（dev server 与生产构建的分包行为不同）。
- **三端 / 手势**：CDP `Emulation.setDeviceMetricsOverride` 切视口、`setTouchEmulationEnabled` + `Input.dispatchTouchEvent` 模拟手势；判断手势是否生效用 `Page.captureScreenshot` 的哈希对比，但**先测两帧无输入基线是否一致**。
- **任何依赖机器 locale 的用例都会"本机过、CI 挂"**：Node ≥21 的 `navigator.language` / `navigator.languages` 取自进程 `LANG`（本机 `zh_CN` → `['zh-CN']`，CI `LANG=C` → `['en-US']`）。涉及语言探测的断言必须**显式传数组**或用 `vi.stubGlobal('navigator', …)`，不要读运行环境。本地复现 CI 行为：`env LANG=C LC_ALL=C npx vitest run`。

### README 配图（`docs/images/`）

配图由 CDP 驱动 headless Chrome 拍摄（SwiftShader 软件渲染）。踩过的三个坑，重拍前务必先看：

- **写 localStorage 前必须先导航到应用源**：在 `about:blank` 上写会因跨源抛异常且被静默吞掉，应用随即回落到磁盘上的旧草稿 —— 曾导致部分配图与其余配图不是同一个场景（层数不同，一眼看出不一致）。写入后应断言字节数，别只看有没有报错。
- **CDP 的 `Input.dispatchMouseEvent(mouseWheel)` 对相机无效**（实测多次滚轮后画面完全不变）。要改取景就用 `set-camera-target` 事件传绝对位置，按 `SceneView` 的机位公式算：`pos = center + k · dist · (-0.65, +0.7, +0.8)`，其中 `center = (W/2, H/2, D/2)`、`dist = maxDim × 2.5`，`k < 1` 推近、`k > 1` 拉远。
- **两处固定高度决定了必须用 4 层场景与 ≥1200px 高的视口**：底栏 `maxHeight: '25vh'`（5 行约需 281px，1000px 高时末行会被切）、左面板「层结构」列表固定 220px（5 张卡需 248px，末张卡被切成残片；4 张卡刚好）。

## 授权

CC BY-NC-SA 4.0，版权归 Zhong-master 所有，详见 [LICENSE](LICENSE)。非商业性使用免费；商业使用需另行取得授权。
