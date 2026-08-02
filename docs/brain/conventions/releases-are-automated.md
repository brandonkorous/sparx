---
title: Releases are automated (tags, not PRs)
node: conventions
type: rule
status: active
sources:
  - CLAUDE.md
  - .github/workflows/auto-tag.yml
---

Releases are **automated via tags, not PRs**. Every push to `main` runs `auto-tag.yml`, which analyzes the [[conventional-commits]] since the last `v*` tag and pushes a new tag if anything releasable landed.

**Tagging dispatches NOTHING.** The tag marks a release; it does not decide who deploys it. Deployment is `release.yml`, which runs off the same push, in parallel, and builds every image at that commit — so one SHA is the whole release and nothing has to chain a tag to an image. (This corrects an earlier note claiming auto-tag fires the downstream workflows to work around `GITHUB_TOKEN`-pushed tags not triggering runs. That workaround is unnecessary once the pipeline triggers on the push itself.)

- **No bot ever opens a PR.** Code-change PRs remain a human gate.
- Force a specific bump: `gh workflow run auto-tag.yml -f bump=major|minor|patch`.

**How to apply:** just land good conventional commits on `main`; tagging and the four-stage release both run hands-off from the push. See [[deploy-workflows]] for the deploy side.

Related: [[conventional-commits]], [[pre-push-guard]], [[infrastructure]]
