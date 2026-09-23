# ---- 构建阶段 ----
# Vite 8 要求 Node ≥ 20.19 / 22.12，node:22-alpine 满足且体积小
FROM node:22-alpine AS builder
WORKDIR /app

# 先复制依赖清单，利用 Docker 层缓存（依赖不变时复用该层）
COPY package.json package-lock.json ./
RUN npm ci

# 再复制源码并构建（tsc 类型检查 + vite build → dist/）
COPY . .
RUN npm run build

# ---- 运行阶段 ----
# 静态托管：nginx 官方镜像，无需 node 运行时，镜像体积大幅缩小
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
# 构建上下文里若存在 0600 的文件（不同 umask、手工创建），Vite 会原样复制权限到 dist，
# nginx worker（nginx 用户）读不到 → 该资源 403。这里统一放开读权限，避免这类"本地能跑、部署 403"。
RUN chmod -R a+rX /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
