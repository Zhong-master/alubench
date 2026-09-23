/**
 * 测试专用替身：Semi 的入口桶文件会静态 import `lottie-web`，而它在模块加载期就执行
 * `canvas.getContext('2d').fillStyle = ...` —— jsdom 没有实现 `getContext`（除非装原生
 * canvas 包），于是整个测试文件在 import 阶段就抛 `Cannot set properties of null`。
 *
 * 本项目的界面没有用到 lottie 动画，因此只在测试时把这个依赖替换成空实现
 * （见 vite.config.ts 的 `test.alias`，**不影响生产构建**）。
 */
type AnimationStub = {
  destroy: () => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  addEventListener: () => void;
  removeEventListener: () => void;
  goToAndStop: () => void;
  goToAndPlay: () => void;
  setSpeed: () => void;
  setDirection: () => void;
  setSubframe: () => void;
};

const makeAnimation = (): AnimationStub => ({
  destroy: () => {},
  play: () => {},
  pause: () => {},
  stop: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  goToAndStop: () => {},
  goToAndPlay: () => {},
  setSpeed: () => {},
  setDirection: () => {},
  setSubframe: () => {},
});

const lottie = {
  loadAnimation: makeAnimation,
  destroy: () => {},
  setQuality: () => {},
  setLocationHref: () => {},
  registerAnimation: () => {},
  setSpeed: () => {},
  play: () => {},
  pause: () => {},
  stop: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

export default lottie;
export const loadAnimation = makeAnimation;
export const destroy = () => {};
export const setQuality = () => {};
export const setLocationHref = () => {};
