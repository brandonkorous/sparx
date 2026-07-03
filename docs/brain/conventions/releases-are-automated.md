---
title: Releases are automated (tags, not PRs)
node: conventions
type: rule
status: active
sources:
  - CLAUDE.md
  - .github/workflows/auto-tag.yml
---

Releases are **automated via tags, not PRs**. Every push to `main` runs `auto-tag.yml`, which analyzes the [[conventional-commits]] since the last `v*` tag and pushes a new tag if anything releasable landed — then dispatches `build-images.yml` + `deploy-prod.yml` against that new tag.

- **No bot ever opens a PR.** Code-change PRs remain a human gate.
- Force a specific bump: `gh workflow run auto-tag.yml -f bump=major|minor|patch`.
- Why auto-tag dispatches the downstream workflows itself: a `GITHUB_TOKEN`-pushed tag doesn't trigger workflows by default, so it fires them directly — no PAT needed.

**How to apply:** just land good conventional commits on `main`; the tag → build → deploy chain is hands-off. See [[infrastructure]] for the deploy side.

Related: [[conventional-commits]], [[pre-push-guard]], [[infrastructure]]
