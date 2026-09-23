# VisionAI 3D Workbench

基于 **Semi Design + React Three Fiber** 的工业铝型材机架 3D 场景编辑器。用于设计含多层隔板/台面/顶底板结构的机架：可编辑铝型材骨架（带 T 型槽截面）、放置与变形 3D 物品、计算 BOM 切割清单，并导出独立运行的 HTML 视图。

## 功能

- **机架骨架**：整体长宽高、型材标准（GB/EU/JIS）与规格、六面立柱数量、底部框架模式、立柱截止层
- **层结构**：顶板 / 台面 / 隔板（可多个）/ 底板，独立尺寸、标高、厚度、对齐、前端连接方式（延伸/上连/下连）、加强筋
- **物品系统**：19 种工业 3D 物品、7 个分类（工控机 / 笔记本 / 显示器 / 键盘 / 相机 / 光源 / 控制器 / 交换机 / UPS / 工具柜 / 包装箱等），模型由共享图元描述统一（`src/geometry/itemModel.ts`），网格化放置，支持缩放 / 旋转 / 翻转 / 删除
- **共享几何内核**：型材/层板/物品占位由 `src/geometry/` 单一实现，3D 场景、导出 HTML、BOM 三方消费同一数据，杜绝几何漂移
- **干涉与越界校验**：检测层板越界/超高、层间重叠、物品超出网格单元，顶栏角标 + 报告弹窗
- **场景数据**：撤销/重做（60 步 + Ctrl/Cmd+Z / Shift+Z / Y 快捷键）、自动草稿（localStorage，500ms 防抖）、保存/加载 `.json` 工程文件
- **网格重排物品重映射 + 复制层**：改布局自动清理越界物品、台面/隔板可一键复制
- **导出前校验拦截**：存在错误级问题时弹确认；首屏空状态引导设计流程
- **BOM 切割清单**：从参数层计算型材下料清单（规格×长度×数量）与板材清单（相同板材自动合并为 × N），导出 CSV 或可打印 HTML 报告
- **采购直达**：清单每行给出「怡合达 / 米思米 / 1688 / 淘宝」的搜索深链（关键词 = 规格 + 长度/尺寸），一键「复制采购清单」可整段贴给供应商询价。⚠️ 仅搜索直达，**不接任何下单接口**（这类平台的正式对接需商家资质），价格与货期以平台为准
- **导出**：生成自包含 HTML（**离线内嵌 three r128，断网可打开**，含「标」显示控制），可独立打开浏览
- **可安装 / 离线可用（PWA）**：可安装到 PC 桌面或手机主屏，装好后**断网也能打开**（现场/内网常用），长按图标还有「导出 BOM 切割清单」快捷方式
- **中英文双语界面**：顶栏一键切换（首次按浏览器语言自动判断，选择记在本地）。界面语言**只影响显示**：工程文件、BOM、导出快照里的层板标签是语言中立的数据，切语言不会改写你的工程。⚠️ 采购关键词始终是中文 —— 1688/淘宝/怡合达/米思米都是中文站点，英文关键词搜不到货

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 开发服务器 (默认 http://localhost:5173)
```

## 一键部署

项目是**纯前端 SPA（无后端、无数据库）**，一条命令即可跑起来：

```bash
docker compose up -d --build    # 构建并启动，访问 http://localhost:5173
```

停止：`docker compose down`。数据（工程文件 + 自动草稿）全部存在**访问者浏览器**里，容器无状态，重建/升级/换机器都不丢。

### 没有 Docker？两种轻量方式

```bash
# 1) 开发模式（改代码即时热更新）
npm install && npm run dev          # http://localhost:5173

# 2) 只跑构建产物（任何静态服务器都行）
npm install && npm run build        # 产出 dist/
npx serve dist                      # 或 nginx / python3 -m http.server
```

> ⚠️ 构建产物**必须由 HTTP 服务托管**（直接双击 `dist/index.html` 用 `file://` 打开会因 ES 模块跨域策略失败）。

## 安装到桌面（PWA / 离线使用）

部署好之后，用浏览器打开一次，就能把它当本地应用用 —— **断网也能打开**（实测：把 nginx 容器整个停掉后仍可正常打开、改设计、导出报告）。

| 平台 | 安装方式 |
|------|----------|
| Chrome / Edge（PC） | 地址栏右侧的「安装」图标，或应用内顶栏的 ▦ 按钮（浏览器判定"可安装"后自动出现） |
| Android Chrome | 右上角菜单 → 「安装应用」/「添加到主屏幕」 |
| iOS Safari | 分享 → 「添加到主屏幕」（iOS **不会**触发应用内安装入口，只能走这条路） |
| iPad Safari | 同上 |

安装后会新增：独立窗口（无浏览器地址栏）、主屏图标、离线启动、以及长按图标的「导出 BOM 切割清单」快捷方式。

> ⚠️ **PWA 需要安全上下文（HTTPS 或 localhost）**。用 `http://<局域网IP>:5173` 这种纯 HTTP 方式访问时，浏览器**不会**注册 Service Worker —— 应用照常能用，但没有"离线打开 / 安装到桌面"。要给同事用，请配 HTTPS（nginx 加证书，或用带 TLS 的反向代理）。

离线能力由 `public/sw.js` 提供（手写，无第三方依赖，约 120 行）：导航请求网络优先、带哈希的 `/assets/` 缓存优先、其余同源资源缓存优先；只拦截同源 GET，跨域（采购平台链接等）完全不碰。

### Docker 细节

`Dockerfile` 采用**多阶段构建**（node:22 构建 → nginx:1.27 静态托管），产物约几十 MB，断网可运行。

启动后访问 **http://localhost:5173**（局域网内用本机 IP 访问；如端口冲突，改 `docker-compose.yml` 左侧端口号）。停止/重建：

```bash
docker compose down            # 停止并移除容器
docker compose up -d --build   # 改动后重建并重启
```

部署要点：
- **静态托管**：nginx 配置（`nginx.conf`）含 SPA 回退、`/assets/` 永久缓存、`index.html` 不缓存、gzip 压缩（实测主 JS 1.88 MB → 527 KB、CSS 236 KB → 27 KB；导出模块 655 KB 为按需加载的独立 chunk，不影响首屏）
- **数据持久化在浏览器端**：工程文件下载/导入与 localStorage 草稿均存于客户端，容器无状态，重建/升级不丢数据
- **健康检查**：容器内置 `HEALTHCHECK`，`docker compose ps` 显示 `healthy` 即正常
- 构建产物（`dist/`）与 `node_modules` 已通过 `.dockerignore` 排除，不进构建上下文

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | TypeScript 检查 + 生产构建到 `dist/` |
| `npm run preview` | 预览构建产物 |
| `npm run lint` | ESLint 静态检查 |
| `npm run test` | vitest 单元测试（几何内核核心逻辑） |
| `npm run check` | **质量门**：lint + tsc + vitest + build，提交/改动前必跑 |

## 技术栈

- **构建**：Vite 8 + TypeScript 6
- **前端**：React 19
- **3D**：@react-three/fiber + @react-three/drei + Three.js
- **UI**：@douyinfe/semi-ui

## 项目结构

```
├── Dockerfile                 # 多阶段构建：node 构建 → nginx 托管
├── docker-compose.yml         # 一键部署（宿主机 5173 → 容器 80）
├── nginx.conf                 # SPA 回退 / 缓存 / gzip
├── .dockerignore              # 排除 node_modules 与 dist
└── src/
    ├── App.tsx                     # 状态管理 + 撤销栈 + 持久化 + 顶栏
    ├── state.ts                    # AppState 类型与工程文件校验
    ├── components/
    │   ├── SceneView.tsx           # 3D 场景渲染（消费共享几何内核）
    │   ├── CameraController.tsx    # 视角动画
    │   ├── MiniCube.tsx            # 浮动工具栏
    │   ├── LeftPanel.tsx           # 左侧面板（尺寸/骨架/层/型材）
    │   ├── LayerEditor.tsx         # 右侧面板（层参数）
    │   ├── BottomBarTable.tsx      # 底栏层参数表格
    │   ├── threeTypes.ts           # R3F controls 最小类型
    │   └── items/                  # 物品元数据 + 3D 模型 + 缩略图
    ├── geometry/                   # 共享几何内核（型材/板材/物品占位/BOM/校验）
    └── utils/
        ├── bom.ts                  # BOM 聚合与 CSV/HTML 导出（委托内核）
        └── exportHtml.ts           # 自包含 HTML 导出（消费内核几何）
```

详细架构说明见 [CLAUDE.md](CLAUDE.md)。

## 单元/单位约定

- 代码内尺寸单位为**米**（UI 输入与 BOM 显示为 mm）
- 物品 `size` 轴顺序：`[长(X), 宽(Z), 高(Y)]`
- 几何算法统一在 `src/geometry/`（SceneView / exportHtml / bom 三端消费同一数据）

## 测试

- `npm run test`：vitest 单测覆盖共享内核（BOM 聚合、标高截断、物品占位、干涉校验），见 `src/geometry/__tests__/`
- 手工回归参考根目录：`ROBUSTNESS_TEST_REPORT.md`、`WORKBENCH_SCENARIO_TEST.md`

## 授权协议 / License

本项目采用 **[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh)**
（知识共享 署名-非商业性使用-相同方式共享 4.0 国际）许可协议，完整法律文本见 [LICENSE](LICENSE)。

- ✅ 允许：个人学习、内部评估、非商业性的一键部署与二次开发
- 📌 条件：**署名**（保留版权声明与许可标识）、**非商业性使用**、**相同方式共享**（衍生作品沿用同一协议）
- 💼 **商业使用需另行授权**：如需用于商业产品、商业服务或对外销售，请联系版权所有者取得书面商业许可
- ⚠️ 提醒：CC 系列协议为内容/作品设计，**并非软件专用协议**（不含专利授权等条款）。如果你的目标是
  "代码可被商业使用、但要求衍生开源"，更适合 AGPL-3.0；如果目标是"源码可见但禁止商用"，
  PolyForm Noncommercial 1.0.0 或 BUSL-1.1 在软件场景下的条款更完备
- ⚠️ 发布前请把 [LICENSE](LICENSE) 首行的 `<请替换为你的真实姓名或公司名>` 换成你的真实署名

## 三端适配（PC / 平板 / 手机）

界面按视口宽度自动适配，无需手动切换：

| 视口 | 布局行为 |
| --- | --- |
| ≥ 900px（PC） | 左右侧栏常驻，3D 视口自动避让两侧栏与底栏 |
| < 900px（手机 / 竖屏平板） | 侧栏变为**抽屉式覆盖**：默认收起，点边缘箭头展开，点空白处或再点箭头收起；3D 视口占满宽度；顶栏精简为图标并把 BOM / 校验 / 物品库 / 导出 收进「更多」菜单 |

触摸屏上 3D 视图支持单指旋转、双指缩放（OrbitControls 原生支持）。

## 界面语言（中文 / English）

顶栏地球/`EN` 按钮一键切换，选择写入 `localStorage` 的 `visionai-workbench-locale`；首次访问按浏览器语言判断（`zh*` → 中文，其它 → English）。

实现约定（改文案时请遵守）：

- 文案表在 `src/i18n/messages.ts`：`zh` 为准（`as const`），`en` 声明为 `Record<MessageKey, string>` —— **少一个键 `tsc` 就会报错**，不会出现"英文界面里漏出一句中文"。
- 非 React 模块（几何校验 `validate`、BOM 的 `bomToCsv`/`bomToHtml`、导出 `generateExportHtml`、采购文本）用**显式 `locale` 参数**（默认 `'zh'`，既有调用与单测行为不变）。
- 几何内核生成的层板标签（`顶板 / 台面 / 隔板 #N / 底板`）和 `自定义` 规格是**数据**，只在显示层翻译（`src/i18n/labels.ts` 的 `localizeLayerLabel` / `localizeProfileSpec`）—— 这样切语言不会污染工程文件与导出数据。
- Semi 组件库自身的文案（表格「暂无数据」等）由 `LocaleProvider` 跟随切换（`src/main.tsx`）。

## 变更记录

见 [CHANGELOG.md](CHANGELOG.md)。
