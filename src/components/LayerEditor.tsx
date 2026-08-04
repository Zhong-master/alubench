import { useRef } from 'react';
import { InputNumber, Button, Select } from '@douyinfe/semi-ui';
import type { Layer, LayerDetail, LayerType } from './LeftPanel';

interface LayerEditorProps {
  layer: Layer | null;
  /** 隔板序号（仅 shelf 类型有意义，用于标题显示 #N） */
  shelfNumber?: number;
  dimensions: { width: number; depth: number; height: number };
  onDetailChange: (id: string, field: string, value: number) => void;
  onLayoutChange: (id: string, layout: string) => void;
  onLockToggle: (id: string) => void;
  onLayerPropChange: (id: string, field: string, value: unknown) => void;
  onSwitchToItems: () => void;
}

const LAYER_LABELS: Record<LayerType, string> = {
  top: '顶板',
  countertop: '台面',
  shelf: '隔板',
  bottom: '底板',
};

const PADDING = 14;
const panel: React.CSSProperties = {
  background: 'var(--semi-color-fill-0)',
  borderRadius: 6,
  padding: `${PADDING}px`,
  display: 'flex', flexDirection: 'column', gap: 0,
};
const divider: React.CSSProperties = {
  height: 1,
  background: 'var(--semi-color-border)',
  margin: '10px 0',
};
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600,
  color: 'var(--semi-color-text-2)',
  marginBottom: 8,
};
const row: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
};
const label: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--semi-color-text-2)',
  marginBottom: 2,
};
const fieldWrap: React.CSSProperties = {
  marginBottom: 6,
};

interface NumProps {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}

/** 层参数数值输入（可锁定时禁用） */
const Num: React.FC<NumProps> = ({ value, min, max, disabled, onChange }) => (
  <InputNumber
    value={value} hideButtons size="small" style={{ width: '100%' }}
    min={min ?? 0.1} max={max}
    disabled={disabled}
    onChange={(v) => {
      // 允许键盘流畅输入：值为空/删除时不更新，避免跳变为 1
      if (v === '' || v === null || v === undefined) return;
      const n = Number(v);
      if (!isNaN(n)) onChange(n);
    }}
  />
);

const LayerEditor: React.FC<LayerEditorProps> = ({ layer, shelfNumber, dimensions, onDetailChange, onLayoutChange, onLockToggle, onLayerPropChange, onSwitchToItems }) => {
  const layoutRowRef = useRef<HTMLDivElement>(null);

  if (!layer) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: 'var(--semi-color-text-2)', textAlign: 'center' }}>
        点击左侧层以编辑参数
      </div>
    );
  }

  const { detail } = layer;

  return (
    <div style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: layer.color }}>
          {LAYER_LABELS[layer.type]}{layer.type === 'shelf' && shelfNumber ? ` #${shelfNumber}` : ''}
        </span>
        <Button
          theme="borderless" size="small"
          icon={<span style={{ fontSize: 14 }}>{detail.locked ? '🔒' : '🔓'}</span>}
          onClick={() => onLockToggle(layer.id)}
          style={{ color: detail.locked ? 'var(--semi-color-primary)' : 'var(--semi-color-text-2)' }}
        />
      </div>

      {/* 统一底板 */}
      <div style={panel}>

        {/* ── 尺寸 ── */}
        <div style={sectionTitle}>尺寸</div>
        <div style={row}>
          <div style={fieldWrap}>
            <div style={label}>长 (mm)</div>
            <Num value={detail.length} min={1} max={dimensions.width} disabled={detail.locked} onChange={(v) => onDetailChange(layer.id, 'length', v)} />
          </div>
          <div style={fieldWrap}>
            <div style={label}>宽 (mm)</div>
            <Num value={detail.width} min={1} max={dimensions.depth} disabled={detail.locked} onChange={(v) => onDetailChange(layer.id, 'width', v)} />
          </div>
        </div>
        <div style={row}>
          <div style={fieldWrap}>
            <div style={label}>标高 (mm)</div>
            <Num value={detail.elevation} min={0} max={dimensions.height}
              disabled={layer.type === 'top' || layer.type === 'bottom'}
              onChange={(v) => onDetailChange(layer.id, 'elevation', v)} />
          </div>
          <div style={fieldWrap}>
            <div style={label}>厚度 (mm)</div>
            <Num value={detail.thickness} min={0.1} max={dimensions.height} disabled={detail.locked} onChange={(v) => onDetailChange(layer.id, 'thickness', v)} />
          </div>
        </div>

        {/* ── 结构 ── */}
        {(layer.type === 'countertop' || layer.type === 'shelf') && (
          <>
            <div style={divider} />
            <div style={sectionTitle}>结构</div>

            <div style={fieldWrap}>
              <div style={label}>前端连接</div>
              {detail.width >= dimensions.depth ? (
                <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', padding: '4px 0' }}>
                  层宽达到柜深，自动延伸至立柱
                </div>
              ) : (
                <Select
                  value={detail.frontConnect || 'extend'}
                  onChange={(v) => onLayerPropChange(layer.id, 'frontConnect', v)}
                  style={{ width: '100%' }} size="small"
                >
                  <Select.Option value="extend">延伸至立柱</Select.Option>
                  <Select.Option value="up">上连型材</Select.Option>
                  <Select.Option value="down">下连型材</Select.Option>
                </Select>
              )}
            </div>

            {/* 搁板对齐位置 */}
            {detail.width < dimensions.depth && (
              <div style={fieldWrap}>
                <div style={label}>位置</div>
                <Select
                  value={detail.halign || 'left'}
                  onChange={(v) => onLayerPropChange(layer.id, 'halign', v)}
                  style={{ width: '100%' }} size="small"
                >
                  <Select.Option value="left">靠左</Select.Option>
                  <Select.Option value="center">居中</Select.Option>
                  <Select.Option value="right">靠右</Select.Option>
                </Select>
              </div>
            )}

            <div style={{ ...fieldWrap, marginBottom: 0 }}>
              <div style={label}>加强筋</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <Num value={detail.ribCount} min={0} max={20} disabled={detail.locked} onChange={(v) => onDetailChange(layer.id, 'ribCount', v)} />
                <Button
                  size="small"
                  onClick={() => onLayerPropChange(layer.id, 'ribDirection', detail.ribDirection === 'x' ? 'z' : 'x')}
                  style={{ fontSize: 11, padding: '2px 6px', minWidth: 40, flexShrink: 0 }}
                >
                  {detail.ribDirection === 'x' ? '横向' : '纵向'}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── 顶板立杆 ── */}
        {layer.type === 'top' && (
          <>
            <div style={divider} />
            <div style={sectionTitle}>立杆连接</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {([
                { key: 'fl', label: '前左' },
                { key: 'fr', label: '前右' },
                { key: 'bl', label: '后左' },
                { key: 'br', label: '后右' },
              ] as Array<{ key: keyof NonNullable<LayerDetail['topColumns']>; label: string }>).map(({ key, label: lb }) => (
                <label key={key} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={detail.topColumns?.[key] ?? true}
                    onChange={(e) => onLayerPropChange(layer.id, 'topColumns', { ...detail.topColumns, [key]: e.target.checked })} />
                  {lb}
                </label>
              ))}
            </div>
            {[detail.topColumns?.fl, detail.topColumns?.fr, detail.topColumns?.bl, detail.topColumns?.br].filter(Boolean).length < 2 && (
              <div style={{ fontSize: 11, color: 'var(--semi-color-danger)', marginTop: 4 }}>至少选择两根立杆</div>
            )}
          </>
        )}

        {/* ── 布局 ── */}
        {(layer.type === 'countertop' || layer.type === 'shelf') && (
          <>
            <div style={divider} />
            <div style={sectionTitle}>布局（列 × 行）</div>
            <div ref={layoutRowRef} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <InputNumber
                value={detail.layout ? Number(detail.layout.split('X')[0]) || undefined : undefined}
                hideButtons size="small" style={{ width: '100%' }} min={1} max={99}
                onChange={(v) => {
                  const a = String(Number(v) || '');
                  const inputs = layoutRowRef.current?.querySelectorAll('.semi-input-number');
                  const bEl = inputs?.[1]?.querySelector('input') as HTMLInputElement | undefined;
                  const b = bEl ? String(Number(bEl.value) || '') : '';
                  onLayoutChange(layer.id, a && b ? `${a}X${b}` : a || '');
                }}
              />
              <span style={{ color: 'var(--semi-color-text-2)', fontSize: 13, flexShrink: 0 }}>×</span>
              <InputNumber
                value={detail.layout ? Number(detail.layout.split('X')[1]) || undefined : undefined}
                hideButtons size="small" style={{ width: '100%' }} min={1} max={99}
                onChange={(v) => {
                  const inputs = layoutRowRef.current?.querySelectorAll('.semi-input-number');
                  const aEl = inputs?.[0]?.querySelector('input') as HTMLInputElement | undefined;
                  const a = aEl ? String(Number(aEl.value) || '') : '';
                  const b = String(Number(v) || '');
                  onLayoutChange(layer.id, a && b ? `${a}X${b}` : b || '');
                }}
              />
            </div>
            {detail.layout && (
              <Button
                size="small"
                theme="solid"
                type="primary"
                block
                icon={<span style={{ fontSize: 12 }}>+</span>}
                onClick={onSwitchToItems}
                style={{ marginTop: 8 }}
              >
                放置物品
              </Button>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default LayerEditor;
