import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button, Tooltip, Layout, Nav, Modal, Toast, Dropdown } from '@douyinfe/semi-ui';
const { Header } = Layout;
import {
  IconAlertTriangle,
  IconApps,
  IconBox,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconDownload,
  IconList,
  IconMore,
  IconPlus,
  IconRedo,
  IconSave,
  IconSetting,
  IconUndo,
  IconUpload,
} from '@douyinfe/semi-icons';
import SceneView from './components/SceneView';
import { useI18n, useT } from './i18n';
import { localizeLayerLabel } from './i18n/labels';

/**
 * `beforeinstallprompt` 的事件类型（lib.dom 未内置）。
 * 只声明用得到的两个成员，避免 as any 逃逸。
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
import PresetViewButtons from './components/MiniCube';
import LeftPanel, { Layer } from './components/LeftPanel';
import BottomBarTable from './components/BottomBarTable';
import LayerEditor from './components/LayerEditor';

import { computeBomFromGeometry, bomToCsv, bomToHtml } from './utils/bom';
import { buildSceneGeometry, shelfIndex, validateGeometry } from './geometry';
import { ITEM_REGISTRY, ITEMS_BY_CATEGORY, categoryName, itemName } from './components/items';
import type { ItemCategory } from './components/items';
import type { ItemType } from './components/items';
import ItemThumbnail, { preloadThumbnails } from './components/items/ItemThumbnail';
import { DEFAULT_STATE, normalizeAppState } from './state';
import type { AppState, ColumnsState } from './state';
import { applyDimensionChange } from './geometry/dimension';
import { parseLayout, remapPlacedItems, swapLayerElevations } from './geometry/operations';
import { aggregateBoards } from './geometry';
import {
  boardProcurementLinks,
  procurementText,
  profileProcurementLinks,
  type ProcurementLink,
} from './utils/procurement';

// 模块级 — 存储高度截断前各层原始标高，跨渲染持久化
const _cappedElev = new Map<string, number>();
let _lastHeight = 1600;

/**
 * 重置高度基线。加载工程文件 / 新建 / 恢复草稿后必须调用：
 * `_lastHeight` 与 `_cappedElev` 是跨渲染的模块级状态，若沿用上一个场景的基线，
 * 首次改高度会走错 `applyDimensionChange` 分支（顶板不跟随、层被误记入 capped）。
 */
function resetHeightBaseline(height: number) {
  _lastHeight = height;
  _cappedElev.clear();
}

// 撤销历史上限与自动草稿 key
const MAX_HISTORY = 60;
const SAVE_KEY = 'visionai-workbench-draft-v1';

const Logo: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="24" height="24" rx="6" stroke="#4f8cff" strokeWidth="2.5" fill="none" />
    <path d="M8 14 L12 10 L16 14 L12 18 Z" fill="#4f8cff" opacity="0.7" />
    <circle cx="20" cy="8" r="2.5" fill="#4f8cff" opacity="0.9" />
  </svg>
);

/** 左右浮动侧栏宽度（px）：3D 视口、浮动工具条与底栏都要据此避让，改宽度只改这里 */
const LEFT_PANEL_W = 300;
const RIGHT_PANEL_W = 260;

const App: React.FC = () => {
  // ── UI 状态（不参与撤销） ──
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  /** 底栏实测高度（px）：3D 视口要避开它，否则机架底部会被底栏盖住 */
  const [bottomBarH, setBottomBarH] = useState(0);
  const bottomBarRef = useRef<HTMLDivElement | null>(null);
  const [rightTab, setRightTab] = useState<'properties' | 'resources'>('properties');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<ItemType | null>(null);
  const [selectedPlacedItem, setSelectedPlacedItem] = useState<{ layerId: string; col: number; row: number } | null>(null);
  const [pendingTransform, setPendingTransform] = useState({ rotation: 0, scale: 1, flipX: false, flipY: false });
  // 界面语言（useT 必须在其它 hook 之前声明：有更早的 hook 依赖它）
  const t = useT();
  const { locale, setLocale } = useI18n();

  // ── PWA 安装（Chrome/Edge/Android 会派发 beforeinstallprompt；iOS Safari 不派发，需手动「添加到主屏幕」）──
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // 阻止浏览器自带的迷您横幅，改由应用内入口触发
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvt(null);
      Toast.success(t('toast.installed'));
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [t]);

  /**
   * manifest 的快捷方式（长按主屏图标 → 「导出 BOM 切割清单」）会带 ?action=bom 打开应用。
   * 处理完立刻用 replaceState 清掉参数，避免刷新时反复弹窗。
   */
  useEffect(() => {
    const action = new URLSearchParams(window.location.search).get('action');
    if (!action) return;
    if (action === 'bom') setBomOpen(true);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const [bomOpen, setBomOpen] = useState(false);
  /** 剪贴板不可用时，退化为可手动复制的采购清单弹窗 */
  const [procureTextOpen, setProcureTextOpen] = useState<string | null>(null);
  const [validateOpen, setValidateOpen] = useState(false);
  const dragIdRef = useRef<string | null>(null);
  const dragOverRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 底栏是浮动覆盖层，而 3D 画布原本铺满整个主区域 —— 机架底部（底板/底框）会被底栏挡住。
   * 这里实测底栏高度并把 3D 视口收到它上方：相机以「可见区域」为中心取景，模型不再被遮挡。
   */
  useEffect(() => {
    const el = bottomBarRef.current;
    if (!el) {
      setBottomBarH(0);
      return;
    }
    const sync = () => setBottomBarH(el.offsetHeight);
    sync();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bottomCollapsed]);

  // ── 响应式：窄屏（手机 / 竖屏平板）下侧栏改为「抽屉式覆盖」，不再挤压 3D 视口 ──
  // 未处理前实测 390×844 手机上画布只剩 90×595 px（左 300 + 右 260 的内缩把宽度吃光）。
  const [viewportW, setViewportW] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  /** 窄屏断点：900px 以下（手机横竖屏、平板竖屏） */
  const isNarrow = viewportW < 900;
  // 首次进入窄屏时收起两侧栏，否则一打开就被面板盖住半个屏幕
  const narrowInitRef = useRef(false);
  useEffect(() => {
    if (!isNarrow || narrowInitRef.current) return;
    narrowInitRef.current = true;
    setLeftCollapsed(true);
    setRightCollapsed(true);
  }, [isNarrow]);

  // 3D 视口内缩量：窄屏下始终为 0（面板浮在 3D 之上，不改变画布尺寸），宽屏保持原有"内缩避让"
  const insetLeft = isNarrow || leftCollapsed ? 0 : LEFT_PANEL_W;
  const insetRight = isNarrow || rightCollapsed ? 0 : RIGHT_PANEL_W;
  // 面板宽度：窄屏取视口 88%（上限 340px），留出后面 3D 的可见区域
  const leftPanelW = isNarrow ? Math.min(340, Math.round(viewportW * 0.88)) : LEFT_PANEL_W;
  const rightPanelW = isNarrow ? Math.min(340, Math.round(viewportW * 0.88)) : RIGHT_PANEL_W;
  const closeDrawers = useCallback(() => {
    setLeftCollapsed(true);
    setRightCollapsed(true);
  }, []);

  // ── 场景数据（可撤销/持久化） ──
  const [appState, setAppState] = useState<AppState>(DEFAULT_STATE);
  const stateRef = useRef<AppState>(DEFAULT_STATE);
  const historyRef = useRef<AppState[]>([]);
  const futureRef = useRef<AppState[]>([]);
  const skipRecordRef = useRef(false);
  // 历史版本号：驱动撤销/重做按钮的 disabled 刷新
  const [, setHistVer] = useState(0);

  // 记录历史：任何 appState 引用变化（且未被 skip 标记）压入撤销栈
  useEffect(() => {
    setHistVer((v) => v + 1);
    const prev = stateRef.current;
    if (prev === appState) return;
    if (skipRecordRef.current) {
      skipRecordRef.current = false;
      stateRef.current = appState;
      return;
    }
    historyRef.current.push(prev);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    futureRef.current = [];
    stateRef.current = appState;
  }, [appState]);

  // 启动时恢复自动草稿
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const norm = normalizeAppState(JSON.parse(raw));
        if (norm) {
          skipRecordRef.current = true;
          resetHeightBaseline(norm.state.dimensions.height);
          setAppState(norm.state);
          Toast.success(
            norm.droppedLayers > 0
              ? t('toast.draftRestoredDropped', { n: norm.droppedLayers })
              : t('toast.draftRestored')
          );
        }
      }
    } catch {
      /* 草稿损坏则忽略 */
    }
  }, [t]);

  // 自动保存草稿（防抖 500ms）
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(appState));
      } catch {
        /* 存储空间不足则静默忽略 */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [appState]);

  // 空闲时预生成物品缩略图
  useEffect(() => { preloadThumbnails(); }, []);

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    futureRef.current.push(stateRef.current);
    skipRecordRef.current = true;
    setAppState(prev);
    setHistVer((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push(stateRef.current);
    skipRecordRef.current = true;
    setAppState(next);
    setHistVer((v) => v + 1);
  }, []);

  // 撤销/重做快捷键：Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z、Ctrl+Y
  // 输入框聚焦时不触发，避免干扰文字编辑
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const handleSave = useCallback(() => {
    const blob = new Blob([JSON.stringify(stateRef.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workbench-project.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleLoadFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const norm = normalizeAppState(JSON.parse(reader.result as string));
        if (!norm) {
          Toast.error(t('toast.badFile'));
          return;
        }
        historyRef.current.push(stateRef.current);
        futureRef.current = [];
        skipRecordRef.current = true;
        resetHeightBaseline(norm.state.dimensions.height);
        setAppState(norm.state);
        Toast.success(
          norm.droppedLayers > 0
            ? t('toast.projectLoadedDropped', { n: norm.droppedLayers })
            : t('toast.projectLoaded')
        );
      } catch {
        Toast.error(t('toast.parseFailed'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [t]);

  const handleNew = useCallback(() => {
    // 与其他破坏性操作保持一致用 Modal.confirm：原生 window.confirm 会阻塞整个页面
    // （3D 停止响应、样式与产品脱节），且在部分内嵌/移动端环境会被静默拦截
    const doReset = () => {
      localStorage.removeItem(SAVE_KEY);
      historyRef.current = [];
      futureRef.current = [];
      skipRecordRef.current = true;
      resetHeightBaseline(DEFAULT_STATE.dimensions.height);
      setAppState(DEFAULT_STATE);
      setHistVer((v) => v + 1);
    };
    Modal.confirm({
      title: t('confirm.newTitle'),
      content: t('confirm.newContent'),
      okText: t('confirm.newOk'),
      cancelText: t('common.cancel'),
      onOk: doReset,
    });
  }, [t]);

  /** 所有层按标高降序排列，保证层参数、层结构、3D 场景顺序一致 */
  const sortedLayers = useMemo(
    () => [...appState.layers].sort((a, b) => b.detail.elevation - a.detail.elevation),
    [appState.layers]
  );

  /**
   * 共享几何内核：**每次状态变更只算一次**，BOM / 校验 / 3D 场景 / 导出共用同一份实例。
   * 此前三处各算一遍全量几何，大场景下每次拖拽或改参数都要多算两次。
   */
  const sceneGeometry = useMemo(
    () =>
      buildSceneGeometry({
        dimensions: appState.dimensions,
        profile: appState.profile,
        columns: appState.columns,
        layers: sortedLayers,
      }),
    [appState.dimensions, appState.profile, appState.columns, sortedLayers]
  );

  // BOM 清单（复用同一份几何）
  const bom = useMemo(() => computeBomFromGeometry(sceneGeometry), [sceneGeometry]);
  // 干涉/越界校验（复用同一份几何）
  const issues = useMemo(() => validateGeometry(appState, sceneGeometry, locale), [appState, sceneGeometry, locale]);
  const issueCount = issues.length;
  /** 采购清单文本（可直接贴给供应商询价） */
  const procureText = useMemo(
    () => procurementText({ profiles: bom.profiles, boards: aggregateBoards(bom.boards) }, locale),
    [bom, locale]
  );
  /** 板材清单显示用：合并相同板材（一块一行对采购无意义），不改 bom.boards 本身 */
  const boardRows = useMemo(() => aggregateBoards(bom.boards), [bom]);
  const handleCopyProcurement = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(procureText);
      Toast.success(t('toast.procureCopied'));
    } catch {
      // 无剪贴板权限（非安全上下文 / 浏览器策略）时退化为弹窗手动复制，不静默失败
      setProcureTextOpen(procureText);
    }
  }, [procureText, t]);

  const handleDownloadCsv = useCallback(() => {
    const blob = new Blob([bomToCsv(bom, locale)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workbench-bom.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [bom, locale]);
  const handleDownloadHtml = useCallback(() => {
    const blob = new Blob([bomToHtml(bom, appState, locale)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workbench-bom.html';
    a.click();
    URL.revokeObjectURL(url);
  }, [bom, appState, locale]);

  /**
   * 导出 HTML：先校验，error 级问题时弹确认。
   *
   * 导出模块内嵌了离线版 three r128（约 600KB 源码），因此按需加载 —— 不进首屏主包。
   * 首次点击需等一下 chunk 下载，之后走模块缓存；鼠标悬停时已预取。
   */
  const doExport = useCallback(async () => {
    try {
      const { generateExportHtml } = await import('./utils/exportHtml');
      const html = generateExportHtml(
        {
          dimensions: appState.dimensions,
          profile: appState.profile,
          columns: appState.columns,
          layers: sortedLayers,
        },
        sceneGeometry,
        locale
      );
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '3d-workbench-export.html';
      a.click();
      URL.revokeObjectURL(url);
      // 成功也给回执：部分浏览器/内嵌 webview 会静默拦截下载，用户无从判断是否导出成功
      Toast.success(t('toast.exported', { kb: Math.round(blob.size / 1024) }));
    } catch (err) {
      Toast.error(t('toast.exportFailed', { msg: err instanceof Error ? err.message : String(err) }));
    }
  }, [appState, sortedLayers, sceneGeometry, t, locale]);

  /** 悬停即预取导出 chunk，点击导出时无需等待加载 */
  const prefetchExport = useCallback(() => {
    void import('./utils/exportHtml');
  }, []);

  const handleExportClick = useCallback(() => {
    const errors = issues.filter((i) => i.severity === 'error').length;
    if (errors === 0) {
      void doExport();
      return;
    }
    Modal.confirm({
      title: t('confirm.exportTitle'),
      content: t('confirm.exportContent', { n: errors }),
      okText: t('confirm.exportOk'),
      cancelText: t('common.cancel'),
      onOk: () => doExport(),
    });
  }, [issues, doExport, t]);

  /** 安装为桌面应用（仅在浏览器认为"可安装"时入口才可见） */
  const handleInstall = useCallback(async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    const { outcome } = await installEvt.userChoice;
    if (outcome === 'accepted') {
      Toast.success(t('toast.installing'));
      setInstallEvt(null);
    } else {
      Toast.info(t('toast.installCancelled'));
    }
  }, [installEvt, t]);

  /** 统一更新 layers（兼容函数式更新），并自动进入撤销栈；无实际变化时不产生撤销步骤 */
  const updateLayers = useCallback((updater: Layer[] | ((prev: Layer[]) => Layer[])) => {
    setAppState((prev) => {
      const layers = typeof updater === 'function'
        ? (updater as (p: Layer[]) => Layer[])(prev.layers)
        : updater;
      // 引用未变 → 状态未变：返回原对象，避免污染撤销栈（拖拽落空等场景）
      if (layers === prev.layers) return prev;
      return { ...prev, layers };
    });
  }, []);

  const handleDetailChange = useCallback((id: string, field: string, value: number) => {
    updateLayers((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, detail: { ...l.detail, [field]: value } } : l
      )
    );
  }, [updateLayers]);

  const handleLayoutChange = useCallback((id: string, layout: string) => {
    updateLayers((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        // 布局变更时重映射物品：越界物品移除，界内保留
        const newLayout = parseLayout(layout);
        const placedItems = newLayout
          ? remapPlacedItems(l, newLayout[0], newLayout[1]).items
          : []; // 清空布局 → 移除全部物品
        return { ...l, detail: { ...l.detail, layout, placedItems } };
      })
    );
  }, [updateLayers]);

  const handleLayerPropChange = useCallback((id: string, field: string, value: unknown) => {
    updateLayers((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, detail: { ...l.detail, [field]: value } as Layer['detail'] } : l
      )
    );
  }, [updateLayers]);

  const handleDragStart = useCallback((id: string) => {
    dragIdRef.current = id;
  }, []);

  const handleDragOver = useCallback((targetId: string) => {
    const activeId = dragIdRef.current;
    if (!activeId || activeId === targetId) return;
    if (dragOverRef.current === targetId) return; // 同一目标不重复交换
    dragOverRef.current = targetId;
    // 纯函数交换标高：不原地修改层对象（见 operations.swapLayerElevations 注释）
    updateLayers((prev) => swapLayerElevations(prev, activeId, targetId));
  }, [updateLayers]);

  const handleDragEnd = useCallback(() => {
    dragIdRef.current = null;
    dragOverRef.current = null;
  }, []);

  /** 触摸端替代方案：HTML5 拖拽在触摸屏不触发，用上/下移按钮与相邻（同类型可排序的）层交换标高 */
  const handleMoveLayer = useCallback(
    (id: string, dir: -1 | 1) => {
      const movable = (t: string) => t === 'countertop' || t === 'shelf';
      updateLayers((prev) => {
        // 按标高降序（与底栏显示顺序一致），跨过不可排序的层（顶板/底板）找相邻目标
        const order = [...prev].sort((a, b) => b.detail.elevation - a.detail.elevation);
        const idx = order.findIndex((l) => l.id === id);
        if (idx < 0 || !movable(order[idx].type)) return prev;
        let j = idx + dir;
        while (j >= 0 && j < order.length && !movable(order[j].type)) j += dir;
        if (j < 0 || j >= order.length) return prev;
        return swapLayerElevations(prev, id, order[j].id);
      });
    },
    [updateLayers]
  );

  const handleLockToggle = useCallback((id: string) => {
    setAppState((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => {
        if (l.id !== id) return l;
        const locked = !l.detail.locked;
        return {
          ...l,
          detail: {
            ...l.detail,
            locked,
            // 锁定时同步当前整体尺寸
            ...(locked ? { length: prev.dimensions.width, width: prev.dimensions.depth } : {}),
          },
        };
      }),
    }));
  }, []);

  // 当整体尺寸变化时，同步已锁定层的长宽；处理标高截断与恢复
  const handleDimensionsChange = useCallback(
    (value: AppState['dimensions'] | ((prev: AppState['dimensions']) => AppState['dimensions'])) => {
      setAppState((prev) => {
        const next = typeof value === 'function'
          ? (value as (d: AppState['dimensions']) => AppState['dimensions'])(prev.dimensions)
          : value;
        const oldH = _lastHeight;
        const newH = next.height;
        _lastHeight = newH;
        // 高度基线用 _lastHeight（截断状态机的基准，可能与 prev.dimensions 不同），长/宽取上一版尺寸
        const nextLayers = applyDimensionChange(prev.layers, { ...prev.dimensions, height: oldH }, next, _cappedElev);
        return { ...prev, dimensions: next, layers: nextLayers };
      });
    },
    []
  );

  // 在层板的布局方块中放置/删除物品
  const handlePlaceItem = useCallback(
    (layerId: string, col: number, row: number, itemType: ItemType | null) => {
      // 放置后直接选中新物品：变形浮窗（缩放/旋转/翻转/删除）随即出现，用户不必再点一次
      // 删除（itemType 为 null）则清空选中
      setSelectedPlacedItem(itemType ? { layerId, col, row } : null);
      setSelectedItemType(null);
      updateLayers((prev) =>
        prev.map((l) => {
          if (l.id !== layerId) return l;
          if (!itemType) {
            return {
              ...l,
              detail: {
                ...l.detail,
                placedItems: l.detail.placedItems.filter(
                  (p) => !(p.col === col && p.row === row)
                ),
              },
            };
          }
          const existing = l.detail.placedItems.findIndex(
            (p) => p.col === col && p.row === row
          );
          const newItem = {
            col, row, itemType,
            rotation: pendingTransform.rotation || 0,
            scale: pendingTransform.scale || 1,
            flipX: pendingTransform.flipX || false,
            flipY: pendingTransform.flipY || false,
          };
          if (existing >= 0) {
            const placedItems = [...l.detail.placedItems];
            placedItems[existing] = newItem;
            return { ...l, detail: { ...l.detail, placedItems } };
          }
          return {
            ...l,
            detail: {
              ...l.detail,
              placedItems: [...l.detail.placedItems, newItem],
            },
          };
        })
      );
    },
    [pendingTransform, updateLayers]
  );

  // 修改已放置物品的变形参数
  const handleTransformPlacedItem = useCallback(
    (layerId: string, col: number, row: number, field: string, value: unknown) => {
      updateLayers((prev) =>
        prev.map((l) =>
          l.id === layerId
            ? {
                ...l,
                detail: {
                  ...l.detail,
                  placedItems: l.detail.placedItems.map((p) =>
                    p.col === col && p.row === row ? { ...p, [field]: value } : p
                  ),
                },
              }
            : l
        )
      );
    },
    [updateLayers]
  );

  // 选择/取消选择已放置物品
  const handleSelectPlacedItem = useCallback(
    (layerId: string, col: number, row: number) => {
      setSelectedPlacedItem((prev) => {
        if (prev?.layerId === layerId && prev?.col === col && prev?.row === row) return null;
        setRightTab('resources');
        setRightCollapsed(false);
        return { layerId, col, row };
      });
    },
    []
  );

  /** 平台小链接（表格单元格内） */
  const renderProcureLinks = (links: ProcurementLink[]) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
      {links.map((l) => (
        <a
          key={l.name}
          href={l.url}
          target="_blank"
          rel="noreferrer noopener"
          style={{ color: 'var(--semi-color-link)', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          {l.name}
        </a>
      ))}
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶栏 */}
      <Header style={{ backgroundColor: 'var(--semi-color-bg-1)', borderBottom: '1px solid var(--semi-color-border)', flexShrink: 0 }}>
        <Nav mode="horizontal" defaultSelectedKeys={['Home']}>
          <Nav.Header>
            <Logo />
          </Nav.Header>
          {/* 窄屏隐藏标题与导航文字：实测 390px 下这 211px 会把「校验 / 物品库 / 导出」挤出视口（被 Nav 裁剪，点不到） */}
          {!isNarrow && (
            <span style={{ color: 'var(--semi-color-text-2)' }}>
              <span style={{ marginRight: '24px', color: 'var(--semi-color-text-0)', fontWeight: '600' }}>
                VisionAI 3D Workbench
              </span>
              {/* 这两个原来是纯装饰文字（点了没反应）—— 接成真实快捷入口：
                  「场景编辑」= 收起两侧栏进入全画布编辑；「资产管理」= 打开右侧物品库 */}
              <span
                role="button"
                tabIndex={0}
                aria-current={leftCollapsed && rightCollapsed ? 'page' : undefined}
                onClick={() => {
                  setLeftCollapsed(true);
                  setRightCollapsed(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setLeftCollapsed(true);
                    setRightCollapsed(true);
                  }
                }}
                style={{
                  marginRight: '24px',
                  cursor: 'pointer',
                  color: leftCollapsed && rightCollapsed ? 'var(--semi-color-primary)' : undefined,
                }}
              >
                {t('nav.sceneEdit')}
              </span>
              <span
                role="button"
                tabIndex={0}
                aria-current={!rightCollapsed && rightTab === 'resources' ? 'page' : undefined}
                onClick={() => {
                  setRightTab('resources');
                  setRightCollapsed(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setRightTab('resources');
                    setRightCollapsed(false);
                  }
                }}
                style={{
                  cursor: 'pointer',
                  color: !rightCollapsed && rightTab === 'resources' ? 'var(--semi-color-primary)' : undefined,
                }}
              >
                {t('nav.assets')}
              </span>
            </span>
          )}
          <Nav.Footer>
            {/* 场景工具：撤销/重做、保存/加载/新建、BOM 清单 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 12 }}>
              {/* 禁用态按钮不派发鼠标事件，Tooltip 必须挂在包裹元素上（同层结构里的添加按钮）——
                  否则历史为空时（新用户最需要知道快捷键的时候）气泡弹不出来 */}
              <Tooltip content={t('toolbar.undo')}>
                <span style={{ display: 'inline-flex' }}>
                  <Button theme="borderless" size="small" icon={<IconUndo size="small" />} onClick={undo} disabled={!canUndo} />
                </span>
              </Tooltip>
              <Tooltip content={t('toolbar.redo')}>
                <span style={{ display: 'inline-flex' }}>
                  <Button theme="borderless" size="small" icon={<IconRedo size="small" />} onClick={redo} disabled={!canRedo} />
                </span>
              </Tooltip>
              <div style={{ width: 1, height: 20, background: 'var(--semi-color-border)', margin: '0 4px' }} />
              <Tooltip content={t('toolbar.save')}>
                <Button theme="borderless" size="small" icon={<IconSave size="small" />} onClick={handleSave} />
              </Tooltip>
              <Tooltip content={t('toolbar.load')}>
                <Button theme="borderless" size="small" icon={<IconUpload size="small" />} onClick={() => fileInputRef.current?.click()} />
              </Tooltip>
              <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleLoadFile} />
              <Tooltip content={t('toolbar.new')}>
                <Button theme="borderless" size="small" icon={<IconPlus size="small" />} onClick={handleNew} />
              </Tooltip>
              {installEvt && (
                <Tooltip content={t('toolbar.install')}>
                  <Button theme="borderless" size="small" icon={<IconApps size="small" />} onClick={handleInstall} />
                </Tooltip>
              )}
              {/* 语言切换：只切换界面语言，不影响工程数据（数据本身与语言无关） */}
              <Tooltip content={t('toolbar.lang')}>
                <Button
                  theme="borderless"
                  size="small"
                  onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
                  style={{ fontSize: 12, fontWeight: 600, minWidth: 34 }}
                >
                  {locale === 'zh' ? 'EN' : '中'}
                </Button>
              </Tooltip>
              {/* 窄屏下「清单 / 校验」移入右侧「更多」菜单，给「导出」让出宽度 */}
              {!isNarrow && (
                <>
                  <div style={{ width: 1, height: 20, background: 'var(--semi-color-border)', margin: '0 4px' }} />
                  <Tooltip content={t('toolbar.bom')}>
                    <Button theme="borderless" size="small" icon={<IconList size="small" />} onClick={() => setBomOpen(true)} />
                  </Tooltip>
                  <Tooltip content={issueCount > 0 ? t('toolbar.validateIssues', { n: issueCount }) : t('toolbar.validateOk')}>
                    <Button
                      theme="borderless"
                      size="small"
                      onClick={() => setValidateOpen(true)}
                      style={{ position: 'relative', color: issueCount > 0 ? 'var(--semi-color-danger)' : 'var(--semi-color-text-2)' }}
                    >
                      <IconAlertTriangle size="small" />
                      {issueCount > 0 && (
                        <span style={{ position: 'absolute', top: -2, right: -4, background: '#e33', color: '#fff', borderRadius: 8, fontSize: 10, lineHeight: '14px', minWidth: 14, textAlign: 'center', padding: '0 3px' }}>
                          {issueCount}
                        </span>
                      )}
                    </Button>
                  </Tooltip>
                </>
              )}
            </div>
            {isNarrow ? (
              <Dropdown
                trigger="click"
                position="bottomRight"
                render={
                  <Dropdown.Menu>
                    <Dropdown.Item icon={<IconList size="small" />} onClick={() => setBomOpen(true)}>
                      {t('menu.bom')}
                    </Dropdown.Item>
                    <Dropdown.Item icon={<IconAlertTriangle size="small" />} onClick={() => setValidateOpen(true)}>
                      {issueCount > 0 ? t('menu.validateIssues', { n: issueCount }) : t('menu.validateOk')}
                    </Dropdown.Item>
                    <Dropdown.Item
                      icon={<IconBox size="small" />}
                      onClick={() => {
                        setRightTab('resources');
                        setRightCollapsed(false);
                      }}
                    >
                      {t('menu.library')}
                    </Dropdown.Item>
                    <Dropdown.Item icon={<IconDownload size="small" />} onClick={handleExportClick}>
                      {t('menu.exportHtml')}
                    </Dropdown.Item>
                    {installEvt && (
                      <Dropdown.Item icon={<IconApps size="small" />} onClick={handleInstall}>
                        {t('menu.install')}
                      </Dropdown.Item>
                    )}
                    <Dropdown.Item onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}>
                      {locale === 'zh' ? 'English' : '中文'}
                    </Dropdown.Item>
                  </Dropdown.Menu>
                }
              >
                <Button theme="borderless" size="small" icon={<IconMore size="small" />} />
              </Dropdown>
            ) : (
              <>
            <Tooltip content={t('toolbar.libraryTip')} position="bottom">
              <Button
                theme="borderless"
                icon={<IconBox size="large" />}
                style={{ color: 'var(--semi-color-text-2)', marginRight: '12px' }}
                onClick={() => {
                  setRightTab('resources');
                  setRightCollapsed(false);
                }}
              />
            </Tooltip>
            <Tooltip content={t('toolbar.export')} position="bottom">
              <Button
                theme="borderless"
                size="small"
                style={{ color: 'var(--semi-color-text-2)', fontSize: 13 }}
                onClick={handleExportClick}
                onMouseEnter={prefetchExport}
              >
                {t('toolbar.exportShort')}
              </Button>
            </Tooltip>
              </>
            )}
          </Nav.Footer>
        </Nav>
      </Header>

      {/* 3D 视图（始终占满剩余空间） */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: 'var(--semi-color-bg-0)', overflow: 'hidden', minHeight: 0 }}>
        <div style={{
          position: 'absolute', top: 0, bottom: bottomBarH,
          left: insetLeft,
          right: insetRight,
        }}>
          <SceneView dimensions={appState.dimensions} profile={appState.profile} layers={sortedLayers} geometry={sceneGeometry} selectedLayerId={selectedLayerId} selectedItemType={selectedItemType} selectedPlacedItem={selectedPlacedItem} onPlaceItem={handlePlaceItem} onSelectPlacedItem={handleSelectPlacedItem} onTransformPlacedItem={handleTransformPlacedItem} />
        </div>
        {/* 浮动视角工具条：与 3D 视口同宽，才能在可见区域内居中（而非按窗口居中） */}
        <div style={{
          position: 'absolute', top: 0,
          left: insetLeft,
          right: insetRight,
        }}>
          <PresetViewButtons />
        </div>

        {/* 首屏空状态引导 */}
        {appState.layers.length === 0 && (
          <div style={{
            position: 'absolute', top: 0, bottom: bottomBarH, pointerEvents: 'none', zIndex: 5,
            left: insetLeft,
            right: insetRight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ background: 'rgba(15,15,18,0.72)', color: '#fff', padding: '28px 36px', borderRadius: 14, textAlign: 'center', maxWidth: 460, backdropFilter: 'blur(4px)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{t('empty.title')}</div>
              <div style={{ fontSize: 13, lineHeight: 2, color: 'rgba(255,255,255,0.72)', textAlign: 'left' }}>
                {t('empty.step1a')}<b style={{ color: '#fff' }}>{t('empty.step1b')}</b><br />
                {t('empty.step2')}<br />
                {t('empty.step3')}<br />
                {t('empty.step4')}
              </div>
            </div>
          </div>
        )}

        {/* 窄屏抽屉遮罩：点空白处收起面板（面板本身 zIndex 50，遮罩 49 在它下面） */}
        {isNarrow && (!leftCollapsed || !rightCollapsed) && (
          <div onClick={closeDrawers} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 49 }} />
        )}

        {/* 左侧边栏（浮动覆盖）- 展开时显示面板 */}
        {!leftCollapsed && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: leftPanelW,
              backgroundColor: 'var(--semi-color-bg-1)',
              borderRight: '1px solid var(--semi-color-border)',
              overflow: 'hidden',
              transition: 'width 0.2s',
              zIndex: 50,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderBottom: '1px solid var(--semi-color-border)',
                minHeight: 44,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--semi-color-text-0)' }}>
                {t('panel.tools')}
              </span>
              <Tooltip content={t('panel.collapseLeft')}>
                <Button
                  theme="borderless"
                  icon={<IconChevronLeft size="small" />}
                  onClick={() => setLeftCollapsed(true)}
                  size="small"
                />
              </Tooltip>
            </div>
            <div style={{ height: 'calc(100% - 44px)', overflow: 'auto' }}>
              {/* ⚠️ key={locale} 是必需的：Semi 的 Select 会缓存挂载时的选项/占位文案，
                  运行时切语言不会重算（实测 zh→en 后「全高 / 全框连接 / 国标 (GB)」仍是中文），
                  换 key 强制重挂载才能跟上语言。 */}
              <LeftPanel
                key={locale}
                layers={sortedLayers}
                onLayersChange={updateLayers}
                dimensions={appState.dimensions}
                onDimensionsChange={handleDimensionsChange}
                profile={appState.profile}
                onProfileChange={(p) => setAppState((prev) => ({ ...prev, profile: p }))}
                columns={appState.columns}
                onColumnsChange={(updater) => setAppState((prev) => ({
                  ...prev,
                  columns: typeof updater === 'function' ? (updater as (c: ColumnsState) => ColumnsState)(prev.columns) : updater,
                }))}
                onLayerSelect={(id) => {
                  // 与底栏点选行完全一致：切到「层参数」并展开右侧面板
                  setSelectedLayerId(id);
                  setRightTab('properties');
                  if (id) setRightCollapsed(false);
                }}
              />
            </div>
          </div>
        )}

        {/* 左侧边栏收起浮动按钮 */}
        {leftCollapsed && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 9999,
            }}
          >
            <Tooltip content={t('panel.expandLeft')} position="right">
              <Button
                theme="solid"
                type="primary"
                icon={<IconChevronRight size="small" />}
                onClick={() => setLeftCollapsed(false)}
                style={{
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  borderTopRightRadius: 8,
                  borderBottomRightRadius: 8,
                  padding: '8px 6px',
                  minWidth: 28,
                  height: 48,
                }}
              />
            </Tooltip>
          </div>
        )}

        {/* 右侧边栏（浮动覆盖）- 展开时显示面板 */}
        {!rightCollapsed && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: rightPanelW,
              backgroundColor: 'var(--semi-color-bg-1)',
              borderLeft: '1px solid var(--semi-color-border)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
            }}
          >

            {/* 内容区域 */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--semi-color-border)',
                  flexShrink: 0,
                  minHeight: 44,
                  paddingLeft: 12,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--semi-color-text-0)' }}>
                  {rightTab === 'properties' ? t('panel.properties') : t('panel.resources')}
                </span>
                <div style={{ flex: 1 }} />
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {rightTab === 'properties' ? (
                  <LayerEditor
                    key={locale}
                    layer={appState.layers.find((l) => l.id === selectedLayerId) || null}
                    shelfNumber={(() => {
                      // 与底栏/3D 标签/导出共用内核同一编号
                      const l = appState.layers.find((x) => x.id === selectedLayerId);
                      return l ? shelfIndex(l, sortedLayers) || undefined : undefined;
                    })()}
                    dimensions={appState.dimensions}
                    profile={appState.profile}
                    onDetailChange={handleDetailChange}
                    onLayoutChange={handleLayoutChange}
                    onLockToggle={handleLockToggle}
                    onLayerPropChange={handleLayerPropChange}
                    onSwitchToItems={() => {
                      setRightTab('resources');
                      setRightCollapsed(false);
                      const layer = appState.layers.find((l) => l.id === selectedLayerId);
                      if (layer) {
                        const lx = layer.detail.length / 1000;
                        const lz = layer.detail.width / 1000;
                        const ly = layer.detail.elevation / 1000;
                        const maxDim = Math.max(lx, lz);
                        window.dispatchEvent(new CustomEvent('focus-camera', {
                          detail: { center: [lx / 2, ly + 0.01, lz / 2], distance: maxDim * 1.6 },
                        }));
                      }
                    }}
                  />
                ) : (
                  <div style={{ padding: '8px 12px', overflow: 'auto', height: '100%' }}>
                    {selectedItemType && (
                      <div style={{ fontSize: 12, color: 'var(--semi-color-primary)', background: 'var(--semi-color-primary-light-default)', borderRadius: 4, padding: '6px 8px', marginBottom: 10, textAlign: 'center' }}>
                        {t('hint.pickCell')}
                      </div>
                    )}
                    {(Object.entries(ITEMS_BY_CATEGORY) as [string, typeof ITEM_REGISTRY][]).map(([cat, items]) => (
                      <div key={cat} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--semi-color-text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                          {categoryName(cat as ItemCategory, locale)}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {items.map((item) => {
                            const isActive = selectedItemType === item.type;
                            return (
                              <div
                                key={item.type}
                                onClick={() => { setSelectedItemType(isActive ? null : item.type); setSelectedPlacedItem(null); setPendingTransform({ rotation: 0, scale: 1, flipX: false, flipY: false }); }}
                                style={{
                                  width: 'calc(50% - 3px)',
                                  padding: 8,
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  backgroundColor: isActive ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-fill-0)',
                                  border: isActive ? '1px solid var(--semi-color-primary)' : '1px solid transparent',
                                  transition: 'all 0.15s',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                                  <ItemThumbnail type={item.type} size={56} />
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--semi-color-text-0)', textAlign: 'center' }}>
                                  {itemName(item, locale)}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--semi-color-text-3)', textAlign: 'center' }}>
                                  {item.size.map((v) => `${(v * 1000).toFixed(0)}`).join('×')}mm
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 右侧标签栏（始终可见） */}
        <div
          style={{
            position: 'absolute',
            right: insetRight,
            top: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {([
            { key: 'properties', label: t('panel.properties'), icon: <IconSetting size="large" /> },
            { key: 'resources', label: t('panel.resources'), icon: <IconBox size="large" /> },
          ] as const).map((tab) => {
            const isActive = !rightCollapsed && rightTab === tab.key;
            return (
              <Tooltip key={tab.key} content={tab.label} position="left">
                <div
                  onClick={() => { setRightTab(tab.key); setRightCollapsed(false); }}
                  style={{
                    width: 36,
                    height: 36,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                    backgroundColor: isActive ? 'var(--semi-color-primary)' : 'transparent',
                    transition: 'background-color 0.2s',
                    userSelect: 'none',
                  }}
                >
                  {tab.icon}
                </div>
              </Tooltip>
            );
          })}
          <Tooltip content={rightCollapsed ? t('panel.expandRight') : t('panel.collapseRight')} position="left">
            <div
              onClick={() => setRightCollapsed(!rightCollapsed)}
              style={{
                width: isNarrow ? 44 : 36,
                height: isNarrow ? 44 : 36,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                color: 'rgba(255,255,255,0.7)',
                backgroundColor: 'transparent',
                userSelect: 'none',
              }}
            >
              {rightCollapsed ? <IconChevronLeft size="large" /> : <IconChevronRight size="large" />}
            </div>
          </Tooltip>
        </div>

        {/* 底栏（浮动覆盖，在左右侧栏之间，展示层参数表格） */}
        {!bottomCollapsed && (
          <div
            ref={bottomBarRef}
            style={{
              position: 'absolute',
              bottom: 0,
              left: insetLeft,
              right: insetRight,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 44,
              maxHeight: '25vh',
              color: 'var(--semi-color-text-2)',
              backgroundColor: 'rgba(var(--semi-grey-0), 1)',
              borderTop: '1px solid var(--semi-color-border)',
              zIndex: 50,
            }}
          >
            {/* 标题行 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 12px',
                borderBottom: '1px solid var(--semi-color-border)',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--semi-color-text-1)' }}>
                {t('panel.layerParams')}
              </span>
              <Tooltip content={t('panel.collapseBottom')}>
                <Button
                  theme="borderless"
                  icon={<IconChevronDown size="small" />}
                  onClick={() => setBottomCollapsed(true)}
                  size="small"
                />
              </Tooltip>
            </div>
            {/* 层表格 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px' }}>
              <BottomBarTable
                key={locale}
                layers={sortedLayers}
                selectedId={selectedLayerId}
                onSelect={(id) => { setSelectedLayerId(id); setRightTab('properties'); if (id) setRightCollapsed(false); }}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                compact={isNarrow}
                onMoveLayer={handleMoveLayer}
              />
            </div>
          </div>
        )}
      </div>

      {/* 底栏收起后的悬浮展开按钮 */}
      {bottomCollapsed && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
        >
          <Tooltip content={t('panel.expandBottom')}>
            <Button
              theme="solid"
              type="primary"
              icon={<IconChevronUp size="small" />}
              onClick={() => setBottomCollapsed(false)}
              style={{
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                padding: '4px 16px',
                height: 28,
              }}
            />
          </Tooltip>
        </div>
      )}

      {/* BOM 清单弹窗 */}
      <Modal
        title={t('toolbar.bom')}
        visible={bomOpen}
        onCancel={() => setBomOpen(false)}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%', flexWrap: 'wrap' }}>
            <Button onClick={handleCopyProcurement}>{t('bom.copyList')}</Button>
            <Button onClick={handleDownloadCsv}>{t('bom.downloadCsv')}</Button>
            <Button theme="solid" type="primary" onClick={handleDownloadHtml}>{t('bom.downloadHtml')}</Button>
          </div>
        }
        width={isNarrow ? '94vw' : 900}
      >
        <div style={{ maxHeight: '60vh', overflow: 'auto', fontSize: 12 }}>
          <div style={{ marginBottom: 12, color: 'var(--semi-color-text-2)', fontSize: 12 }}>
            {t('bom.summaryDims', { w: appState.dimensions.width, d: appState.dimensions.depth, h: appState.dimensions.height })}
            &nbsp;·&nbsp; {t('bom.summaryProfile', { spec: appState.profile[0] ? `${appState.profile[0]}-${appState.profile[1]}` : t('common.custom') })}
            &nbsp;·&nbsp; {t('bom.summaryLayers', { n: appState.layers.length })}
          </div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('bom.profilesTitle', { n: bom.totalProfileCount })}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'left', background: 'var(--semi-color-fill-0)' }}>{t('bom.colSpec')}</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>{t('bom.colLength')}</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>{t('bom.colCount')}</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>{t('bom.colTotal')}</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'left', background: 'var(--semi-color-fill-0)' }}>{t('bom.colBuy')}</th>
              </tr>
            </thead>
            <tbody>
              {bom.profiles.map((r, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px' }}>{r.spec}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>{r.length}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>{r.count}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>{r.count * r.length}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px' }}>
                    {renderProcureLinks(profileProcurementLinks(r.spec, r.length, locale))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('bom.boardsTitle', { total: bom.boards.length, rows: boardRows.length })}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'left', background: 'var(--semi-color-fill-0)' }}>{t('bom.colName')}</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>{t('bom.colLength')}</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>{t('bom.colWidth')}</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>{t('bom.colThickness')}</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>{t('bom.colCount')}</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'left', background: 'var(--semi-color-fill-0)' }}>{t('bom.colBuy')}</th>
              </tr>
            </thead>
            <tbody>
              {boardRows.map((b, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px' }}>{localizeLayerLabel(b.label, t)}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>{b.length}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>{b.width}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>{b.thickness}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>{b.count}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px' }}>
                    {renderProcureLinks(boardProcurementLinks(b.label, b.length, b.width, b.thickness, locale))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, color: 'var(--semi-color-text-2)' }}>
            {t('bom.totalLength', { m: (bom.totalProfileLength / 1000).toFixed(2) })}
          </div>
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--semi-color-fill-0)', color: 'var(--semi-color-text-2)', lineHeight: 1.7 }}>
            {t('bom.note1')}
            {t('bom.note2')}
          </div>
        </div>
      </Modal>

      {/* 采购清单文本兜底弹窗（剪贴板不可用时） */}
      <Modal
        title={t('bom.manualTitle')}
        visible={procureTextOpen !== null}
        onCancel={() => setProcureTextOpen(null)}
        footer={<Button theme="solid" type="primary" onClick={() => setProcureTextOpen(null)}>{t('common.close')}</Button>}
        width={isNarrow ? '94vw' : 520}
      >
        <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 8 }}>
          {t('bom.manualHint')}
        </div>
        <textarea
          readOnly
          value={procureTextOpen || ''}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          style={{ width: '100%', height: 220, fontSize: 12, fontFamily: 'monospace', padding: 8, borderRadius: 6, border: '1px solid var(--semi-color-border)', background: 'var(--semi-color-fill-0)', color: 'var(--semi-color-text-0)' }}
        />
      </Modal>

      {/* 校验报告弹窗 */}
      <Modal
        title={issueCount > 0 ? t('validate.titleWith', { n: issueCount }) : t('validate.title')}
        visible={validateOpen}
        onCancel={() => setValidateOpen(false)}
        footer={null}
        width={isNarrow ? '94vw' : 560}
      >
        {issueCount === 0 ? (
          <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--semi-color-text-2)', fontSize: 14 }}>
            {t('validate.none')}
          </div>
        ) : (
          <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            {issues.map((issue, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 6px', borderBottom: '1px solid var(--semi-color-border)', fontSize: 13, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, fontWeight: 600, color: issue.severity === 'error' ? 'var(--semi-color-danger)' : 'var(--semi-color-warning)' }}>
                  {issue.severity === 'error' ? '✕' : '⚠'}
                </span>
                <span style={{ color: 'var(--semi-color-text-0)' }}>{issue.message}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default App;
