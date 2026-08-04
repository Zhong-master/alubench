# 变更记录

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。版本号遵循语义化版本。

## [1.2.0] - 2026-08-04

### 重构（根治几何漂移）

- **共享几何内核 `src/geometry/`**：型材/板材/物品占位几何算法收敛为单一实现（`buildSceneGeometry`），SceneView、导出 HTML、BOM 三方统一消费 `BeamInstance`/`BoardInstance`/`ItemPlacement`，消除三份几何实现漂移（历史 EXPORT-1~5 类回归的根源）
  - `context.ts`（尺寸/规格/立杆截断上下文）、`frame.ts`（机架级型材）、`layer.ts`（层板/边框/连接/加强筋）、`items.ts`（物品占位）、`aggregate.ts`（BOM 聚合）
  - `exportHtml.ts` 改为构建期计算几何注入 `DATA`，模板 JS 只渲染
  - `bom.ts` 委托内核聚合
  - `SceneView.tsx` 保留交互（网格/选中/放置），几何渲染消费内核
- **尺寸真实性**：物品基准缩放去掉 0.35 上限，改为按网格单元 0.85 填充系数（SceneView 与导出 HTML 同步生效）
- **标高截断/恢复状态机**抽出为纯函数 `applyDimensionChange`（`App.tsx` 调用）

### 新增

- **干涉/越界校验**（`src/geometry/validate.ts`）：层板越界/超高（error）、层间垂直重叠（warning）、物品超出网格单元含 90° 旋转包围盒（warning）；顶栏「⚠」按钮角标计数 + 报告弹窗
- **vitest 单元测试**：18 个用例覆盖 BOM 聚合、标高状态机、物品占位、干涉校验（`src/geometry/__tests__/`）；`npm run test`，纳入 `npm run check` 质量门

### 工程化

- `package.json`：新增 `test` script，`check` 加入 vitest

## [1.1.0] - 2026-08-04

### 新增

- **保存 / 加载工程文件**：顶栏新增「保存 / 加载」按钮，场景以 `.json` 工程文件下载与导入（`src/state.ts` 定义 `AppState` 统一数据形状，`isAppState()` 防御性校验）
- **自动草稿**：场景变更 500ms 防抖写入 localStorage，页面刷新自动恢复上次编辑（Toast 提示）
- **撤销 / 重做**：顶栏按钮支持 60 步历史（`historyRef`/`futureRef` 双栈），状态变更自动入栈
- **新建场景**：一键清空场景并删除自动草稿
- **BOM 切割清单**：顶栏「清单」按钮弹出清单面板，从参数层计算型材下料清单（规格×长度×数量聚合）与板材清单；支持下载 **CSV**（UTF-8 BOM，Excel/WPS 直接打开）与**自包含 HTML 报告**（可打印、可分享）（`src/utils/bom.ts`）

### 工程化

- 初始化 Git 仓库（`.gitignore` 忽略 `node_modules/`、`dist/`）
- 引入 **ESLint**（flat config：`eslint.config.js`，含 typescript-eslint 与 react-hooks 插件），新增 `npm run lint` 与 `npm run check`（lint + tsc + build）质量门
- 修复质量门暴露的问题：`LayerEditor` 中 `useRef` 条件调用（违反 hook 顺序）、渲染期创建组件（`Num` 提取为独立组件）、删除 5 处未使用导入、消除 15 处 `any` 类型逃逸、`exhaustive-deps` 依赖修正
- 新增 `src/components/threeTypes.ts`（R3F `controls` 最小结构类型）
- 文档：新增 README.md / CHANGELOG.md，更新 CLAUDE.md（命令、场景状态与撤销/BOM 架构）

### 修复

- `LayerEditor` 隔板编号显示：属性面板标题不再写死为「隔板 #1」（编号与底栏/3D 标签一致）

## [1.0.0] - 初始版本

- 铝型材机架 3D 编辑器基础功能：整体尺寸、骨架编辑、层结构管理、型材型号
- 14 种工业物品的放置与变形（缩放/旋转/翻转/删除）
- 自包含 HTML 导出（vanilla Three.js）
