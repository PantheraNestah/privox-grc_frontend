# syntax=docker/dockerfile:1
#
# Configuration:
#   Build-time: none required — the app no longer needs VITE_* baked in.
#   Runtime env vars (all optional, all overridable per-deployment):
#     VITE_API_URL, VITE_API_TIMEOUT, VITE_APP_NAME  - written to /env.js at
#       startup and read by the frontend via window.__ENV__ (see src/lib/env.ts)
#     NGINX_PORT (or PORT)   - port nginx listens on, default 8080
#     NGINX_SERVER_NAME      - nginx server_name, default "_" (any host)

FROM docker.io/oven/bun:1-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine-slim AS runtime

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/templates/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 docker/entrypoint.d/05-defaults.envsh /docker-entrypoint.d/05-defaults.envsh
COPY --chmod=755 docker/entrypoint.d/50-generate-runtime-env.sh /docker-entrypoint.d/50-generate-runtime-env.sh
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -qO- "http://127.0.0.1:${NGINX_PORT:-8080}/" >/dev/null 2>&1 || exit 1

# ENTRYPOINT/CMD are inherited from the base image (docker-entrypoint.sh,
# which runs the scripts above before `nginx -g daemon off;`).
