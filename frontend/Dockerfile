# ═══════════════════════════════════════════════════════════════
# AI-Scientist Hub Frontend — Nginx 静态服务
# React 18 + Vite 构建产物
# ═══════════════════════════════════════════════════════════════

# 阶段1：构建前端
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package.json package-lock.json* ./
RUN npm ci

# 复制源码
COPY . .

# 构建生产版本
RUN npm run build

# 阶段2：Nginx服务
FROM nginx:alpine

LABEL maintainer="AI-Scientist Hub Team"
LABEL description="AI-Scientist Hub Frontend — 静态资源服务"

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制Nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动Nginx
CMD ["nginx", "-g", "daemon off;"]
