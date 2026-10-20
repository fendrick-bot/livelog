# syntax=docker/dockerfile:1

# ── Install every workspace's dependencies (cached on lockfile changes only) ──
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts

# ── Build the web app and bundle the server ──
FROM deps AS build
COPY . .
RUN npm run build

# ── Runtime: only the server's production dependencies plus build output ──
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    SERVE_WEB=true
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts --workspace @livelog/server && npm cache clean --force

COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/server/drizzle apps/server/drizzle
COPY --from=build /app/apps/web/dist apps/web/dist

WORKDIR /app/apps/server
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

# Apply pending migrations, then start the API + web server.
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
