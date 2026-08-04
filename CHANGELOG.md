# 变更记录

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。版本号遵循语义化版本。

## [1.5.0] - 2026-08-04

### 新增

- **Docker 部署**：`Dockerfile` 多阶段构建（node:22 构建 → nginx:1.27 静态托管），`docker-compose.yml` 一键启动（宿主机 5173 → 容器 80），`nginx.conf` 含 SPA 回退/`/assets/` 永久缓存/`index.html` 不缓存/gzip（主 JS 2.5 MB → 812 KB），容器内置 `HEALTHCHECK`
- **`.dockerignore`**：排除 `node_modules`/`dist`，构建上下文仅含源码，镜像精简

## [1.4.0] - 2026-08-04

### 新增

- **网格重排物品重映射**：修改层布局（列×行）时，越界物品自动移除、界内保留（`src/geometry/operations.ts` 的 `remapPlacedItems` 纯函数）
- **复制层**：层结构行内新增「复制」按钮（仅台面/隔板），深拷贝层（含物品/布局/加强筋），标高 +10mm 错开原层（`duplicateLayer`）
- **撤销/重做快捷键**：Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z、Ctrl+Y；输入框/文本域聚焦时不触发
- **导出前校验拦截**：存在错误级校验问题时，导出前弹确认（仍要导出/取消）
- **首屏空状态引导**：无层时 3D 视图叠加引导面板（添加层→调尺寸→放物品→BOM/导出）

### 修复

- **Semi 命令式 API 在 React 19 下失效**（真实 bug）：`main.tsx` 顶部注入 `@douyinfe/semi-ui/react19-adapter`，`Modal.confirm` / `Toast` 此前从未真正显示（P0 的草稿恢复 Toast、本版导出拦截弹窗均受影响）

### 测试

- `remapPlacedItems`（越界移除/保留）、`duplicateLayer`（深拷贝/标高+10/引用隔离）9 用例
- 物品图元完整性：14 类型非空、主体尺寸合法、颜色格式合法

## [1.3.0] - 2026-08-04

### 新增

- **导出 HTML 离线内嵌 three**（移除 CDN 依赖）：`src/export/vendor/` 打包 three r128 + OrbitControls，经 `?raw` 内联进导出文件，断网/内网可直接打开
- **导出视图「标」显示控制**：与编辑器行为对齐，尺寸标注（`dimGroup`）与层 ID 标签（`idGroup`）可分别切换显隐
- **物品 3D 模型统一双实现**：新增 `src/geometry/itemModel.ts`（`getItemPrimitives(type)` 共享图元描述），R3F 端 `<ItemModel>` 与导出端 `createItemMesh` 遍历同一描述渲染，两端视觉一致；删除旧的 `Computers/Cameras/Lighting/Controllers/Electronics.tsx` 双实现

### 工程化

- 清理 `@dnd-kit/*` 直接依赖（仅保留为 semi-ui 的传递依赖）；`postcss` 升级修复 1 个 high 级安全漏洞（`npm audit` 0 漏洞）
- ESLint 忽略 `src/export/vendor/**`（第三方压缩代码）
- 扩充几何单测：复杂连接（上连/下连/加强筋）、顶板立杆截断、无顶板顶部边框、工作台 1800×800×2000 六层 BOM 断言、导出结构验证（离线内嵌/「标」控制/DATA 几何注入）

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
