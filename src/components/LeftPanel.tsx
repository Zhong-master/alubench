import { useState, useCallback } from 'react';
import { Collapse, InputNumber, Input, Button, Select, Tooltip } from '@douyinfe/semi-ui';
import { IconPlus, IconMinus, IconCopy } from '@douyinfe/semi-icons';
import type { ItemType } from './items';
import { duplicateLayer } from '../geometry/operations';

/** 唯一层 ID 生成器 — 递增计数器，避免 Date.now() 在 <1ms 间隔内碰撞 */
let _layerIdCounter = 0;
function generateLayerId(type: string): string {
  return `${type}-${Date.now()}-${++_layerIdCounter}`;
}

export type LayerType = 'top' | 'countertop' | 'shelf' | 'bottom';

export interface PlacedItem {
  col: number;
  row: number;
  itemType: ItemType;
  rotation?: number;     // 0 | 90 | 180 | 270
  scale?: number;        // 1 = 默认
  flipX?: boolean;
  flipY?: boolean;
}

export interface LayerDetail {
  length: number;
  width: number;
  elevation: number;
  thickness: number;
  layout: string;
  items: string[];
  placedItems: PlacedItem[];
  locked: boolean;
  profileType: string;
  ribCount: number;
  ribDirection: 'x' | 'z';
  frontConnect: 'extend' | 'drop' | 'up' | 'down' | 'none';
  halign: 'left' | 'center' | 'right';
  topColumns: { fl: boolean; fr: boolean; bl: boolean; br: boolean };
}

export interface Layer {
  id: string;
  type: LayerType;
  label: string;
  color: string;
  detail: LayerDetail;
}

export const LAYER_CONFIG: Record<LayerType, { label: string; color: string; maxCount: number }> = {
  top: { label: '顶板', color: '#999999', maxCount: 1 },
  countertop: { label: '台面', color: '#2d6a2d', maxCount: 1 },
  shelf: { label: '隔板', color: '#4f8cff', maxCount: Infinity },
  bottom: { label: '底板', color: '#333333', maxCount: 1 },
};

const ADD_ORDER: LayerType[] = ['top', 'countertop', 'shelf', 'bottom'];

interface LeftPanelProps {
  layers: Layer[];
  onLayersChange: (layers: Layer[] | ((prev: Layer[]) => Layer[])) => void;
  dimensions: { width: number; depth: number; height: number };
  onDimensionsChange: React.Dispatch<React.SetStateAction<{ width: number; depth: number; height: number }>>;
  profile: string[];
  onProfileChange: (profile: string[]) => void;
  columns: { front: number; back: number; left: number; right: number; top: number; bottom: number; bottomFrame: 'full' | 'frontback' | 'leftright' | 'none'; frontCap: string; backCap: string; leftCap: string; rightCap: string };
  onColumnsChange: React.Dispatch<React.SetStateAction<{ front: number; back: number; left: number; right: number; top: number; bottom: number; bottomFrame: 'full' | 'frontback' | 'leftright' | 'none'; frontCap: string; backCap: string; leftCap: string; rightCap: string }>>;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ layers, onLayersChange, dimensions, onDimensionsChange, profile, onProfileChange, columns, onColumnsChange }) => {
  const [customProfile, setCustomProfile] = useState('');

  const getLayerCount = useCallback(
    (type: LayerType) => layers.filter((l) => l.type === type).length,
    [layers]
  );

  const getProfileMM = useCallback(() => {
    const s = (profile[1] || '').substring(0, 2);
    return parseInt(s) || 40;
  }, [profile]);

  const addLayer = useCallback((type: LayerType) => {
    const cfg = LAYER_CONFIG[type];
    const profileT = getProfileMM();
    const defaultLength = dimensions.width;
    const defaultWidth = dimensions.depth;
    const defaultLocked = type === 'top' || type === 'countertop' || type === 'bottom';
    const defaultTopCols = { fl: true, fr: true, bl: true, br: true };
    onLayersChange((prev: Layer[]) => {
      // 在回调内验证 maxCount，避免闭包竞态绕过限制（BUG #NEW-A）
      if (prev.filter((l) => l.type === type).length >= cfg.maxCount) return prev;
      // 根据最新 prev 判断是否有顶板，避免闭包竞态（BUG #6）
      const hasTopNow = prev.some((l) => l.type === 'top');
      // 隔板自动递增：以最高隔板标高 + 300mm 间隔，避免多隔板重叠
      const defaultElevation =
        type === 'top' ? dimensions.height :
        type === 'bottom' ? profileT :
        type === 'countertop' ? (hasTopNow ? dimensions.height / 2 : dimensions.height) :
        // 隔板自动递增：基准 550mm，后续每个 +300mm 间隔，避免多隔板重叠
        type === 'shelf' ? (prev.filter(l => l.type === 'shelf').reduce((max, l) => Math.max(max, l.detail.elevation), 250) + 300) : 0;
      const newLayer: Layer = {
        id: generateLayerId(type),
        type,
        label: cfg.label,
        color: cfg.color,
        detail: { length: defaultLength, width: defaultWidth, elevation: defaultElevation, thickness: 10, layout: '', items: [], placedItems: [], locked: defaultLocked, profileType: '', ribCount: 0, ribDirection: 'x' as 'x' | 'z', frontConnect: 'extend' as 'extend' | 'drop' | 'up' | 'down' | 'none', halign: 'left' as 'left' | 'center' | 'right', topColumns: defaultTopCols },
      };
      const withoutTop = prev.filter((l) => l.type !== 'top');
      const withoutTopBottom = withoutTop.filter((l) => l.type !== 'bottom');
      const topLayer = prev.find((l) => l.type === 'top');
      const bottomLayer = prev.find((l) => l.type === 'bottom');

      if (type === 'top') {
        return [
          newLayer,
          ...withoutTopBottom.map((l) =>
            l.type === 'countertop' && Math.abs(l.detail.elevation - dimensions.height) < 1
              ? { ...l, detail: { ...l.detail, elevation: dimensions.height / 2 } }
              : l
          ),
          ...(bottomLayer ? [bottomLayer] : []),
        ];
      }
      if (type === 'bottom') {
        return [...(topLayer ? [topLayer] : []), ...withoutTopBottom, newLayer];
      }
      return [
        ...(topLayer ? [topLayer] : []),
        ...withoutTopBottom,
        newLayer,
        ...(bottomLayer ? [bottomLayer] : []),
      ];
    });
  }, [onLayersChange, dimensions, getProfileMM]);

  const removeLayer = useCallback((id: string) => {
    onLayersChange((prev: Layer[]) => {
      const removed = prev.find((l) => l.id === id);
      const next = prev.filter((l) => l.id !== id);
      // 删除顶板时，将处于 height/2 的台面恢复为柜体高度
      if (removed?.type === 'top') {
        return next.map((l) =>
          l.type === 'countertop' && Math.abs(l.detail.elevation - dimensions.height / 2) < 1
            ? { ...l, detail: { ...l.detail, elevation: dimensions.height } }
            : l
        );
      }
      return next;
    });
  }, [onLayersChange, dimensions]);

  // 复制层（仅台面/隔板），插入原层下方（原数组位置之后）
  const duplicate = useCallback((id: string) => {
    onLayersChange((prev: Layer[]) => {
      const src = prev.find((l) => l.id === id);
      if (!src || src.type === 'top' || src.type === 'bottom') return prev;
      const copy = duplicateLayer(src);
      const idx = prev.findIndex((l) => l.id === id);
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
  }, [onLayersChange]);

  return (
    <div style={{ padding: '12px 8px' }}>
      <Collapse defaultActiveKey={['dimensions', 'columns', 'layers', 'profile']}>
        {/* 整体尺寸 */}
        <Collapse.Panel header="整体尺寸" itemKey="dimensions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <InputNumber
              prefix="长"
              suffix="mm"
              value={dimensions.width}
              onChange={(v) => { if (v === '' || v === null || v === undefined) return; const n = Number(v); if (!isNaN(n)) onDimensionsChange((d) => ({ ...d, width: n })); }}
              style={{ width: '100%' }}
              min={1}
              max={10000}
              hideButtons
            />
            <InputNumber
              prefix="宽"
              suffix="mm"
              value={dimensions.depth}
              onChange={(v) => { if (v === '' || v === null || v === undefined) return; const n = Number(v); if (!isNaN(n)) onDimensionsChange((d) => ({ ...d, depth: n })); }}
              style={{ width: '100%' }}
              min={1}
              max={10000}
              hideButtons
            />
            <InputNumber
              prefix="高"
              suffix="mm"
              value={dimensions.height}
              onChange={(v) => { if (v === '' || v === null || v === undefined) return; const n = Number(v); if (!isNaN(n)) onDimensionsChange((d) => ({ ...d, height: n })); }}
              style={{ width: '100%' }}
              min={1}
              max={10000}
              hideButtons
            />
          </div>
        </Collapse.Panel>

        {/* 骨架编辑 */}
        <Collapse.Panel header="骨架编辑" itemKey="columns">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <InputNumber prefix="前" value={columns.front} min={0} max={20} hideButtons style={{ width: '100%' }}
              onChange={(v) => { if (v === '' || v === null || v === undefined) return; const n = Number(v); if (!isNaN(n)) onColumnsChange((c) => ({ ...c, front: n })); }} />
            <InputNumber prefix="后" value={columns.back} min={0} max={20} hideButtons style={{ width: '100%' }}
              onChange={(v) => { if (v === '' || v === null || v === undefined) return; const n = Number(v); if (!isNaN(n)) onColumnsChange((c) => ({ ...c, back: n })); }} />
            <InputNumber prefix="左" value={columns.left} min={0} max={20} hideButtons style={{ width: '100%' }}
              onChange={(v) => { if (v === '' || v === null || v === undefined) return; const n = Number(v); if (!isNaN(n)) onColumnsChange((c) => ({ ...c, left: n })); }} />
            <InputNumber prefix="右" value={columns.right} min={0} max={20} hideButtons style={{ width: '100%' }}
              onChange={(v) => { if (v === '' || v === null || v === undefined) return; const n = Number(v); if (!isNaN(n)) onColumnsChange((c) => ({ ...c, right: n })); }} />
            <InputNumber prefix="上" value={columns.top} min={0} max={20} hideButtons style={{ width: '100%' }}
              onChange={(v) => { if (v === '' || v === null || v === undefined) return; const n = Number(v); if (!isNaN(n)) onColumnsChange((c) => ({ ...c, top: n })); }} />
            <InputNumber prefix="下" value={columns.bottom} min={0} max={20} hideButtons style={{ width: '100%' }}
              onChange={(v) => { if (v === '' || v === null || v === undefined) return; const n = Number(v); if (!isNaN(n)) onColumnsChange((c) => ({ ...c, bottom: n })); }} />
          </div>
          {/* 立柱截止层（选层后该侧立柱仅到该层底部，不选=全高） */}
          <div style={{ marginTop: 6, marginBottom: 6, fontSize: 12, color: 'var(--semi-color-text-2)' }}>立柱截止层（不选=全高）</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--semi-color-text-2)', marginBottom: 2 }}>前</div>
              <Select value={columns.frontCap || ''} onChange={(v) => onColumnsChange((c) => ({ ...c, frontCap: (v as string) || '' }))} style={{ width: '100%' }} size="small" placeholder="全高">
                <Select.Option value="">全高</Select.Option>
                {layers.map((l) => (
                  <Select.Option key={l.id} value={l.id}>{l.label}{l.type === 'shelf' ? (() => { const shelves = layers.filter(s => s.type === 'shelf'); const idx = shelves.findIndex(s => s.id === l.id); return ` #${idx + 1}`; })() : ''} ({l.detail.elevation}mm)</Select.Option>
                ))}
              </Select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--semi-color-text-2)', marginBottom: 2 }}>后</div>
              <Select value={columns.backCap || ''} onChange={(v) => onColumnsChange((c) => ({ ...c, backCap: (v as string) || '' }))} style={{ width: '100%' }} size="small" placeholder="全高">
                <Select.Option value="">全高</Select.Option>
                {layers.map((l) => (
                  <Select.Option key={l.id} value={l.id}>{l.label}{l.type === 'shelf' ? (() => { const shelves = layers.filter(s => s.type === 'shelf'); const idx = shelves.findIndex(s => s.id === l.id); return ` #${idx + 1}`; })() : ''} ({l.detail.elevation}mm)</Select.Option>
                ))}
              </Select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--semi-color-text-2)', marginBottom: 2 }}>左</div>
              <Select value={columns.leftCap || ''} onChange={(v) => onColumnsChange((c) => ({ ...c, leftCap: (v as string) || '' }))} style={{ width: '100%' }} size="small" placeholder="全高">
                <Select.Option value="">全高</Select.Option>
                {layers.map((l) => (
                  <Select.Option key={l.id} value={l.id}>{l.label}{l.type === 'shelf' ? (() => { const shelves = layers.filter(s => s.type === 'shelf'); const idx = shelves.findIndex(s => s.id === l.id); return ` #${idx + 1}`; })() : ''} ({l.detail.elevation}mm)</Select.Option>
                ))}
              </Select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--semi-color-text-2)', marginBottom: 2 }}>右</div>
              <Select value={columns.rightCap || ''} onChange={(v) => onColumnsChange((c) => ({ ...c, rightCap: (v as string) || '' }))} style={{ width: '100%' }} size="small" placeholder="全高">
                <Select.Option value="">全高</Select.Option>
                {layers.map((l) => (
                  <Select.Option key={l.id} value={l.id}>{l.label}{l.type === 'shelf' ? (() => { const shelves = layers.filter(s => s.type === 'shelf'); const idx = shelves.findIndex(s => s.id === l.id); return ` #${idx + 1}`; })() : ''} ({l.detail.elevation}mm)</Select.Option>
                ))}
              </Select>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)', whiteSpace: 'nowrap' }}>底部框架</span>
            <Select
              value={columns.bottomFrame || 'full'}
              onChange={(v) => onColumnsChange((c) => ({ ...c, bottomFrame: (v || 'full') as 'full' | 'frontback' | 'leftright' | 'none' }))}
              style={{ flex: 1 }} size="small"
            >
              <Select.Option value="full">全框连接</Select.Option>
              <Select.Option value="frontback">前后连接</Select.Option>
              <Select.Option value="leftright">左右连接</Select.Option>
              <Select.Option value="none">四柱独立</Select.Option>
            </Select>
          </div>
        </Collapse.Panel>

        {/* 层结构 */}
        <Collapse.Panel header="层结构" itemKey="layers">
          <div style={{ maxHeight: 220, overflow: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
            {ADD_ORDER.map((type) => {
              const cfg = LAYER_CONFIG[type];
              const count = getLayerCount(type);
              const disabled = count >= cfg.maxCount;
              return (
                <Button
                  key={type}
                  size="small"
                  icon={<IconPlus size="extra-small" />}
                  disabled={disabled}
                  onClick={() => addLayer(type)}
                  style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderColor: disabled ? undefined : cfg.color,
                    color: disabled ? undefined : cfg.color,
                  }}
                >
                  {cfg.label}
                </Button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {layers.map((layer) => (
              <div
                key={layer.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: `1px solid ${layer.color}44`,
                  background: `${layer.color}11`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: layer.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12 }}>{layer.label}</span>
                  {layer.type === 'shelf' && (() => {
                    const shelves = layers.filter((l) => l.type === 'shelf');
                    const idx = shelves.findIndex((l) => l.id === layer.id);
                    return <span style={{ fontSize: 10, color: 'var(--semi-color-text-2)' }}>#{idx + 1}</span>;
                  })()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {layer.type !== 'top' && layer.type !== 'bottom' && (
                    <Tooltip content="复制层">
                      <Button
                        theme="borderless"
                        size="small"
                        icon={<IconCopy size="extra-small" />}
                        onClick={() => duplicate(layer.id)}
                        style={{ color: 'var(--semi-color-text-2)', padding: 0, minWidth: 20 }}
                      />
                    </Tooltip>
                  )}
                  <Button
                    theme="borderless"
                    size="small"
                    icon={<IconMinus size="extra-small" />}
                    onClick={() => removeLayer(layer.id)}
                    style={{ color: 'var(--semi-color-danger)', padding: 0, minWidth: 20 }}
                  />
                </div>
              </div>
            ))}
            {layers.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>暂无层结构</span>
            )}
          </div>
          </div>
        </Collapse.Panel>

        {/* 型材型号 */}
        <Collapse.Panel header="型材型号" itemKey="profile">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <Select
                value={profile[0] || ''}
                onChange={(v) => {
                  const val = v as string;
                  if (val) {
                    onProfileChange([val, '4040']);
                  } else {
                    onProfileChange([]);
                  }
                  setCustomProfile('');
                }}
                placeholder="标准"
                style={{ flex: 1 }}
                size="small"
              >
                <Select.Option value="GB">国标 (GB)</Select.Option>
                <Select.Option value="EU">欧标 (EU)</Select.Option>
                <Select.Option value="JIS">日标 (JIS)</Select.Option>
              </Select>
              <Select
                value={profile[1] || ''}
                onChange={(v) => {
                  const val = v as string;
                  if (val) {
                    onProfileChange([profile[0] || 'GB', val]);
                    setCustomProfile('');
                  }
                }}
                placeholder="规格"
                style={{ flex: 1 }}
                size="small"
                disabled={!profile[0]}
              >
                {['2020', '3030', '4040', '4545', '5050', '6060', '8080', '4080'].map((m) => (
                  <Select.Option key={m} value={m}>{m}</Select.Option>
                ))}
              </Select>
            </div>
            <Input
              prefix="定制"
              placeholder="输入自定义型号"
              value={customProfile}
              style={{ width: '100%' }}
              onChange={(v) => { setCustomProfile(v); onProfileChange([]); }}
            />
          </div>
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};

export default LeftPanel;
