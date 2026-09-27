# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

VisionAI 3D Workbench — 基于 Semi Design + React Three Fiber 的工业铝型材机架 3D 场景编辑器。支持多层隔板/台面/顶底板结构设计、铝型材骨架（带 T 型槽截面）、物品放置与变形、以及独立 HTML 导出。

## 技术栈

- **构建**: Vite 8 + TypeScript 6
- **前端框架**: React 19
- **3D 引擎**: @react-three/fiber + @react-three/drei + Three.js
- **UI 组件库**: @douyinfe/semi-ui + semi-icons（semi-ui 自身依赖 @dnd-kit，为传递依赖；项目代码不使用）
- **拖拽**: 原生 HTML5 drag（底栏表格行）

## 常用命令

```bash
npm run dev       # 启动开发服务器 (默认 :5173)
npm run build     # TypeScript 检查 + Vite 生产构建
npm run preview   # 预览构建产出的 dist/
npm run lint      # ESLint (flat config: eslint.config.js)
npm run test      # vitest 单元测试（src/**/*.test.ts）
npm run check     # 质量门 = lint + tsc + vitest + build（提交/改动前必跑）

docker compose build   # 构建部署镜像（node 构建 → nginx 托管）
docker compose up -d   # 部署到本机 :5173
```

**三端自适应（重要约定）**：断点 `isNarrow = viewportW < 900`（`App.tsx`）。**3D 视口内缩量必须用派生变量 `insetLeft`/`insetRight`**，面板宽度用 `leftPanelW`/`rightPanelW` —— 不要再直接写 `leftCollapsed ? 0 : LEFT_PANEL_W`（窄屏下面板是浮在 3D 之上的抽屉，内缩必须为 0，否则 390px 手机上画布只剩 90px）。窄屏顶栏只留 Logo（隐藏标题文字），低频功能走「更多」下拉；`BottomBarTable` 的 `compact` 属性在触摸端用 ↑/↓ 排序列**替换**无效的 ⠿ 拖拽把手（HTML5 拖拽在触摸屏不派发事件），**且必须放首列** —— 追加到末尾会落到横向滚动区外（实测 390px 下 x=651，控件存在但够不到）。

**验证三端/手势的方法**：CDP `Emulation.setDeviceMetricsOverride` 切视口、`Emulation.setTouchEmulationEnabled` + `Input.dispatchTouchEvent` 模拟手势。判断"手势是否真的生效"用 `Page.captureScreenshot` 的哈希对比，但**必须先测两帧无输入基线是否一致**（R3F 默认相机不挂进 scene，`scene.traverse(o=>o.isCamera)` 取不到，别指望读相机矩阵）。

**开源协议**：CC BY-NC-SA 4.0（`LICENSE` 为官方原文 + 中文说明），`package.json` 的 `license` 字段为 `CC-BY-NC-SA-4.0`。CC 系列非软件专用协议（无专利授权），商用需另行授权。

**PWA（可安装 / 离线）**：`public/manifest.webmanifest` + `public/sw.js`（手写，无依赖）+ `public/icons/`（脚本生成）。约定：① **只有生产构建注册 SW**（`main.tsx` 里 `import.meta.env.PROD`）—— dev 下 SW 会缓存模块请求导致改代码不生效；② 策略改动必须**同时升 `CACHE_VERSION`**（`activate` 靠它清旧缓存）；③ 运行时缓存**只对 `/icons/` 写入**，否则缺失路径回退的 index.html 会被缓存到不存在的 URL 下；④ nginx 必须给 `/sw.js` 与清单 `no-cache`（否则装了桌面的用户收不到更新），且清单必须显式 `default_type application/manifest+json`（nginx 不认 `.webmanifest`，默认 `application/octet-stream` 会让 Chrome 拒绝解析清单）；⑤ **SW 需要安全上下文**：`localhost` 或 HTTPS，纯 HTTP + 局域网 IP 不会注册（README 已写明）。
**⚠️ 验证"真离线"不能靠 CDP 的 `Network.emulateNetworkConditions(offline)`** —— 它只作用于页面自身的网络栈，**Service Worker 内部的 fetch 不受影响**（实测：模拟离线时跨域请求失败，但同源经 SW 的请求仍 200）。正确做法是**把服务器停掉**（`docker compose stop` 后 `curl` 连不上）再导航。
**⚠️ 静态文件权限会带进镜像**：Vite 把 `public/*` 按原权限复制进 `dist/`。若文件是 0600（某些工具创建的文件就是），nginx worker 读不到 → 该资源 403（本机实测 `sw.js`/清单 403，PWA 全废）。`Dockerfile` 已有 `RUN chmod -R a+rX` 兜底，新增 public 文件后仍建议 `ls -l` 看一眼。
**部署验证（已实测，别再只读文档）**：`docker compose config` → `docker compose build` → `docker compose up -d` → `docker compose ps` 应为 `healthy`（容器内有 HEALTHCHECK）；随后**务必用浏览器加载容器地址验证生产构建产物**（dev server 与生产构建不同：导出模块是独立 655 KB 按需 chunk，首屏包也只有生产构建才走真实分包）。镜像约 77 MB，`docker compose down` 后镜像保留。

**npm 分发（`bin/cli.mjs`）**：包内自带 `dist/`，`npx visionai-3dworkbench` 即可起服务，使用者不需要 Node 构建工具链。三条必须守住的约定：① **CLI 行为必须与 `nginx.conf` 一致**（SPA 回退、`/assets/` 缺失=404、`.webmanifest` MIME、缓存头、gzip）——改一边就要改另一边，否则"本地跑得好、上线不一样"；② **react/three/semi 等只能放 `devDependencies`**，放回 `dependencies` 会让 `npx` 连带装 100+ 个包（实测 147 个 → 1 个）；③ `files` 只含 `bin/ dist/ README LICENSE CHANGELOG`，源码不进包；`prepack` 负责刷新 `dist`、`prepublishOnly` 跑 `npm run check`。发布需维护者自己的 npm 账号，且 `LICENSE` 占位符必须先换成真实姓名（CC BY-NC-SA 4.0，非软件专用协议、限非商用）。

**部署**：纯前端 SPA，无后端。`Dockerfile` 多阶段构建（builder: node:22-alpine 跑 `npm run build` → runner: nginx:1.27-alpine 托管 `dist/`）；`nginx.conf` 做 SPA 回退与缓存/gzip；`.dockerignore` 排除 `node_modules`/`dist`。**场景数据（工程文件/localStorage 草稿）都在浏览器端，容器无状态，重建/升级不丢数据。** 新增部署文件改动只涉及 Dockerfile / docker-compose.yml / nginx.conf / .dockerignore 四个文件，不进入 `src/`。

**DOM 交互测试**：需要 DOM 的用例在文件首行声明 `// @vitest-environment jsdom`（默认环境仍是 node，几何内核测试跑得更快）。两条必须遵守的约定：① Semi 桶文件静态 import 的 `lottie-web` 在模块加载期就调用 `canvas.getContext('2d')`，jsdom 未实现 → 已在 `vite.config.ts` 的 `test.alias` 里指向 `src/test/lottie-stub.ts`（**不影响生产构建**）；② vitest 默认 `globals:false`，RTL 的自动卸载不生效，DOM 测试文件必须显式 `afterEach(cleanup)`，否则整个文件跑完进程不退出（表现为长时间无输出）。示例见 `src/components/__tests__/DeferredNumberInput.dom.test.tsx`。

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

- **`AppState`**（`src/state.ts`）：`{ dimensions, profile, columns, layers }` 的可序列化结构，是**工程文件 / localStorage 草稿 / 撤销栈三者共享的唯一数据形状**。`isAppState()` 是严格的顶层契约校验；**反序列化请用 `normalizeAppState()`** —— 它逐字段补默认值、丢弃无法识别的层与物品（`droppedLayers` 计数供 UI 提示），旧版工程文件缺 `placedItems`/`topColumns`/`bottomFrame` 时不再整页白屏，只有"完全不像工程文件"的输入才返回 `null`。
- **撤销/重做**：`App.tsx` 用 `historyRef`/`futureRef` 两个栈（各 60 步）+ `useEffect` 监听 `appState` 引用变化自动记录历史；`skipRecordRef` 标记跳过撤销/重做/加载/新建时的自我记录。`stateRef` 始终指向最新值供事件处理器读取。
- **持久化**：`localStorage` key `visionai-workbench-draft-v1`，500ms 防抖自动保存草稿，启动时恢复；顶栏按钮可下载/加载 `.json` 工程文件、新建（清草稿）。

**⚠️ 修改场景数据的入口都必须经过 `setAppState`**（或 `updateLayers` 包装），否则不会进入撤销栈。`updateLayers` 在 layers 引用未变时直接返回原 state，避免无效操作占用一次撤销。注意 `_lastHeight`/`_cappedElev`（模块级，`App.tsx` 顶部）在整体尺寸变更时处理标高截断/恢复，跨渲染持久；**加载工程文件 / 恢复草稿 / 新建后必须调用 `resetHeightBaseline()`**，否则首次改高度会以过期基线走错 `applyDimensionChange` 分支。

**⚠️ 更新层数据一律返回新对象**（`{ ...l, detail: { ...l.detail, elevation: v } }`），不要原地赋值 —— 撤销栈里的历史项与当前 state 共享同一批 `Layer` 对象，原地写入会连同历史一起改掉（`swapLayerElevations` 就是这么修的）。

### BOM 系统 (`src/utils/bom.ts`)

`computeBom(state)` 委托共享内核生成型材实例后聚合（`aggregateBom`），输出型材下料清单（规格×长度×数量）与板材清单。`bomToCsv()` 输出 UTF-8 BOM CSV，`bomToHtml()` 输出可打印的自包含 HTML 报告。几何算法在内核统一，无需再同步多端。

### 核心数据类型

- **Layer**: 层（`top`/`countertop`/`shelf`/`bottom`），包含尺寸、标高、厚度、布局网格、加强筋、连接方式等
- **PlacedItem**: 放置在层网格上的物品（坐标、类型、旋转变换），存于 `detail.placedItems`，是物品的唯一存储
- **⚠️ `detail.items`（v1.x 遗留的字符串数组）已删除**：它从未参与渲染或几何，只在归一化/复制层里被搬运；旧工程文件里带该字段会被归一化直接忽略
- **ItemType**: 19 种 3D 物品（工控机、笔记本、显示器、键盘、相机、光源、控制器、交换机、UPS、工具柜、包装箱等），分 7 类
- 机架整体由 `dimensions`（长宽高）、`profile`（型材标准+规格）、`columns`（各面骨架数量）定义
- **⚠️ `Layer`/`LayerDetail`/`PlacedItem` 定义在 `src/components/layerTypes.ts`**（纯模块，无 React/UI 依赖，供 `state.ts` 反序列化归一化复用）；`LeftPanel.tsx` 按原路径 re-export，`exportHtml.ts` 等既有 `import ... from '../components/LeftPanel'` 不受影响。层的默认参数统一用 `defaultLayerDetail()`（新建层与反序列化补全共用一份，避免漂移）
- **层可覆盖边框型材**（`detail.profileType`，如 `'GB-3030'`，空 = 跟随机架）：内核 `layerSpec()`/`layerMM()` 据此决定该层边框的 BOM 规格与截面（下料长度 = 层长 − 该层截面），右侧「层参数」→「边框型材」下拉是唯一入口；`profileMMOf()` 取规格串最后一段的前两位数字，因此自定义值必须是 `标准-规格` 形式
- **`columns` 除 6 方向数量外还有 `bottomFrame`（底框模式 `full/frontback/leftright/none`）和 `frontCap/backCap/leftCap/rightCap`**（各面额外立柱的截止层 ID，空字符串=全高）

### 中英文双语（`src/i18n/`）

**语言只影响显示，不改数据** —— 这是本项目 i18n 的第一原则：几何内核产出的层板标签（`顶板 / 台面 / 隔板 #N / 底板`）与 `自定义` 规格会写进工程文件、BOM、导出快照，若把语言塞进内核，切换语言就会改写用户数据。因此翻译只发生在**显示最后一跳**。

- `src/i18n/messages.ts` — `zh` 为准（`as const` 提供 `MessageKey` 联合类型），`en: Record<MessageKey, string>`：**英文少一个键 `tsc` 直接报错**，不会出现"英文界面漏一句中文"。
- `src/i18n/index.tsx` — `LocaleProvider`/`useT()`、`interpolate()`（`{var}` 插值）、`detectLocale(langs?)`（`zh*` → zh，其它 → en，**取不到语言信息时保持 zh**）。`I18nProvider` 负责同步 `<html lang>` 与 `document.title`；locale 存 `visionai-workbench-locale`。
- `src/i18n/labels.ts` — 显示层映射：`localizeLayerLabel(label, t)`（覆盖 `隔板 #N` **与聚合后的裸 `隔板`**）、`localizeProfileSpec`、`LAYER_TYPE_KEY`、`tFor(locale)`。
- **非 React 模块一律用显式 `locale` 参数（默认 `'zh'`）**：`validate(state, locale)`、`bomToCsv(bom, locale)`、`bomToHtml(bom, state, locale)`、`generateExportHtml(state, geo, locale)`、`procurementText(input, locale)`/`procurementLinks(keyword, locale)`。默认值保证既有调用与旧测试行为不变。
- **Semi 组件库自己的文案**（表格「暂无数据」/「No Result」、分页等）与我们的文案表无关，必须用 `LocaleProvider` 一起切（`src/main.tsx` 的 `SemiLocale`），否则英文界面里会突然冒出中文。
- ⚠️ **采购搜索关键词永远是中文**（`4040 铝型材 1600mm`）：四个平台都是中文站点，英文关键词搜不到货；en 界面只翻译平台显示名（Yiheda / Misumi / 1688 / Taobao）。
- ⚠️ **验证界面语言要用真实鼠标事件**：用 `Runtime.evaluate` 里 `el.click()` 触发 Semi/React 按钮时，出现过"`localStorage` 已切、界面没重渲染、`<html lang>` 没变"的假象；用 CDP `Input.dispatchMouseEvent` 真点击后一切正常。判断"是否还有漏翻"的正确做法是**遍历可见文本节点扫 CJK**，而不是只探测几个关键词（关键词测试会漏，且短词可能被别的 DOM 文本偶然命中）。

### 物品系统 (`src/components/items/`)

- `types.ts` — `ItemRegistry` 定义所有物品元数据（名称、尺寸、分类），以及 `ITEM_MAP` / `ITEMS_BY_CATEGORY` / `CATEGORY_NAMES` 等注册表
- `ItemModel.tsx` — **物品 3D 模型统一实现**：渲染 `getItemPrimitives(type)` 的共享几何描述
- `index.tsx` — `ITEM_COMPONENTS` 将 `ItemType` 映射到绑定类型的 `ItemModel` 组件
- `ItemThumbnail.tsx` — 用 Canvas 2D 生成缩略图预览

**⚠️ 物品模型外观由 `src/geometry/itemModel.ts` 的 `getItemPrimitives(type)` 单一描述**（基础图元 box/roundedBox/cylinder/sphere/torus/plane/circle + 位置/旋转/材质）。3D 端 `<ItemModel>` 与导出端 `createItemMesh` 遍历同一描述渲染，两端视觉一致。**新增/修改物品外观时只改 `itemModel.ts`，并保持两种渲染端均可消费**（图元参数与 three 构造一致，单位为米）。

### 共享几何内核 (`src/geometry/`)

**场景几何算法只有一份实现**——`buildSceneGeometry(state)` 生成全部型材实例（`BeamInstance`，含渲染坐标与 BOM 长度）、板材（`BoardInstance`）与物品占位（`ItemPlacement`，含 0.85 填充系数的基准缩放）。SceneView / exportHtml / bom 三端全部消费内核数据，不再各自实现几何，根治历史 EXPORT-1~5 类漂移回归。

```
src/geometry/
├── types.ts        # BeamInstance / BoardInstance / ItemPlacement / FrameContext
├── context.ts      # getFrameContext（尺寸/规格/立杆截断上下文）、profileMMOf
├── frame.ts        # buildFrameBeams（角柱/横梁/立柱/顶底梁/无顶板顶框）
├── layer.ts        # buildLayerGeometry（层板/边框/连接/加强筋）、boardLabel、zOffsetOf、nearestLayerAbove/Below
├── items.ts        # computePlacements（物品占位：旋转感知 + 净空自适应缩放）
├── aggregate.ts    # aggregateBom / bomTotals（BOM 聚合）
├── dimension.ts    # applyDimensionChange（标高截断/恢复状态机，纯函数）
├── operations.ts   # remapPlacedItems / duplicateLayer / swapLayerElevations（纯函数，可单测）
├── validate.ts     # validate（干涉/越界/净空校验）
└── index.ts        # buildSceneGeometry 统一入口
```

**⚠️ 邻层关系必须只按标高判断**（`nearestLayerAbove` / `nearestLayerBelow`）：三端传入的层数组顺序不同（SceneView/导出传标高降序 `sortedLayers`，BOM 传原始插入顺序），任何 `find` / `reverse().find` 式的"按数组位置取邻层"都会导致同场景不同结果（历史 P0 缺陷）。

**⚠️ `applyDimensionChange` 的长宽规则是「逐层逐轴」**：锁定层（`detail.locked`，顶板/台面/底板默认锁定）始终跟随机架长宽；未锁定层中原本等于机架长/宽的那一轴继续跟随；其余**保留用户自定义尺寸**，仅在新机架变小导致越界时收敛。不要退回「所有层都写成机架尺寸」——那会静默清掉用户为隔板设的局部尺寸（配合 `halign` 的窄/半深搁板）。

**⚠️ 每次状态变更只算一次几何**：`App.tsx` 用一个 `useMemo` 生成 `sceneGeometry`，再传给 BOM（`computeBomFromGeometry`）、校验（`validateGeometry`）、`SceneView`（`geometry` prop）与导出（`generateExportHtml(state, geo?)`）。**不要在组件内再调 `buildSceneGeometry`** —— 大场景下每多一处就多一次全量几何计算。

**⚠️ 几何内核与导出层不得 import React 组件**：`src/geometry/*`、`utils/exportHtml.ts` 只从纯模块取数据 —— 层类型走 `components/layerTypes.ts`，物品元数据走 `components/items/types.ts`。`components/LeftPanel.tsx`、`components/items/index.tsx` 是 UI 入口，从它们 import 会把 React/R3F 拖进内核依赖图。

**⚠️ 修改骨架/层/物品几何时必须改内核**（`SceneView.tsx` 只消费 `BeamInstance`/`BoardInstance` 渲染，`exportHtml.ts` 只消费 `DATA.frameBeams`/`DATA.layerGeom` 渲染，`bom.ts` 只聚合），三端渲染端不再包含几何计算。物品 3D 模型本身保持各端实现（R3F 组件 vs `createItemMesh`）。

**板材清单显示要走 `aggregateBoards()`**（`src/geometry/aggregate.ts`）：`bom.boards` 是「一层一块」（3D/导出/测试按层逐条消费，**不要改它**），而下料/采购清单里把两块同样的隔板列成两行没有意义。`aggregateBoards` 按「名称 + 长宽厚」合并，且**名称里的 `#N` 内部编号不参与合并键**（`shelfIndex` 派生，采购时是噪音）：弹窗表格 / `bomToCsv` / `bomToHtml` / 采购文本四处共用。

**采购直达（`src/utils/procurement.ts`）**：只生成各平台**搜索深链**，**不接任何下单接口** —— 1688/淘宝/怡合达/米思米的正式对接都要商家资质，公开免费的下单 API 不存在；因此始终与「复制采购清单」文本路径并存。平台 URL 形态：怡合达 `/product/search/<encodeURIComponent(关键词)>`、米思米 `/vona2/result/?searchWord=`、1688 `s/1688.com/selloffer/offer_search.htm?keywords=`、淘宝 `s.taobao.com/search?q=`（前两个 2026-02 实测 200）。平台改版会让链接失效，改这里时记得同步更新单元测试里的 URL 形态断言。

**⚠️ 弹窗宽度必须响应式**：`Modal` 的 `width` 一律写 `isNarrow ? '94vw' : <桌面宽度>`。固定宽度（900/560/520）在 390px 手机上左右各溢出 255/85/65px，底部按钮会落到屏幕外 —— 而且这类问题**文档不溢出**（弹窗是 fixed），只查 `document.scrollWidth` 查不出来，必须逐个量弹窗与按钮的左/右边界（`left >= 0 && right <= innerWidth`）。

**校验**：`validate(state)` 检测层板越界/超高（error）、层间重叠、物品超出网格单元（含 90° 旋转包围盒）、物品顶部穿透上方最近层底面（`item-clearance`，5mm 容差、每层最多一条；顶板之上为开放空间不校验），顶栏「⚠」按钮展示报告。

### 导出系统 (`src/utils/exportHtml.ts`)

`generateExportHtml()` 将场景序列化为自包含 HTML。**导入方式必须是动态 `import()`**（`App.tsx` 的 `doExport`/`prefetchExport`）—— 本模块内嵌 620KB 的 three r128 源码，改回静态 import 会把首屏主包从 1.87MB 顶回 2.52MB。**构建期调用 `buildSceneGeometry` 注入几何到 `DATA`，并注入 `getItemPrimitives` 物品图元**；three r128 与 OrbitControls 通过 `?raw` 内嵌打包（`src/export/vendor/`），断网/内网亦可打开。模板 JS 只遍历渲染，无几何计算。导出端含「标」按钮切换尺寸标注/层 ID 分组（`dimGroup`/`idGroup`）。

**⚠️ 离线内嵌的三份文件**：`three-r128.min.js` + `OrbitControls-r128.js`（vendored）+ `exportHtml.ts` 模板。升级 three 需同时替换 vendor 文件并核对 `createItemMesh` 的图元构造与 `roundedBoxGeo`。物品模型外观统一走 `itemModel.ts`，导出端 `createItemMesh` 遍历同一描述。

### 通信机制

组件间通过 `window.dispatchEvent(new CustomEvent(...))` 实现松散耦合通信：
- `focus-camera` — 聚焦到指定层
- `set-bg` / `set-camera-target` / `reset-camera` — 背景/视角控制
- `set-show-dims` / `set-show-shelf-ids` — 标识可见性切换
- 模块级变量 `_showDims` / `_showIds` 配合监听器数组实现跨组件可见性同步

### 3D 场景要点

- **3D 视口 = 主区域减去左右侧栏与底栏**：三者都是浮动覆盖层，若不内缩，相机就以整块主区域取景 —— 机架底部被底栏盖住、模型偏向窗口中心（实测偏左 166px）。`App.tsx` 把 `SceneView`、浮动视角工具条、空状态引导都包在同一个内缩容器里：`left: insetLeft`、`right: insetRight`、`bottom: bottomBarH`（底栏高度由 `ResizeObserver` 实测，收起时为 0）。**新增浮在 3D 之上的 UI 时也必须放进这个内缩容器**，否则又会出现「按窗口居中」的错位；侧栏宽度用派生变量 `leftPanelW`/`rightPanelW`（窄屏走抽屉宽度，见上文「三端自适应」），基础常量仍是 `LEFT_PANEL_W`/`RIGHT_PANEL_W`
- 铝型材截面通过 `THREE.Shape` 描述 T 型槽轮廓，经 `ExtrudeGeometry` 拉伸成型
- 层板采用 `boxGeometry` + 半透明材质，选中时高亮（非选中层透明度降至 0.15）
- 物品选中后显示 3D 浮窗工具栏（缩放/旋转/翻转/删除操作）
- 环境贴图通过 `PMREMGenerator` 实时生成渐变球体场景，无需外部 HDR

## 开发注意事项

- 所有尺寸单位：代码中以米为单位（除 UI 输入显示 mm），`exportHtml.ts` 直接在 JS 中计算
- 物品 `size` 轴顺序：`[长(X), 宽(Z), 高(Y)]`，单位米（见 `types.ts` 顶部注释）
- **隔板「#N」编号只认 `shelfIndex()`**（`src/geometry/layer.ts`，按标高降序、与数组顺序无关）：底栏、3D 标签、右侧面板、导出 HTML 共用它；`boardLabel` 也由它派生。不要再写 `layers.filter(shelf).findIndex(...)` —— 数组顺序在不同调用点并不一致
- **`sortedLayers`（标高降序）是贯穿全应用的规范顺序**：`App.tsx` 中 `useMemo` 生成，层参数、底栏表格、3D 场景、导出全部基于它，不要直接传原始 `layers`
- `main.tsx` 使用 `React.StrictMode`（开发期组件双重挂载），配合模块级可变状态（`_cappedElev`/`_lastHeight`/`_showDims`/`_showIds`）实现跨渲染持久化——这些是**有意的模式**，新增跨组件可见性状态时沿用
- **`main.tsx` 顶部必须保持 `import '@douyinfe/semi-ui/react19-adapter'` 在任何 Semi 组件之前**——React 19 下 Semi 的命令式 API（`Modal.confirm`/`Toast`/`Notification`）依赖它注入 createRoot，移除会导致这些 API 静默失效
- **给「禁用态按钮」加 Tooltip 必须包一层 `<span>`**：原生 `<button disabled>` 不派发鼠标事件，Tooltip 直接套在禁用按钮上永远不会显示。已采用此模式的场景：层结构里顶板/台面/底板达到 maxCount 时、顶栏「撤销/重做」在历史为空时（后者一度被漏掉，导致快捷键提示在空历史时看不见）
- **破坏性操作确认一律用 `Modal.confirm`，不要用 `window.confirm`**：原生对话框会阻塞整个渲染进程（3D 停止刷新、自动化直接挂死），样式与产品脱节，且在部分内嵌/移动端环境被静默拦截
- **`DeferredNumberInput` 的「放弃编辑」必须重新挂载输入框**：Semi `InputNumber` 聚焦期间不会把 `value` prop 回写到显示文本，只 `setDraft` 会出现「数据已回滚、屏幕仍显示刚敲的值」；`forwardedRef` 在本版 Semi + React 19 下是死的（ref 回调不触发），所以用 `key={epoch}` 重挂载 + effect 还焦点
- **⚠️ 所有数值输入必须用 `DeferredNumberInput`（`src/components/DeferredNumberInput.tsx`）**：Semi 的 `InputNumber.onChange` **每敲一个字符**触发一次，直接接场景状态会让中间值真实入场景 —— 布局列输入 12 途中的 1 会经 `remapPlacedItems` 永久删掉 col>0 的物品，机架长输入 2000 途中的 2mm 会把自定义尺寸层夹死；且每次提交都是全量几何重建（大场景约 0.85s）。该组件本地草稿 + 失焦/回车提交一次，并按 min/max 夹取。新增数值输入时不要退回裸 `InputNumber`
- **新建/复制出来的对象必须立刻选中它**（同一原则的两处实现）：放物品 → `handlePlaceItem` 里 `setSelectedPlacedItem`；复制层 → `LeftPanel` 的 `duplicate` 调用 `onLayerSelect(copy.id)`。副本/新对象的视觉差异往往很小（复制层只 +10mm 标高，与原层几乎重合），不选中的话用户会认为操作失败
- **放置物品后必须选中新物品**：`handlePlaceItem` 用 `setSelectedPlacedItem({ layerId, col, row })`（仅在删除、即 `itemType` 为 `null` 时置 `null`）。3D 变形浮窗的显示条件是 `selectedPlacedItem` 与格子匹配，放完就清空选中会让用户看不到缩放/旋转/删除入口，只能再点一次该格子
- **改层布局（列×行）会经 `handleLayoutChange` 调 `remapPlacedItems` 重映射物品**（越界移除/界内保留）；「复制层」走 `duplicateLayer`（深拷贝+标高+10）；底栏拖拽排序走 `swapLayerElevations`（仅台面/隔板参与，交换标高、返回新数组）。三者均为 `src/geometry/operations.ts` 纯函数，可单测
- 撤销/重做支持 Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z、Ctrl+Y（输入框聚焦时自动跳过）
- **新增物品要改四处，缺一不可**：① `components/items/types.ts` 的 `ITEM_REGISTRY`（含 `nameEn`/`descriptionEn`，缺英文名英文界面会退化成中文）+ `ItemType` 联合类型；② `geometry/itemModel.ts` 的 `getItemPrimitives` 图元描述（**导出端与 3D 端共用同一份，`exportHtml.ts` 无需改动**）；③ `components/items/index.tsx` 的 `ITEM_COMPONENTS`（`Record<ItemType,…>`，漏了 `tsc` 会报错）；④ `components/items/ItemThumbnail.tsx` 的缩略图分支（**该 switch 没有 default**，漏了物品库里的预览就是空白）。`geometry/__tests__/itemModel.test.ts` 会自动遍历注册表检查图元非空 / 颜色合法 / 尺寸为正
- 层拖拽排序只允许 `countertop` 和 `shelf` 类型，通过交换标高值实现（顶板/底板作为拖拽目标会被忽略，不再被打乱标高）
- 顶板拆除或添加时自动调整台面标高
