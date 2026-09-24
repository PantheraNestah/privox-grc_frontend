# Container image

Multi-stage build: `bun` builds the static SPA, then a minimal
`nginx-unprivileged` alpine image serves it (no shell tools beyond what
ships in the base image, non-root user, ~14MB final image).

## Runtime configuration

The image is built once and reconfigured per deployment via environment
variables — no rebuild needed to point at a different API or host.

| Variable          | Default | Effect                                                              |
|--------------------|---------|-----------------------------------------------------------------------|
| `VITE_API_URL`      | —       | Backend API base URL. Written to `/env.js`, read by the app at runtime. |
| `VITE_API_TIMEOUT`  | `30000` | API request timeout (ms).                                            |
| `VITE_APP_NAME`     | `GRC Platform` | Display name.                                                 |
| `NGINX_PORT` / `PORT` | `8080` | Port nginx listens on.                                              |
| `NGINX_SERVER_NAME` | `_`     | nginx `server_name` (set to your hostname if you rely on it).        |

Any `VITE_*` variable set on the container is picked up; `env.js` is
regenerated on every container start (see
`docker/entrypoint.d/50-generate-runtime-env.sh`).

## Build & run locally

```sh
podman build -t privox-grc-frontend:local .
podman run -d -p 8080:8080 \
  -e VITE_API_URL=https://api.example.com \
  privox-grc-frontend:local
```

## Hardened run (read-only root filesystem)

nginx needs a handful of small writable paths at startup (rendered config,
cache, the generated `env.js`); everything else — including the app's own
files — stays read-only:

```sh
podman run -d -p 8080:8080 \
  --read-only \
  --mount type=tmpfs,destination=/tmp,tmpfs-mode=1777 \
  --mount type=tmpfs,destination=/etc/nginx/conf.d,tmpfs-mode=1777 \
  --mount type=tmpfs,destination=/var/cache/nginx,tmpfs-mode=1777 \
  --cap-drop ALL --security-opt no-new-privileges \
  -e VITE_API_URL=https://api.example.com \
  privox-grc-frontend:local
```

(Docker: same flags, `--tmpfs /tmp:mode=1777` syntax instead of `--mount`.)
