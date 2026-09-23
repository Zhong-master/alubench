import { useRef } from 'react';
import { Button, Select, Tooltip } from '@douyinfe/semi-ui';
import DeferredNumberInput from './DeferredNumberInput';
import { PROFILE_SIZES } from './layerTypes';
import { useT } from '../i18n';
import { LAYER_TYPE_KEY } from '../i18n/labels';
import type { Layer, LayerDetail } from './LeftPanel';

interface LayerEditorProps {
  layer: Layer | null;
  /** 隔板序号（仅 shelf 类型有意义，用于标题显示 #N） */
  shelfNumber?: number;
  dimensions: { width: number; depth: number; height: number };
  /** 机架主型材 [标准, 规格]，用于渲染「跟随机架（GB-4040）」与各规格选项 */
  profile: string[];
  onDetailChange: (id: string, field: string, value: number) => void;
  onLayoutChange: (id: string, layout: string) => void;
  onLockToggle: (id: string) => void;
  onLayerPropChange: (id: string, field: string, value: unknown) => void;
  onSwitchToItems: () => void;
}

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

/** 层参数数值输入（可锁定时禁用）；失焦/回车才提交，见 DeferredNumberInput */
const Num: React.FC<NumProps> = ({ value, min, max, disabled, onChange }) => (
  <DeferredNumberInput
    value={value} size="small" style={{ width: '100%' }}
    min={min ?? 0.1} max={max}
    disabled={disabled}
    onCommit={onChange}
  />
);

const LayerEditor: React.FC<LayerEditorProps> = ({ layer, shelfNumber, dimensions, profile, onDetailChange, onLayoutChange, onLockToggle, onLayerPropChange, onSwitchToItems }) => {
  const t = useT();
  const layoutRowRef = useRef<HTMLDivElement>(null);

  if (!layer) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: 'var(--semi-color-text-2)', textAlign: 'center' }}>
        {t('editor.pickLayer')}
      </div>
    );
  }

  const { detail } = layer;
  /** 顶板/台面/隔板有边框型材；底板只有板本身 */
  const hasFrame = layer.type === 'top' || layer.type === 'countertop' || layer.type === 'shelf';
  const profileStd = profile[0] || 'GB';
  const globalSpecLabel = profile[0] ? `${profile[0]}-${profile[1]}` : t('common.custom');

  return (
    <div style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: layer.color }}>
          {t(LAYER_TYPE_KEY[layer.type])}{layer.type === 'shelf' && shelfNumber ? ` #${shelfNumber}` : ''}
        </span>
        <Tooltip
          position="bottomRight"
          content={detail.locked
            ? t('editor.lockedTip')
            : t('editor.unlockedTip')}
        >
          <Button
            theme="borderless" size="small"
            icon={<span style={{ fontSize: 14 }}>{detail.locked ? '🔒' : '🔓'}</span>}
            onClick={() => onLockToggle(layer.id)}
            style={{ color: detail.locked ? 'var(--semi-color-primary)' : 'var(--semi-color-text-2)' }}
          />
        </Tooltip>
      </div>

      {/* 统一底板 */}
      <div style={panel}>

        {/* ── 尺寸 ── */}
        <div style={sectionTitle}>{t('section.size')}</div>
        <div style={row}>
          <div style={fieldWrap}>
            <div style={label}>{t('layer.length')}</div>
            <Num value={detail.length} min={1} max={dimensions.width} disabled={detail.locked} onChange={(v) => onDetailChange(layer.id, 'length', v)} />
          </div>
          <div style={fieldWrap}>
            <div style={label}>{t('layer.width')}</div>
            <Num value={detail.width} min={1} max={dimensions.depth} disabled={detail.locked} onChange={(v) => onDetailChange(layer.id, 'width', v)} />
          </div>
        </div>
        <div style={row}>
          <div style={fieldWrap}>
            <div style={label}>{t('layer.elevation')}</div>
            <Num value={detail.elevation} min={0} max={dimensions.height}
              disabled={layer.type === 'top' || layer.type === 'bottom'}
              onChange={(v) => onDetailChange(layer.id, 'elevation', v)} />
          </div>
          <div style={fieldWrap}>
            <div style={label}>{t('layer.thickness')}</div>
            <Num value={detail.thickness} min={0.1} max={dimensions.height} disabled={detail.locked} onChange={(v) => onDetailChange(layer.id, 'thickness', v)} />
          </div>
        </div>

        {/* ── 本层边框型材（覆盖机架主型材，影响该层边框下料长度与 BOM 规格） ── */}
        {hasFrame && (
          <div style={{ ...fieldWrap, marginTop: 10 }}>
            <div style={label}>{t('label.edgeProfile')}</div>
            <Tooltip content={t('tip.edgeProfile')} position="left">
              <Select
                value={detail.profileType || ''}
                onChange={(v) => onLayerPropChange(layer.id, 'profileType', v)}
                style={{ width: '100%' }}
                size="small"
                disabled={detail.locked}
              >
                <Select.Option value="">{t('option.followFrame', { spec: globalSpecLabel })}</Select.Option>
                {PROFILE_SIZES.map((m) => (
                  <Select.Option key={m} value={`${profileStd}-${m}`}>{`${profileStd}-${m}`}</Select.Option>
                ))}
              </Select>
            </Tooltip>
          </div>
        )}
        {/* ── 结构 ── */}
        {(layer.type === 'countertop' || layer.type === 'shelf') && (
          <>
            <div style={divider} />
            <div style={sectionTitle}>{t('section.structure')}</div>

            <div style={fieldWrap}>
              <div style={label}>{t('label.frontConnect')}</div>
              {detail.width >= dimensions.depth ? (
                <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', padding: '4px 0' }}>
                  {t('hint.autoExtend')}
                </div>
              ) : (
                <Select
                  value={detail.frontConnect || 'extend'}
                  onChange={(v) => onLayerPropChange(layer.id, 'frontConnect', v)}
                  style={{ width: '100%' }} size="small"
                >
                  <Select.Option value="extend">{t('option.connectExtend')}</Select.Option>
                  <Select.Option value="up">{t('option.connectUp')}</Select.Option>
                  <Select.Option value="down">{t('option.connectDown')}</Select.Option>
                </Select>
              )}
            </div>

            {/* 搁板对齐位置 */}
            {detail.width < dimensions.depth && (
              <div style={fieldWrap}>
                <div style={label}>{t('label.halign')}</div>
                <Select
                  value={detail.halign || 'left'}
                  onChange={(v) => onLayerPropChange(layer.id, 'halign', v)}
                  style={{ width: '100%' }} size="small"
                >
                  <Select.Option value="left">{t('option.alignLeft')}</Select.Option>
                  <Select.Option value="center">{t('option.alignCenter')}</Select.Option>
                  <Select.Option value="right">{t('option.alignRight')}</Select.Option>
                </Select>
              </div>
            )}

            <div style={{ ...fieldWrap, marginBottom: 0 }}>
              <div style={label}>{t('label.ribs')}</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <Num value={detail.ribCount} min={0} max={20} disabled={detail.locked} onChange={(v) => onDetailChange(layer.id, 'ribCount', v)} />
                <Button
                  size="small"
                  onClick={() => onLayerPropChange(layer.id, 'ribDirection', detail.ribDirection === 'x' ? 'z' : 'x')}
                  style={{ fontSize: 11, padding: '2px 6px', minWidth: 40, flexShrink: 0 }}
                >
                  {detail.ribDirection === 'x' ? t('option.ribX') : t('option.ribZ')}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── 顶板立杆 ── */}
        {layer.type === 'top' && (
          <>
            <div style={divider} />
            <div style={sectionTitle}>{t('section.uprights')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {([
                { key: 'fl', label: t('corner.fl') },
                { key: 'fr', label: t('corner.fr') },
                { key: 'bl', label: t('corner.bl') },
                { key: 'br', label: t('corner.br') },
              ] as Array<{ key: keyof NonNullable<LayerDetail['topColumns']>; label: string }>).map(({ key, label: lb }) => (
                <label key={key} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={detail.topColumns?.[key] ?? true}
                    onChange={(e) => onLayerPropChange(layer.id, 'topColumns', { ...detail.topColumns, [key]: e.target.checked })} />
                  {lb}
                </label>
              ))}
            </div>
            {[detail.topColumns?.fl, detail.topColumns?.fr, detail.topColumns?.bl, detail.topColumns?.br].filter(Boolean).length < 2 && (
              <div style={{ fontSize: 11, color: 'var(--semi-color-danger)', marginTop: 4 }}>{t('hint.needTwoUprights')}</div>
            )}
          </>
        )}

        {/* ── 布局 ── */}
        {(layer.type === 'countertop' || layer.type === 'shelf') && (
          <>
            <div style={divider} />
            <div style={sectionTitle}>{t('section.layout')}</div>
            <div ref={layoutRowRef} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <DeferredNumberInput
                value={detail.layout ? Number(detail.layout.split('X')[0]) || undefined : undefined}
                size="small" style={{ width: '100%' }} min={1} max={99}
                onCommit={(v) => {
                  const a = String(Number(v) || '');
                  const inputs = layoutRowRef.current?.querySelectorAll('.semi-input-number');
                  const bEl = inputs?.[1]?.querySelector('input') as HTMLInputElement | undefined;
                  const b = bEl ? String(Number(bEl.value) || '') : '';
                  onLayoutChange(layer.id, a && b ? `${a}X${b}` : a || '');
                }}
              />
              <span style={{ color: 'var(--semi-color-text-2)', fontSize: 13, flexShrink: 0 }}>×</span>
              <DeferredNumberInput
                value={detail.layout ? Number(detail.layout.split('X')[1]) || undefined : undefined}
                size="small" style={{ width: '100%' }} min={1} max={99}
                onCommit={(v) => {
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
                {t('action.placeItem')}
              </Button>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default LayerEditor;
