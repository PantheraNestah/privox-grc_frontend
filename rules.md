# Rules

## Merges

- Before pushing/merging, run `bun install` (without `--frozen-lockfile`) and commit any resulting `bun.lock` changes. CI uses `bun install --frozen-lockfile`, which fails the "Deploy to GitHub Pages" workflow if `package.json` and `bun.lock` are out of sync.
