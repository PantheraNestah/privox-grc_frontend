#!/bin/sh
# Writes window.__ENV__ from any VITE_-prefixed environment variables present
# at container start, so a single built image can be reconfigured per
# environment (API URL, etc.) without rebuilding.
set -eu

out_dir="${RUNTIME_ENV_DIR:-/tmp}"
out_file="$out_dir/env.js"

[ -w "$out_dir" ] || { echo "50-generate-runtime-env.sh: $out_dir not writable, skipping"; exit 0; }

{
    printf 'window.__ENV__ = {\n'
    env | grep -E '^VITE_[A-Za-z0-9_]*=' | while IFS='=' read -r key value; do
        escaped=$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\\"/g')
        printf '  "%s": "%s",\n' "$key" "$escaped"
    done
    printf '};\n'
} > "$out_file"
