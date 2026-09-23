import { useState, useCallback } from 'react';
import { Collapse, Input, Button, Select, Tooltip, Toast } from '@douyinfe/semi-ui';
import DeferredNumberInput from './DeferredNumberInput';
import { IconPlus, IconMinus, IconCopy } from '@douyinfe/semi-icons';
import { duplicateLayer } from '../geometry/operations';
import { LAYER_CONFIG, PROFILE_SIZES, defaultLayerDetail } from './layerTypes';
import type { Layer, LayerType } from './layerTypes';
import { useT } from '../i18n';
import { LAYER_TYPE_KEY, localizeLayerLabel } from '../i18n/labels';

// 层数据模型已抽到 ./layerTypes（纯模块，无 React/UI 依赖，供 state.ts 反序列化校验复用）。
// 此处按原路径 re-export，既有 `import { Layer } from './LeftPanel'` 全部保持不变。
export type { Layer, LayerDetail, LayerType, PlacedItem } from './layerTypes';
export { LAYER_CONFIG } from './layerTypes';

/** 唯一层 ID 生成器 — 递增计数器，避免 Date.now() 在 <1ms 间隔内碰撞 */
let _layerIdCounter = 0;
function generateLayerId(type: string): string {
  return `${type}-${Date.now()}-${++_layerIdCounter}`;
}

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
  /** 新建/复制层后通知外层选中该层，让右侧参数面板立刻切到新层 */
  onLayerSelect?: (id: string | null) => void;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ layers, onLayersChange, dimensions, onDimensionsChange, profile, onProfileChange, columns, onColumnsChange, onLayerSelect }) => {
  const t = useT();
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
        // 默认参数与反序列化补全共用 defaultLayerDetail()，避免两处默认值漂移
        detail: {
          ...defaultLayerDetail(),
          length: defaultLength,
          width: defaultWidth,
          elevation: defaultElevation,
          locked: defaultLocked,
          topColumns: defaultTopCols,
        },
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

  // 复制层（仅台面/隔板），插入原层下方（原数组位置之后）。
  // 副本标高 +10mm 与原层几乎重合，3D 里看不出新增；因此复制后必须选中副本，
  // 让右侧面板直接显示新层的标高/尺寸供继续调整（与「放物品后选中物品」同一原则）。
  const duplicate = useCallback((id: string) => {
    const src = layers.find((l) => l.id === id);
    if (!src || src.type === 'top' || src.type === 'bottom') return;
    const copy = duplicateLayer(src);
    onLayersChange((prev: Layer[]) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx < 0) return prev;
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
    onLayerSelect?.(copy.id);
    Toast.success(t('toast.layerDuplicated', { label: t(LAYER_TYPE_KEY[src.type]) }));
  }, [layers, onLayersChange, onLayerSelect, t]);

  return (
    <div style={{ padding: '12px 8px' }}>
      <Collapse defaultActiveKey={['dimensions', 'columns', 'layers', 'profile']}>
        {/* 整体尺寸 */}
        <Collapse.Panel header={t('group.dimensions')} itemKey="dimensions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <DeferredNumberInput
              prefix={t('field.length')}
              suffix="mm"
              value={dimensions.width}
              onCommit={(n) => onDimensionsChange((d) => ({ ...d, width: n }))}
              style={{ width: '100%' }}
              min={1}
              max={10000}
              />
            <DeferredNumberInput
              prefix={t('field.width')}
              suffix="mm"
              value={dimensions.depth}
              onCommit={(n) => onDimensionsChange((d) => ({ ...d, depth: n }))}
              style={{ width: '100%' }}
              min={1}
              max={10000}
              />
            <DeferredNumberInput
              prefix={t('field.height')}
              suffix="mm"
              value={dimensions.height}
              onCommit={(n) => onDimensionsChange((d) => ({ ...d, height: n }))}
              style={{ width: '100%' }}
              min={1}
              max={10000}
              />
          </div>
        </Collapse.Panel>

        {/* 骨架编辑 */}
        <Collapse.Panel header={t('group.frame')} itemKey="columns">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <DeferredNumberInput prefix={t('field.front')} value={columns.front} min={0} max={20} style={{ width: '100%' }}
              onCommit={(n) => onColumnsChange((c) => ({ ...c, front: n }))} />
            <DeferredNumberInput prefix={t('field.back')} value={columns.back} min={0} max={20} style={{ width: '100%' }}
              onCommit={(n) => onColumnsChange((c) => ({ ...c, back: n }))} />
            <DeferredNumberInput prefix={t('field.left')} value={columns.left} min={0} max={20} style={{ width: '100%' }}
              onCommit={(n) => onColumnsChange((c) => ({ ...c, left: n }))} />
            <DeferredNumberInput prefix={t('field.right')} value={columns.right} min={0} max={20} style={{ width: '100%' }}
              onCommit={(n) => onColumnsChange((c) => ({ ...c, right: n }))} />
            <DeferredNumberInput prefix={t('field.top')} value={columns.top} min={0} max={20} style={{ width: '100%' }}
              onCommit={(n) => onColumnsChange((c) => ({ ...c, top: n }))} />
            <DeferredNumberInput prefix={t('field.bottom')} value={columns.bottom} min={0} max={20} style={{ width: '100%' }}
              onCommit={(n) => onColumnsChange((c) => ({ ...c, bottom: n }))} />
          </div>
          {/* 立柱截止层（选层后该侧立柱仅到该层底部，不选=全高） */}
          <div style={{ marginTop: 6, marginBottom: 6, fontSize: 12, color: 'var(--semi-color-text-2)' }}>{t('label.columnCap')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--semi-color-text-2)', marginBottom: 2 }}>{t('field.front')}</div>
              <Select value={columns.frontCap || ''} onChange={(v) => onColumnsChange((c) => ({ ...c, frontCap: (v as string) || '' }))} style={{ width: '100%' }} size="small" placeholder={t('label.fullHeight')}>
                <Select.Option value="">{t('label.fullHeight')}</Select.Option>
                {layers.map((l) => (
                  <Select.Option key={l.id} value={l.id}>{localizeLayerLabel(l.label, t)}{l.type === 'shelf' ? (() => { const shelves = layers.filter(s => s.type === 'shelf'); const idx = shelves.findIndex(s => s.id === l.id); return ` #${idx + 1}`; })() : ''} ({l.detail.elevation}mm)</Select.Option>
                ))}
              </Select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--semi-color-text-2)', marginBottom: 2 }}>{t('field.back')}</div>
              <Select value={columns.backCap || ''} onChange={(v) => onColumnsChange((c) => ({ ...c, backCap: (v as string) || '' }))} style={{ width: '100%' }} size="small" placeholder={t('label.fullHeight')}>
                <Select.Option value="">{t('label.fullHeight')}</Select.Option>
                {layers.map((l) => (
                  <Select.Option key={l.id} value={l.id}>{localizeLayerLabel(l.label, t)}{l.type === 'shelf' ? (() => { const shelves = layers.filter(s => s.type === 'shelf'); const idx = shelves.findIndex(s => s.id === l.id); return ` #${idx + 1}`; })() : ''} ({l.detail.elevation}mm)</Select.Option>
                ))}
              </Select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--semi-color-text-2)', marginBottom: 2 }}>{t('field.left')}</div>
              <Select value={columns.leftCap || ''} onChange={(v) => onColumnsChange((c) => ({ ...c, leftCap: (v as string) || '' }))} style={{ width: '100%' }} size="small" placeholder={t('label.fullHeight')}>
                <Select.Option value="">{t('label.fullHeight')}</Select.Option>
                {layers.map((l) => (
                  <Select.Option key={l.id} value={l.id}>{localizeLayerLabel(l.label, t)}{l.type === 'shelf' ? (() => { const shelves = layers.filter(s => s.type === 'shelf'); const idx = shelves.findIndex(s => s.id === l.id); return ` #${idx + 1}`; })() : ''} ({l.detail.elevation}mm)</Select.Option>
                ))}
              </Select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--semi-color-text-2)', marginBottom: 2 }}>{t('field.right')}</div>
              <Select value={columns.rightCap || ''} onChange={(v) => onColumnsChange((c) => ({ ...c, rightCap: (v as string) || '' }))} style={{ width: '100%' }} size="small" placeholder={t('label.fullHeight')}>
                <Select.Option value="">{t('label.fullHeight')}</Select.Option>
                {layers.map((l) => (
                  <Select.Option key={l.id} value={l.id}>{localizeLayerLabel(l.label, t)}{l.type === 'shelf' ? (() => { const shelves = layers.filter(s => s.type === 'shelf'); const idx = shelves.findIndex(s => s.id === l.id); return ` #${idx + 1}`; })() : ''} ({l.detail.elevation}mm)</Select.Option>
                ))}
              </Select>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)', whiteSpace: 'nowrap' }}>{t('label.bottomFrame')}</span>
            <Select
              value={columns.bottomFrame || 'full'}
              onChange={(v) => onColumnsChange((c) => ({ ...c, bottomFrame: (v || 'full') as 'full' | 'frontback' | 'leftright' | 'none' }))}
              style={{ flex: 1 }} size="small"
            >
              <Select.Option value="full">{t('option.frameFull')}</Select.Option>
              <Select.Option value="frontback">{t('option.frameFrontBack')}</Select.Option>
              <Select.Option value="leftright">{t('option.frameLeftRight')}</Select.Option>
              <Select.Option value="none">{t('option.frameNone')}</Select.Option>
            </Select>
          </div>
        </Collapse.Panel>

        {/* 层结构 */}
        <Collapse.Panel header={t('group.layers')} itemKey="layers">
          <div style={{ maxHeight: 220, overflow: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
            {ADD_ORDER.map((type) => {
              const cfg = LAYER_CONFIG[type];
              const count = getLayerCount(type);
              const disabled = count >= cfg.maxCount;
              return (
                // 禁用态按钮不派发鼠标事件，Tooltip 必须挂在包裹元素上，否则用户
                // 只看到一个灰按钮、不知道为何不能点（顶板/台面/底板各限 1 个）
                <Tooltip
                  key={type}
                  content={disabled ? t('tip.addLayerMax', { label: t(LAYER_TYPE_KEY[type]), n: cfg.maxCount }) : t('tip.addLayer', { label: t(LAYER_TYPE_KEY[type]) })}
                >
                  <span style={{ display: 'inline-block', width: '100%' }}>
                    <Button
                      size="small"
                      icon={<IconPlus size="extra-small" />}
                      disabled={disabled}
                      onClick={() => addLayer(type)}
                      style={{
                        width: '100%',
                        fontSize: 11,
                        padding: '2px 6px',
                        borderColor: disabled ? undefined : cfg.color,
                        color: disabled ? undefined : cfg.color,
                      }}
                    >
                      {t(LAYER_TYPE_KEY[type])}
                    </Button>
                  </span>
                </Tooltip>
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
                  <span style={{ fontSize: 12 }}>{localizeLayerLabel(layer.label, t)}</span>
                  {layer.type === 'shelf' && (() => {
                    const shelves = layers.filter((l) => l.type === 'shelf');
                    const idx = shelves.findIndex((l) => l.id === layer.id);
                    return <span style={{ fontSize: 10, color: 'var(--semi-color-text-2)' }}>#{idx + 1}</span>;
                  })()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {layer.type !== 'top' && layer.type !== 'bottom' && (
                    <Tooltip content={t('tip.duplicateLayer')}>
                      <Button
                        theme="borderless"
                        size="small"
                        icon={<IconCopy size="extra-small" />}
                        onClick={() => duplicate(layer.id)}
                        style={{ color: 'var(--semi-color-text-2)', padding: 0, minWidth: 20 }}
                      />
                    </Tooltip>
                  )}
                  <Tooltip content={t('tip.deleteLayer')}>
                    <Button
                      theme="borderless"
                      size="small"
                      icon={<IconMinus size="extra-small" />}
                      onClick={() => removeLayer(layer.id)}
                      style={{ color: 'var(--semi-color-danger)', padding: 0, minWidth: 20 }}
                    />
                  </Tooltip>
                </div>
              </div>
            ))}
            {layers.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>{t('empty.noLayers')}</span>
            )}
          </div>
          </div>
        </Collapse.Panel>

        {/* 型材型号 */}
        <Collapse.Panel header={t('group.profile')} itemKey="profile">
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
                placeholder={t('placeholder.standard')}
                style={{ flex: 1 }}
                size="small"
              >
                <Select.Option value="GB">{t('option.gb')}</Select.Option>
                <Select.Option value="EU">{t('option.eu')}</Select.Option>
                <Select.Option value="JIS">{t('option.jis')}</Select.Option>
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
                placeholder={t('placeholder.spec')}
                style={{ flex: 1 }}
                size="small"
                disabled={!profile[0]}
              >
                {PROFILE_SIZES.map((m) => (
                  <Select.Option key={m} value={m}>{m}</Select.Option>
                ))}
              </Select>
            </div>
            <Input
              prefix={t('field.customPrefix')}
              placeholder={t('placeholder.customSpec')}
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
