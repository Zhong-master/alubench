import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // 默认环境保持 node：几何内核的纯函数测试不需要 DOM，跑得更快。
    // 需要 DOM 的测试在文件首行声明 `// @vitest-environment jsdom`（如
    // DeferredNumberInput / LayerEditor 的交互测试）。
    include: ['src/**/*.test.{ts,tsx}'],
    // 测试专用别名：Semi 桶文件静态 import 的 lottie-web 在加载期就要 2D canvas 上下文，
    // jsdom 未实现 getContext（除非引入原生 canvas 包）。本界面不使用 lottie，
    // 故仅在测试中替换为空实现；生产构建不受影响（不在 resolve.alias 里）。
    alias: {
      'lottie-web': new URL('./src/test/lottie-stub.ts', import.meta.url).pathname,
    },
  },
});
