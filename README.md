# VisionAI 3D Workbench

基于 **Semi Design + React Three Fiber** 的工业铝型材机架 3D 场景编辑器。用于设计含多层隔板/台面/顶底板结构的机架：可编辑铝型材骨架（带 T 型槽截面）、放置与变形 3D 物品、计算 BOM 切割清单，并导出独立运行的 HTML 视图。

## 功能

- **机架骨架**：整体长宽高、型材标准（GB/EU/JIS）与规格、六面立柱数量、底部框架模式、立柱截止层
- **层结构**：顶板 / 台面 / 隔板（可多个）/ 底板，独立尺寸、标高、厚度、对齐、前端连接方式（延伸/上连/下连）、加强筋
- **物品系统**：14 种工业 3D 物品（工控机、相机、光源、控制器等），网格化放置，支持缩放 / 旋转 / 翻转 / 删除
- **场景数据**：撤销/重做（60 步）、自动草稿（localStorage，500ms 防抖）、保存/加载 `.json` 工程文件
- **BOM 切割清单**：从参数层计算型材下料清单（规格×长度×数量）与板材清单，导出 CSV 或可打印 HTML 报告
- **导出**：生成自包含 HTML（内嵌 Three.js），可独立打开浏览

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 开发服务器 (默认 http://localhost:5173)
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | TypeScript 检查 + 生产构建到 `dist/` |
| `npm run preview` | 预览构建产物 |
| `npm run lint` | ESLint 静态检查 |
| `npm run check` | **质量门**：lint + tsc + build，提交/改动前必跑 |

## 技术栈

- **构建**：Vite 8 + TypeScript 6
- **前端**：React 19
- **3D**：@react-three/fiber + @react-three/drei + Three.js
- **UI**：@douyinfe/semi-ui

## 项目结构

```
src/
├── App.tsx                     # 状态管理 + 撤销栈 + 持久化 + 顶栏
├── state.ts                    # AppState 类型与工程文件校验
├── components/
│   ├── SceneView.tsx           # 3D 场景渲染（铝型材/层板/物品/标注）
│   ├── CameraController.tsx    # 视角动画
│   ├── MiniCube.tsx            # 浮动工具栏
│   ├── LeftPanel.tsx           # 左侧面板（尺寸/骨架/层/型材）
│   ├── LayerEditor.tsx         # 右侧面板（层参数）
│   ├── BottomBarTable.tsx      # 底栏层参数表格
│   ├── threeTypes.ts           # R3F controls 最小类型
│   └── items/                  # 物品元数据 + 3D 模型 + 缩略图
└── utils/
    ├── bom.ts                  # BOM/切割清单计算与 CSV/HTML 导出
    └── exportHtml.ts           # 自包含 HTML 导出
```

详细架构说明见 [CLAUDE.md](CLAUDE.md)。

## 单元/单位约定

- 代码内尺寸单位为**米**（UI 输入与 BOM 显示为 mm）
- 物品 `size` 轴顺序：`[长(X), 宽(Z), 高(Y)]`
- 几何算法有三份实现：`SceneView.tsx`（3D 场景）、`exportHtml.ts`（导出 HTML）、`bom.ts`（BOM），改动需同步

## 测试

项目暂无自动化测试框架；质量门为 `npm run check`。手工回归参考根目录：

- `ROBUSTNESS_TEST_REPORT.md` — 60+ 项健壮性用例
- `WORKBENCH_SCENARIO_TEST.md` — 真实工作台设计场景流程

## 变更记录

见 [CHANGELOG.md](CHANGELOG.md)。
