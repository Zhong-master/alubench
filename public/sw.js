/*
 * VisionAI 3D Workbench — Service Worker（手写，无第三方依赖，保持"轻"）
 *
 * 目标：安装到桌面后**离线可用**（工业现场/内网常常没有外网）。
 * 策略（三条，按请求类型分流）：
 *   1. 导航请求（HTML）      → 网络优先，失败回落到缓存的 index.html（SPA 离线入口）
 *   2. /assets/*（带内容哈希）→ 缓存优先。Vite 产物文件名含哈希，内容变了文件名就变，永不脏读
 *   3. 其它同源静态资源        → 陈旧优先 + 后台更新（图标、manifest 等）
 * 只拦截同源 GET：跨域（采购平台搜索链接等）与导出 HTML 的 blob 一律不碰。
 *
 * ⚠️ 部署新版本时**不需要**改这个文件：index.html 走网络优先，新版本的哈希资源会自动重新缓存，
 *    `activate` 里会清掉旧版本缓存。只有当"缓存策略本身"改了才需要动 `CACHE_VERSION`。
 */
const CACHE_VERSION = 'v2';
const CACHE_NAME = `visionai-workbench-${CACHE_VERSION}`;

/** 安装阶段预缓存应用外壳（保证首次离线访问也能打开） */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // 逐个 add：任一资源 404 不让整次安装失败（否则 SW 永远装不上）
      await Promise.all(
        PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

/** 只缓存"可用的完整响应"：避免把 404/206/不透明响应塞进缓存 */
function isCacheable(response) {
  return response && response.ok && response.status === 200 && response.type === 'basic';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 跨域不拦截（采购平台链接等）

  // 1) 导航：网络优先 → 离线回落 index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (isCacheable(fresh)) {
            const cache = await caches.open(CACHE_NAME);
            cache.put('/index.html', fresh.clone());
          }
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match('/index.html')) ||
            (await cache.match('/')) ||
            new Response('离线且无缓存，请在联网状态下先打开一次。', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        }
      })()
    );
    return;
  }

  // 2) 哈希资源：缓存优先
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const hit = await cache.match(request);
        if (hit) return hit;
        const fresh = await fetch(request);
        if (isCacheable(fresh)) cache.put(request, fresh.clone());
        return fresh;
      })()
    );
    return;
  }

  // 3) 其它同源资源：缓存优先，未命中走网络
  // ⚠️ 只对 /icons/ 写缓存：否则"缺失路径回退到 index.html"的 200 会被缓存到那个不存在的
  //    URL 下（例如某次部署缺了 /foo.js，就会永远把首页 HTML 当成 /foo.js 返回）。
  const shouldCache = url.pathname.startsWith('/icons/');
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const fresh = await fetch(request);
        if (shouldCache && isCacheable(fresh)) cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return new Response('离线且未缓存该资源。', {
          status: 504,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })()
  );
});
