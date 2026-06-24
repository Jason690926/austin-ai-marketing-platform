# syntax=docker/dockerfile:1
# Next.js 14 standalone 容器 — 用於 Google Cloud Run。
# base 用 Debian slim(glibc)而非 Alpine(musl):sharp 原生模組在 glibc 上最穩。

# ---- 1. 安裝相依 ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2. build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# ⚠️ NEXT_PUBLIC_* 會編進前端 bundle,必須在 build 時就存在(只在 runtime 設無效)。
# 由 Cloud Build 透過 --build-arg 傳入(見 cloudbuild.yaml)。anon key 本就是公開值,無洩漏風險。
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build

# ---- 3. runtime(精簡) ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run 注入 PORT(預設 8080);standalone server.js 會讀 PORT/HOSTNAME
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# 以非 root 使用者執行(安全最佳實務)
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

# standalone 產物:server.js + 被 trace 的最小 node_modules(含 sharp)
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
