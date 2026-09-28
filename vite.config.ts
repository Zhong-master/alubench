import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 部署基路径：默认根路径（Docker / npm 包 / 本地 dev 都用它）；
  // GitHub Pages 是项目子路径站点，用 `BASE_PATH=/alubench/ npm run build` 构建。
  base: process.env.BASE_PATH || '/',
  build: {
    // 产出 asset-manifest.json：Service Worker 安装时据此预缓存全部产物（含动态导入的
    // exportHtml 分块 —— 它不在 index.html 里，只解析 HTML 会漏掉，导致首次访问后断网导不出）。
    // 故意不用 Vite 默认的 `.vite/manifest.json`：隐藏目录会被 nginx 等静态服务器的点文件
    // 规则拒发，而这里 nginx / npm CLI / GitHub Pages 三种托管都要能取到。
    manifest: 'asset-manifest.json',
  },
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
