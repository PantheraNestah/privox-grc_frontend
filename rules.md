# Rules

## Never commit

- Never commit API specs, Postman exports, reference/implementation guides or secret material. The full policy and pre-commit hook live in [`rules.llm`](./rules.llm); enable the hook with `git config core.hooksPath .githooks`.

## Merges

- Before pushing/merging, run `bun install` (without `--frozen-lockfile`) and commit any resulting `bun.lock` changes. CI uses `bun install --frozen-lockfile`, which fails the "Deploy to GitHub Pages" workflow if `package.json` and `bun.lock` are out of sync.

## Releases & versioning

- From `v0.9.0` onward the project stays on the `0.9` line: every release increments the patch only — `v0.9.1`, `v0.9.2`, … Do **not** jump to `v0.10.0` or `v1.0.0`; that changes the version the client is tracking and needs their explicit approval.
- A release is an annotated tag on `main`. Pushing a `v*.*.*` tag triggers the container build (`.github/workflows/build-container.yml`) and publishes the image to GHCR — that is the artefact to pull for a server deployment.
- Never move or delete a published tag. If a release build fails before publishing, fix forward on a branch, merge, then re-tag the fixed commit with the same version (as done for `v0.9.0`).

