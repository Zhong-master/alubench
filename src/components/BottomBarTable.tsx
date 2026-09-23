import { useMemo } from 'react';
import { Button, Table, Tooltip } from '@douyinfe/semi-ui';
import type { ColumnProps, Data } from '@douyinfe/semi-ui/lib/es/table/interface';
import { IconHandle, IconChevronUp, IconChevronDown } from '@douyinfe/semi-icons';
import { useT } from '../i18n';
import { localizeLayerLabel } from '../i18n/labels';
import type { MessageKey } from '../i18n/messages';
import type { Layer } from './LeftPanel';
import { ITEM_MAP } from './items';

interface BottomBarProps {
  layers: Layer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragEnd: () => void;
  /** 窄屏/触摸端：表格右侧显示上移/下移按钮（HTML5 拖拽在触摸屏上不触发事件） */
  compact?: boolean;
  onMoveLayer?: (id: string, dir: -1 | 1) => void;
}

const COLUMNS = (layers: Layer[], t: (k: MessageKey) => string) => [
  {
    title: '',
    dataIndex: 'drag',
    width: 32,
    render: (_: unknown, record: Layer) => {
      const canDrag = record.type === 'countertop' || record.type === 'shelf';
      return canDrag ? (
        <Tooltip content={t('layer.dragTip')} position="right" mouseEnterDelay={0.5}>
          <span style={{ cursor: 'grab', display: 'inline-flex', alignItems: 'center', color: 'var(--semi-color-text-2)' }}>
            <IconHandle size="small" />
          </span>
        </Tooltip>
      ) : null;
    },
  },
  {
    title: '',
    dataIndex: 'lock',
    width: 22,
    render: (_: unknown, record: Layer) => (
      <span style={{ fontSize: 11, lineHeight: 1, color: record.detail.locked ? 'var(--semi-color-primary)' : 'var(--semi-color-text-3)' }}>
        {record.detail.locked ? '🔒' : '🔓'}
      </span>
    ),
  },
  {
    title: t('layer.type'), dataIndex: 'label', width: 40,
    render: (_: unknown, record: Layer) => (
      <span style={{ fontSize: 12, fontWeight: 500 }}>{localizeLayerLabel(record.label, t)}</span>
    ),
  },
  {
    title: 'ID', dataIndex: 'id', width: 32,
    render: (_: unknown, record: Layer) => {
      if (record.type === 'shelf') {
        const shelves = layers.filter((l) => l.type === 'shelf');
        const idx = shelves.findIndex((l) => l.id === record.id);
        return <span style={{ fontSize: 11, color: 'var(--semi-color-text-2)' }}>#{idx + 1}</span>;
      }
      return <span style={{ fontSize: 11, color: 'var(--semi-color-text-2)' }}>-</span>;
    },
  },
  {
    title: t('layer.length'), dataIndex: 'detail.length', width: 60,
    render: (_: unknown, record: Layer) => <span style={{ fontSize: 12 }}>{record.detail.length}</span>,
  },
  {
    title: t('layer.width'), dataIndex: 'detail.width', width: 60,
    render: (_: unknown, record: Layer) => <span style={{ fontSize: 12 }}>{record.detail.width}</span>,
  },
  {
    title: t('layer.elevation'), dataIndex: 'detail.elevation', width: 60,
    render: (_: unknown, record: Layer) => <span style={{ fontSize: 12 }}>{record.detail.elevation}</span>,
  },
  {
    title: t('layer.thickness'), dataIndex: 'detail.thickness', width: 60,
    render: (_: unknown, record: Layer) => <span style={{ fontSize: 12 }}>{record.detail.thickness}</span>,
  },
  {
    title: t('layer.layout'), dataIndex: 'detail.layout', width: 48,
    render: (_: unknown, record: Layer) => (
      <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
        {record.detail.layout ? record.detail.layout.replace('X', ' × ') : '-'}
      </span>
    ),
  },
  {
    title: t('layer.items'), dataIndex: 'detail.placedItems', width: 120,
    render: (_: unknown, record: Layer) => {
      const items = record.detail.placedItems;
      if (!items || items.length === 0) return <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>-</span>;
      // 按类型分组统计
      const counts = new Map<string, number>();
      for (const pi of items) {
        const info = ITEM_MAP.get(pi.itemType);
        const name = info?.name || pi.itemType;
        counts.set(name, (counts.get(name) || 0) + 1);
      }
      const text = Array.from(counts.entries())
        .map(([name, count]) => count > 1 ? `${name}×${count}` : name)
        .join('、');
      return (
        <span style={{ fontSize: 12, color: 'var(--semi-color-text-0)' }}>
          {text}
        </span>
      );
    },
  },
];

const BottomBarTable: React.FC<BottomBarProps> = ({ layers, selectedId, onSelect, onDragStart, onDragOver, onDragEnd, compact, onMoveLayer }) => {
  const t = useT();
  const columns = useMemo(() => {
    const base = COLUMNS(layers, t);
    if (!compact || !onMoveLayer) return base;
    // 触摸端 ⠿ 拖拽把手无效（HTML5 拖拽不派发事件），直接用它占的首列换成上移/下移——
    // 若把排序列追加到末尾会落到横向滚动区之外（实测 390px 视口下按钮在 x=651，够不到）
    const rest = base.filter((c) => (c as { dataIndex?: string }).dataIndex !== 'drag');
    return [
      {
        title: t('layer.order'),
        width: 84,
        render: (_: unknown, record: Layer) => {
          if (record.type !== 'countertop' && record.type !== 'shelf') return null;
          return (
            <div style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
              <Tooltip content={t('layer.moveUp')} position="top">
                <Button size="small" theme="borderless" icon={<IconChevronUp size="small" />} onClick={() => onMoveLayer(record.id, -1)} />
              </Tooltip>
              <Tooltip content={t('layer.moveDown')} position="top">
                <Button size="small" theme="borderless" icon={<IconChevronDown size="small" />} onClick={() => onMoveLayer(record.id, 1)} />
              </Tooltip>
            </div>
          );
        },
      },
      ...rest,
    ] as unknown as ColumnProps<Data>[];
  }, [layers, compact, onMoveLayer, t]);

  const dataSource = useMemo(
    () => layers.map((layer) => ({ ...layer, key: layer.id })),
    [layers]
  );

  return (
    <Table<Data>
      columns={columns as unknown as ColumnProps<Data>[]}
      dataSource={dataSource}
      size="small"
      pagination={false}
      showHeader={true}
      onRow={(record) => {
        const l = record as Layer | undefined;
        if (!l || !l.type) return {};
        const isSelected = selectedId === l.id;
        const canDrag = l.type === 'countertop' || l.type === 'shelf';
        return {
          onClick: () => onSelect(isSelected ? null : l.id),
          style: { cursor: 'pointer', background: isSelected ? 'rgba(79, 140, 255, 0.15)' : undefined },
          draggable: canDrag,
          onDragStart: canDrag ? () => onDragStart(l.id) : undefined,
          onDragOver: canDrag ? (e: React.DragEvent) => { e.preventDefault(); onDragOver(l.id); } : undefined,
          onDragEnd: canDrag ? () => onDragEnd() : undefined,
        };
      }}
    />
  );
};

export default BottomBarTable;
