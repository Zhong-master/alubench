// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeferredNumberInput from '../DeferredNumberInput';

/**
 * 这些用例守住的历史缺陷（第 7 轮，当时靠手工 CDP 才发现）：
 *
 * 直接把 Semi `InputNumber.onChange` 接到场景状态上时，**每敲一个字符**都会提交一次，
 * 中间值会真实写入场景 —— 机架「长」输 2000 途中的 `2`(mm) 会把自定义尺寸的层夹死，
 * 布局「列」输 12 途中的 `1` 会经 remapPlacedItems 永久删掉 col>0 的物品。
 * 修复靠的就是这个组件「本地草稿 + 失焦/回车提交一次」。
 *
 * 若有人把提交改回 onChange（或去掉夹取），下面的用例会立刻失败。
 */
// vitest 默认不开 globals，RTL 的自动卸载不生效；不显式卸载会积累未清理的
// Semi 组件句柄，整个文件跑完时进程不退出（表现为「跑了很久没有任何输出」）。
afterEach(cleanup);

const setup = (props: Partial<React.ComponentProps<typeof DeferredNumberInput>> = {}) => {
  const onCommit = vi.fn();
  const utils = render(<DeferredNumberInput value={3} onCommit={onCommit} {...props} />);
  const input = () => utils.container.querySelector('input') as HTMLInputElement;
  return { onCommit, input, ...utils };
};

describe('DeferredNumberInput —— 失焦/回车才提交', () => {
  it('逐字符输入期间一次都不提交（中途值不得进入场景）', async () => {
    const { onCommit, input } = setup({ min: 1, max: 10000 });
    const user = userEvent.setup();
    await user.clear(input());
    await user.type(input(), '1200'); // 途中依次出现 '1' '12' '120'
    expect(onCommit).toHaveBeenCalledTimes(0);
  });

  it('失焦时提交一次，且提交的是最终值', async () => {
    const { onCommit, input } = setup({ min: 1, max: 10000 });
    const user = userEvent.setup();
    await user.clear(input());
    await user.type(input(), '1200');
    await user.tab(); // 失焦
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(1200);
  });

  it('回车提交一次（Semi 的 InputNumber 没有 onEnterPress，走 onKeyDown）', async () => {
    const { onCommit, input } = setup({ min: 1, max: 10000 });
    const user = userEvent.setup();
    await user.clear(input());
    await user.type(input(), '850{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(850);
  });

  it('超出 max / min 时按边界夹取后再提交', async () => {
    const { onCommit, input } = setup({ value: 3, min: 1, max: 10000 });
    const user = userEvent.setup();
    await user.clear(input());
    await user.type(input(), '20000');
    await user.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(10000);
  });

  it('Escape 放弃编辑：不提交，且显示值回到上游值', async () => {
    const { onCommit, input } = setup({ min: 1, max: 10000 });
    const user = userEvent.setup();
    await user.clear(input());
    await user.type(input(), '999');
    // 放弃编辑会重新挂载输入框（见组件内注释），这里用底层 keyDown 触发，避免
    // userEvent 对「事件中被卸载的元素」继续模拟后续按键
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(onCommit).toHaveBeenCalledTimes(0);
    expect(input().value).toBe('3');
  });

  it('提交与上游相同的值时不回调（避免白占一次撤销栈）', async () => {
    const { onCommit, input } = setup({ value: 7, min: 0, max: 100 });
    const user = userEvent.setup();
    await user.clear(input());
    await user.type(input(), '7');
    await user.tab();
    expect(onCommit).toHaveBeenCalledTimes(0);
    expect(input().value).toBe('7');
  });

  it('清空后失焦不提交，显示值回到上游值（不允许空值入场景）', async () => {
    const { onCommit, input } = setup({ value: 12, min: 1, max: 100 });
    const user = userEvent.setup();
    await user.clear(input());
    await user.tab();
    expect(onCommit).toHaveBeenCalledTimes(0);
    expect(input().value).toBe('12');
  });

  it('disabled 时输入框确实禁用（锁定层的长/宽不可手改）', () => {
    const { input } = setup({ disabled: true });
    expect(input().disabled).toBe(true);
  });
});
