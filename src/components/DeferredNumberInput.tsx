import React, { useEffect, useRef, useState } from 'react';
import { InputNumber } from '@douyinfe/semi-ui';

export interface DeferredNumberInputProps {
  value: number | undefined;
  /** 失焦 / 回车时提交（同一值不会重复提交） */
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  placeholder?: string;
  size?: 'small' | 'default' | 'large';
  style?: React.CSSProperties;
}

/**
 * 「失焦 / 回车才提交」的数值输入框。
 *
 * 为什么不能直接把 Semi 的 `onChange` 接到场景状态上：它**每敲一个字符**就触发一次，
 * 而每次提交都会走「状态 → 全量几何重建 → 全场景重渲染」（大场景实测单次约 0.85s），
 * 于是一句「2000」要付 4 次重建的卡顿；更严重的是**中间值会真实写入场景**：
 *
 * - 机架「长」输入 2000 途中的 `2` / `20` / `200`（单位 mm）会把用户自定义尺寸的层
 *   夹到 2mm 并就此定死（`applyDimensionChange` 的逐轴跟随规则无法回滚）
 * - 布局「列」输入 12 途中的 `1` 会经 `remapPlacedItems` **永久删除所有 col>0 的物品**
 * - 层「标高/厚度/长/宽」同理：每个字符都重建一次全场景几何
 *
 * 因此这里保留本地草稿（字符串，允许中途清空），只在 blur / Enter 时提交一次，
 * 并按 min/max 自行夹取，避免依赖组件内部的夹取时机。
 *
 * 对应的回归测试：`src/components/__tests__/DeferredNumberInput.dom.test.tsx`
 */
const DeferredNumberInput: React.FC<DeferredNumberInputProps> = ({
  value, onCommit, min, max, ...rest
}) => {
  const [draft, setDraft] = useState<number | string>(value ?? '');
  /** 每次「放弃编辑」自增：作为 key 强制 Semi 重新挂载，用它自己的 value 重建内部编辑态 */
  const [epoch, setEpoch] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // 上游值变化（提交生效、撤销、切换选中层）时同步草稿
  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  // 放弃编辑会重新挂载输入框，需把焦点还给输入框，否则按 Escape 会丢光标
  useEffect(() => {
    if (epoch === 0) return;
    wrapRef.current?.querySelector('input')?.focus();
  }, [epoch]);

  /**
   * 放弃编辑：数据与**显示文本**一起回滚到上游值。
   *
   * 只 `setDraft` 不够：Semi 的 `InputNumber` 有自己的内部编辑态，**输入框聚焦期间不会**
   * 把 `value` prop 回写到显示文本（实测：按 Escape 后数据已回到 550、屏幕上仍是 999），
   * 用户会以为 Escape 没生效、甚至以为那个值会被采用。
   *
   * 也不能用 `forwardedRef` 直接回写 DOM —— 实测该 prop 在本版 Semi + React 19 下是死的
   * （ref 回调根本不会被调用，`.current` 恒为 null）。因此改用 key 重新挂载：让 Semi
   * 用回滚后的 value 重建内部状态，显示自然正确。
   */
  const revert = () => {
    setDraft(value ?? '');
    setEpoch((e) => e + 1);
  };

  const commit = () => {
    const n = Number(draft);
    if (draft === '' || !Number.isFinite(n)) {
      revert();
      return;
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    if (clamped !== value) onCommit(clamped);
    else revert();
  };

  return (
    // display: contents —— 包裹元素不产生盒子，不改变调用方既有的宽度/网格布局
    <span ref={wrapRef} style={{ display: 'contents' }}>
      <InputNumber
        {...rest}
        key={epoch}
        value={draft}
        min={min}
        max={max}
        hideButtons
        onChange={(v) => setDraft(v === '' || v === null || v === undefined ? '' : v)}
        onBlur={commit}
        // Semi 的 InputNumber 没有 onEnterPress（那是 Input 的 prop），回车走 onKeyDown
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') revert();
        }}
      />
    </span>
  );
};

export default DeferredNumberInput;
