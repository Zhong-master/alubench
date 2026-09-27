#!/usr/bin/env node
/**
 * VisionAI 3D Workbench — 零依赖本地/内网静态服务器
 *
 * 用途：`npx visionai-3dworkbench`（或全局安装后 `visionai-workbench`）一条命令
 * 把包内已构建好的 dist/ 起来，不需要 Docker、不需要 Node 构建工具链。
 *
 * 行为刻意对齐仓库里的 nginx.conf（同一套路由回退 / MIME / 缓存头 / gzip），
 * 避免"本地跑得好、部署到 nginx 就不一样"这类漂移：
 *   - SPA 回退：未知路径（无扩展名）→ index.html
 *   - /assets/ 下缺失文件 → 404（不能把 index.html 当成 js 返回）
 *   - /sw.js 与 /manifest.webmanifest 不缓存；/assets/ 永久缓存；/icons/ 短缓存
 *   - .webmanifest 必须发 application/manifest+json（否则 Chrome 拒绝解析清单）
 */
import { createServer } from 'node:http';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};
/** 值得 gzip 的类型（与 nginx 的 gzip_types 对齐） */
const GZIP_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.map', '.txt']);

const HELP = `VisionAI 3D Workbench — 铝型材工作台 3D 设计器（纯前端，离线可用）

用法
  visionai-workbench [选项]            # 全局安装后
  npx ${PKG.name} [选项]               # 不安装直接跑

选项
  -p, --port <端口>   监听端口（默认 5173）
  -H, --host <地址>   监听地址（默认 127.0.0.1；填 0.0.0.0 供内网访问）
  -o, --open          启动后用默认浏览器打开
  -v, --version       显示版本
  -h, --help          显示本帮助

说明
  · 服务的是包内已构建好的静态产物，不需要 Docker，也不需要本机构建工具链。
  · 需要 Node.js >= 18。
  · 「安装到桌面 / 手机主屏」（PWA）需要安全上下文：localhost 可以，
    用 --host 0.0.0.0 后从局域网 IP 访问则不行（需要 HTTPS）。
  · 数据全部存在浏览器本地（localStorage / 导出的 .json），服务端无状态。
`;

function parseArgs(argv) {
  const opts = { port: 5173, host: '127.0.0.1', open: false, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '-v' || a === '--version') opts.version = true;
    else if (a === '-o' || a === '--open') opts.open = true;
    else if (a === '-p' || a === '--port') opts.port = Number(next());
    else if (a.startsWith('--port=')) opts.port = Number(a.slice(7));
    else if (a === '-H' || a === '--host') opts.host = String(next());
    else if (a.startsWith('--host=')) opts.host = a.slice(7) || '0.0.0.0';
    else if (/^\d+$/.test(a)) opts.port = Number(a); // 允许 `visionai-workbench 8080`
    else {
      console.error(`未知参数：${a}\n用 --help 查看用法。`);
      process.exit(2);
    }
  }
  return opts;
}

/** 安全解析请求路径：必须落在 dist/ 内，防目录穿越 */
function resolveSafe(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null; // 非法百分号编码
  }
  if (p.includes('\0')) return null;
  const full = resolve(join(ROOT, p));
  return full === ROOT || full.startsWith(ROOT + sep) ? full : null;
}

function statFile(p) {
  try {
    const st = statSync(p);
    return st.isFile() ? st : null;
  } catch {
    return null;
  }
}

/** 缓存策略与 nginx.conf 保持一致 */
function cacheControl(pathname) {
  if (pathname.startsWith('/assets/')) return 'public, immutable, max-age=31536000';
  if (pathname.startsWith('/icons/')) return 'public, max-age=604800';
  if (pathname === '/sw.js' || pathname === '/manifest.webmanifest' || pathname.endsWith('.html')) return 'no-cache';
  return 'public, max-age=3600';
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end('404 Not Found');
}

function send(req, res, filePath, pathname, status = 200) {
  const st = statFile(filePath);
  if (!st) return notFound(res);
  const ext = extname(filePath).toLowerCase();
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': cacheControl(pathname),
    'X-Content-Type-Options': 'nosniff',
  };
  const useGzip =
    GZIP_EXT.has(ext) && st.size > 1024 && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
  if (useGzip) headers['Content-Encoding'] = 'gzip';
  headers.Vary = 'Accept-Encoding';
  if (!useGzip) headers['Content-Length'] = String(st.size);
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  if (useGzip) {
    // 产物不可变且体积有限：同步压缩一次，换实现简单可靠
    res.end(gzipSync(readFileSync(filePath)));
  } else {
    createReadStream(filePath).pipe(res);
  }
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  process.stdout.write(HELP);
  process.exit(0);
}
if (opts.version) {
  console.log(PKG.version);
  process.exit(0);
}
if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
  console.error(`端口不合法：${opts.port}`);
  process.exit(2);
}
if (!statFile(join(ROOT, 'index.html'))) {
  console.error(
    `未找到构建产物：${join(ROOT, 'index.html')}\n（发布包自带 dist/；从源码运行时请先执行 npm run build）`,
  );
  process.exit(1);
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  const pathname = (req.url || '/').split('?')[0];
  const target = resolveSafe(req.url || '/');
  if (target === null) return notFound(res);

  // 目录 → 目录下的 index.html
  let file = target;
  try {
    if (statSync(target).isDirectory()) file = join(target, 'index.html');
  } catch {
    /* 不存在：走下面的回退 */
  }
  if (statFile(file)) return send(req, res, file, pathname);

  // 缺失的静态资源必须 404（与 nginx 的 /assets/ try_files =404 一致）
  if (pathname.startsWith('/assets/') || extname(pathname)) return notFound(res);

  // SPA 回退：未知路径交给 index.html（如 /?action=bom 的快捷方式入口）
  return send(req, res, join(ROOT, 'index.html'), '/index.html', 200);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`端口 ${opts.port} 已被占用，换个端口：visionai-workbench --port ${opts.port + 1}`);
  } else {
    console.error('启动失败：', err && err.message ? err.message : err);
  }
  process.exit(1);
});

server.listen(opts.port, opts.host, () => {
  const shown = opts.host === '0.0.0.0' || opts.host === '::' ? 'localhost' : opts.host;
  console.log(`\n  VisionAI 3D Workbench v${PKG.version}`);
  console.log(`  ➜  本地访问:  http://${shown}:${opts.port}`);
  if (opts.host === '0.0.0.0' || opts.host === '::') {
    const nets = Object.values(networkInterfaces())
      .flat()
      .filter((n) => n && n.family === 'IPv4' && !n.internal);
    for (const n of nets) console.log(`  ➜  内网访问:  http://${n.address}:${opts.port}  （PWA 安装需 HTTPS）`);
  }
  console.log(`  ➜  静态目录:  ${ROOT}`);
  console.log('  ➜  按 Ctrl+C 停止\n');
  if (opts.open) {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    try {
      spawn(cmd, [`http://${shown}:${opts.port}`], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref();
    } catch {
      /* 打不开浏览器就算了，URL 已经打印出来 */
    }
  }
});
