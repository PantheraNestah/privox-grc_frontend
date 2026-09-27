# Rules

## Never commit

- Never commit API specs, Postman exports, reference/implementation guides or secret material. The full policy and pre-commit hook live in [`rules.llm`](./rules.llm); enable the hook with `git config core.hooksPath .githooks`.

## Merges

- Before pushing/merging, run `bun install` (without `--frozen-lockfile`) and commit any resulting `bun.lock` changes. CI uses `bun install --frozen-lockfile`, which fails the "Deploy to GitHub Pages" workflow if `package.json` and `bun.lock` are out of sync.
