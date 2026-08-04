import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button, Tooltip, Layout, Nav, Modal, Toast } from '@douyinfe/semi-ui';
const { Header } = Layout;
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconChevronDown,
  IconBox,
  IconSetting,
  IconUndo,
  IconRedo,
  IconSave,
  IconUpload,
  IconPlus,
  IconList,
} from '@douyinfe/semi-icons';
import SceneView from './components/SceneView';
import PresetViewButtons from './components/MiniCube';
import LeftPanel, { Layer } from './components/LeftPanel';
import BottomBarTable from './components/BottomBarTable';
import LayerEditor from './components/LayerEditor';
import { generateExportHtml } from './utils/exportHtml';
import { computeBom, bomToCsv, bomToHtml } from './utils/bom';
import { ITEM_REGISTRY, ITEMS_BY_CATEGORY, CATEGORY_NAMES } from './components/items';
import type { ItemType } from './components/items';
import ItemThumbnail, { preloadThumbnails } from './components/items/ItemThumbnail';
import { DEFAULT_STATE, isAppState } from './state';
import type { AppState, ColumnsState } from './state';

// 模块级 — 存储高度截断前各层原始标高，跨渲染持久化
const _cappedElev = new Map<string, number>();
let _lastHeight = 1600;

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

const App: React.FC = () => {
  // ── UI 状态（不参与撤销） ──
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [rightTab, setRightTab] = useState<'properties' | 'resources'>('properties');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<ItemType | null>(null);
  const [selectedPlacedItem, setSelectedPlacedItem] = useState<{ layerId: string; col: number; row: number } | null>(null);
  const [pendingTransform, setPendingTransform] = useState({ rotation: 0, scale: 1, flipX: false, flipY: false });
  const [bomOpen, setBomOpen] = useState(false);
  const dragIdRef = useRef<string | null>(null);
  const dragOverRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const data = JSON.parse(raw);
        if (isAppState(data)) {
          skipRecordRef.current = true;
          setAppState({
            ...DEFAULT_STATE,
            ...data,
            dimensions: data.dimensions,
            columns: { ...DEFAULT_STATE.columns, ...data.columns },
          });
          Toast.success('已恢复上次编辑的草稿');
        }
      }
    } catch {
      /* 草稿损坏则忽略 */
    }
  }, []);

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
        const data = JSON.parse(reader.result as string);
        if (!isAppState(data)) {
          Toast.error('文件格式不正确，请选择有效的工程文件');
          return;
        }
        historyRef.current.push(stateRef.current);
        futureRef.current = [];
        skipRecordRef.current = true;
        setAppState({
          ...DEFAULT_STATE,
          ...data,
          dimensions: data.dimensions,
          columns: { ...DEFAULT_STATE.columns, ...data.columns },
        });
        Toast.success('工程文件已加载');
      } catch {
        Toast.error('解析失败，文件可能已损坏');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleNew = useCallback(() => {
    if (!window.confirm('新建将清空当前场景并删除自动草稿，确定？')) return;
    localStorage.removeItem(SAVE_KEY);
    historyRef.current = [];
    futureRef.current = [];
    skipRecordRef.current = true;
    setAppState(DEFAULT_STATE);
    setHistVer((v) => v + 1);
  }, []);

  // BOM 清单（从参数直接计算）
  const bom = useMemo(() => computeBom(appState), [appState]);
  const handleDownloadCsv = useCallback(() => {
    const blob = new Blob([bomToCsv(bom)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workbench-bom.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [bom]);
  const handleDownloadHtml = useCallback(() => {
    const blob = new Blob([bomToHtml(bom, appState)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workbench-bom.html';
    a.click();
    URL.revokeObjectURL(url);
  }, [bom, appState]);

  /** 所有层按标高降序排列，保证层参数、层结构、3D 场景顺序一致 */
  const sortedLayers = useMemo(
    () => [...appState.layers].sort((a, b) => b.detail.elevation - a.detail.elevation),
    [appState.layers]
  );

  /** 统一更新 layers（兼容函数式更新），并自动进入撤销栈 */
  const updateLayers = useCallback((updater: Layer[] | ((prev: Layer[]) => Layer[])) => {
    setAppState((prev) => ({
      ...prev,
      layers: typeof updater === 'function' ? (updater as (p: Layer[]) => Layer[])(prev.layers) : updater,
    }));
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
      prev.map((l) =>
        l.id === id ? { ...l, detail: { ...l.detail, layout } } : l
      )
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
    // 只允许台面和隔板拖拽
    updateLayers((prev) => {
      const activeLayer = prev.find((l) => l.id === activeId);
      if (!activeLayer || (activeLayer.type !== 'countertop' && activeLayer.type !== 'shelf')) return prev;
      if (dragOverRef.current === targetId) return prev; // 同一目标不重复交换
      dragOverRef.current = targetId;
      const oldIndex = prev.findIndex((l) => l.id === activeId);
      const newIndex = prev.findIndex((l) => l.id === targetId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = [...prev];
      const movedElev = next[oldIndex].detail.elevation;
      const targetElev = next[newIndex].detail.elevation;
      const [moved] = next.splice(oldIndex, 1);
      moved.detail.elevation = targetElev;
      next.splice(newIndex, 0, moved);
      const adjustedIndex = next.findIndex((l) => l.id === targetId);
      if (adjustedIndex !== -1) {
        next[adjustedIndex] = { ...next[adjustedIndex], detail: { ...next[adjustedIndex].detail, elevation: movedElev } };
      }
      return next;
    });
  }, [updateLayers]);

  const handleDragEnd = useCallback(() => {
    dragIdRef.current = null;
    dragOverRef.current = null;
  }, []);

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
        const nextLayers = prev.layers.map((l) => {
          // 顶板标高跟随整体高度变化
          if (l.type === 'top' && l.detail.elevation === oldH) {
            if (_cappedElev.has(l.id)) _cappedElev.delete(l.id);
            return { ...l, detail: { ...l.detail, elevation: newH, length: next.width, width: next.depth } };
          }
          if (l.detail.elevation > newH) {
            if (oldH > newH && !_cappedElev.has(l.id)) {
              _cappedElev.set(l.id, l.detail.elevation);
            }
            return { ...l, detail: { ...l.detail, elevation: newH, length: next.width, width: next.depth } };
          }
          if (oldH < newH && _cappedElev.has(l.id)) {
            const orig = _cappedElev.get(l.id)!;
            if (l.detail.elevation === oldH) {
              _cappedElev.delete(l.id);
              const elev = Math.min(orig, newH);
              return { ...l, detail: { ...l.detail, elevation: elev, length: next.width, width: next.depth } };
            }
          }
          // 所有层跟随整体尺寸变化
          return { ...l, detail: { ...l.detail, length: next.width, width: next.depth } };
        });
        return { ...prev, dimensions: next, layers: nextLayers };
      });
    },
    []
  );

  // 在层板的布局方块中放置/删除物品
  const handlePlaceItem = useCallback(
    (layerId: string, col: number, row: number, itemType: ItemType | null) => {
      setSelectedPlacedItem(null);
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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶栏 */}
      <Header style={{ backgroundColor: 'var(--semi-color-bg-1)', borderBottom: '1px solid var(--semi-color-border)', flexShrink: 0 }}>
        <Nav mode="horizontal" defaultSelectedKeys={['Home']}>
          <Nav.Header>
            <Logo />
          </Nav.Header>
          <span style={{ color: 'var(--semi-color-text-2)' }}>
            <span style={{ marginRight: '24px', color: 'var(--semi-color-text-0)', fontWeight: '600' }}>
              VisionAI 3D Workbench
            </span>
            <span style={{ marginRight: '24px' }}>场景编辑</span>
            <span>资产管理</span>
          </span>
          <Nav.Footer>
            {/* 场景工具：撤销/重做、保存/加载/新建、BOM 清单 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 12 }}>
              <Tooltip content="撤销">
                <Button theme="borderless" size="small" icon={<IconUndo size="small" />} onClick={undo} disabled={!canUndo} />
              </Tooltip>
              <Tooltip content="重做">
                <Button theme="borderless" size="small" icon={<IconRedo size="small" />} onClick={redo} disabled={!canRedo} />
              </Tooltip>
              <div style={{ width: 1, height: 20, background: 'var(--semi-color-border)', margin: '0 4px' }} />
              <Tooltip content="保存工程文件 (.json)">
                <Button theme="borderless" size="small" icon={<IconSave size="small" />} onClick={handleSave} />
              </Tooltip>
              <Tooltip content="加载工程文件 (.json)">
                <Button theme="borderless" size="small" icon={<IconUpload size="small" />} onClick={() => fileInputRef.current?.click()} />
              </Tooltip>
              <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleLoadFile} />
              <Tooltip content="新建场景">
                <Button theme="borderless" size="small" icon={<IconPlus size="small" />} onClick={handleNew} />
              </Tooltip>
              <div style={{ width: 1, height: 20, background: 'var(--semi-color-border)', margin: '0 4px' }} />
              <Tooltip content="BOM 切割清单">
                <Button theme="borderless" size="small" icon={<IconList size="small" />} onClick={() => setBomOpen(true)} />
              </Tooltip>
            </div>
            <Tooltip content="资源管理器" position="bottom">
              <Button theme="borderless" icon={<IconBox size="large" />} style={{ color: 'var(--semi-color-text-2)', marginRight: '12px' }} />
            </Tooltip>
            <Tooltip content="导出 HTML" position="bottom">
              <Button
                theme="borderless"
                size="small"
                style={{ color: 'var(--semi-color-text-2)', fontSize: 13 }}
                onClick={() => {
                  const html = generateExportHtml({ dimensions: appState.dimensions, profile: appState.profile, columns: appState.columns, layers: sortedLayers });
                  const blob = new Blob([html], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = '3d-workbench-export.html';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                导出
              </Button>
            </Tooltip>
          </Nav.Footer>
        </Nav>
      </Header>

      {/* 3D 视图（始终占满剩余空间） */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: 'var(--semi-color-bg-0)', overflow: 'hidden', minHeight: 0 }}>
        <SceneView dimensions={appState.dimensions} profile={appState.profile} columns={appState.columns} layers={sortedLayers} selectedLayerId={selectedLayerId} selectedItemType={selectedItemType} selectedPlacedItem={selectedPlacedItem} onPlaceItem={handlePlaceItem} onSelectPlacedItem={handleSelectPlacedItem} onTransformPlacedItem={handleTransformPlacedItem} />
        <PresetViewButtons />

        {/* 左侧边栏（浮动覆盖）- 展开时显示面板 */}
        {!leftCollapsed && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 300,
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
                工具面板
              </span>
              <Tooltip content="收起左侧面板">
                <Button
                  theme="borderless"
                  icon={<IconChevronLeft size="small" />}
                  onClick={() => setLeftCollapsed(true)}
                  size="small"
                />
              </Tooltip>
            </div>
            <div style={{ height: 'calc(100% - 44px)', overflow: 'auto' }}>
              <LeftPanel
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
            <Tooltip content="展开左侧面板" position="right">
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
              width: 260,
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
                  {rightTab === 'properties' ? '属性面板' : '物品资源'}
                </span>
                <div style={{ flex: 1 }} />
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {rightTab === 'properties' ? (
                  <LayerEditor
                    layer={appState.layers.find((l) => l.id === selectedLayerId) || null}
                    shelfNumber={(() => {
                      // 与底栏/3D 标签一致：按标高降序编号
                      const shelves = sortedLayers.filter((l) => l.type === 'shelf');
                      const idx = shelves.findIndex((l) => l.id === selectedLayerId);
                      return idx >= 0 ? idx + 1 : undefined;
                    })()}
                    dimensions={appState.dimensions}
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
                        已选中物品，点击3D视图中的网格放置
                      </div>
                    )}
                    {(Object.entries(ITEMS_BY_CATEGORY) as [string, typeof ITEM_REGISTRY][]).map(([cat, items]) => (
                      <div key={cat} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--semi-color-text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                          {CATEGORY_NAMES[cat as keyof typeof CATEGORY_NAMES] || cat}
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
                                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--semi-color-text-0)', textAlign: 'center' }}>{item.name}</div>
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
            right: rightCollapsed ? 0 : 260,
            top: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {([
            { key: 'properties', label: '属性面板', icon: <IconSetting size="large" /> },
            { key: 'resources', label: '物品资源', icon: <IconBox size="large" /> },
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
          <Tooltip content={rightCollapsed ? '展开右侧面板' : '收起右侧面板'} position="left">
            <div
              onClick={() => setRightCollapsed(!rightCollapsed)}
              style={{
                width: 36,
                height: 36,
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
            style={{
              position: 'absolute',
              bottom: 0,
              left: leftCollapsed ? 0 : 300,
              right: rightCollapsed ? 0 : 260,
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
                层参数
              </span>
              <Tooltip content="收起底栏">
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
                layers={sortedLayers}
                selectedId={selectedLayerId}
                onSelect={(id) => { setSelectedLayerId(id); setRightTab('properties'); if (id) setRightCollapsed(false); }}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
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
          <Tooltip content="展开底栏">
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
        title="BOM 切割清单"
        visible={bomOpen}
        onCancel={() => setBomOpen(false)}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={handleDownloadCsv}>下载 CSV</Button>
            <Button theme="solid" type="primary" onClick={handleDownloadHtml}>下载 HTML 报告</Button>
          </div>
        }
        width={720}
      >
        <div style={{ maxHeight: '60vh', overflow: 'auto', fontSize: 12 }}>
          <div style={{ marginBottom: 12, color: 'var(--semi-color-text-2)', fontSize: 12 }}>
            整体 {appState.dimensions.width} × {appState.dimensions.depth} × {appState.dimensions.height} mm
            &nbsp;·&nbsp; 主型材 {appState.profile[0] ? `${appState.profile[0]}-${appState.profile[1]}` : '自定义'}
            &nbsp;·&nbsp; {appState.layers.length} 层
          </div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>型材下料清单（共 {bom.totalProfileCount} 根）</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'left', background: 'var(--semi-color-fill-0)' }}>规格</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>长度 (mm)</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>数量</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>合计 (mm)</th>
              </tr>
            </thead>
            <tbody>
              {bom.profiles.map((r, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px' }}>{r.spec}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>{r.length}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>{r.count}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>{r.count * r.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>板材清单（{bom.boards.length} 块）</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'left', background: 'var(--semi-color-fill-0)' }}>名称</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>长 (mm)</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>宽 (mm)</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>厚 (mm)</th>
                <th style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right', background: 'var(--semi-color-fill-0)' }}>数量</th>
              </tr>
            </thead>
            <tbody>
              {bom.boards.map((b, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px' }}>{b.label}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>{b.length}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>{b.width}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>{b.thickness}</td>
                  <td style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px', textAlign: 'right' }}>1</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, color: 'var(--semi-color-text-2)' }}>
            型材下料合计：{(bom.totalProfileLength / 1000).toFixed(2)} m。连接件（角件/螺栓/T型螺母）按组装图纸另行配置。
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default App;
