import { useMemo } from 'react';
import { Table } from '@douyinfe/semi-ui';
import type { ColumnProps, Data } from '@douyinfe/semi-ui/lib/es/table/interface';
import { IconHandle } from '@douyinfe/semi-icons';
import type { Layer } from './LeftPanel';
import { ITEM_MAP } from './items';

interface BottomBarProps {
  layers: Layer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragEnd: () => void;
}

const COLUMNS = (layers: Layer[]) => [
  {
    title: '',
    dataIndex: 'drag',
    width: 32,
    render: (_: unknown, record: Layer) => {
      const canDrag = record.type === 'countertop' || record.type === 'shelf';
      return canDrag ? (
        <span style={{ cursor: 'grab', display: 'inline-flex', alignItems: 'center', color: 'var(--semi-color-text-2)' }}>
          <IconHandle size="small" />
        </span>
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
    title: '层', dataIndex: 'label', width: 40,
    render: (_: unknown, record: Layer) => <span style={{ fontSize: 12, fontWeight: 500 }}>{record.label}</span>,
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
    title: '长(mm)', dataIndex: 'detail.length', width: 60,
    render: (_: unknown, record: Layer) => <span style={{ fontSize: 12 }}>{record.detail.length}</span>,
  },
  {
    title: '宽(mm)', dataIndex: 'detail.width', width: 60,
    render: (_: unknown, record: Layer) => <span style={{ fontSize: 12 }}>{record.detail.width}</span>,
  },
  {
    title: '标高(mm)', dataIndex: 'detail.elevation', width: 60,
    render: (_: unknown, record: Layer) => <span style={{ fontSize: 12 }}>{record.detail.elevation}</span>,
  },
  {
    title: '厚度(mm)', dataIndex: 'detail.thickness', width: 60,
    render: (_: unknown, record: Layer) => <span style={{ fontSize: 12 }}>{record.detail.thickness}</span>,
  },
  {
    title: '布局', dataIndex: 'detail.layout', width: 48,
    render: (_: unknown, record: Layer) => (
      <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
        {record.detail.layout ? record.detail.layout.replace('X', ' × ') : '-'}
      </span>
    ),
  },
  {
    title: '物品', dataIndex: 'detail.items', width: 120,
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

const BottomBarTable: React.FC<BottomBarProps> = ({ layers, selectedId, onSelect, onDragStart, onDragOver, onDragEnd }) => {
  const columns = useMemo(
    () => COLUMNS(layers),
    [layers]
  );

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
