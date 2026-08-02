---
title: Releases are automated (tags, not PRs)
node: conventions
type: rule
status: active
sources:
  - CLAUDE.md
  - .github/workflows/release.yml
---

Releases are **automated via tags, not PRs**, and the tag is cut **LAST** — by the `tag` job inside `release.yml`, after the stages, so a `v*` tag means the version actually SHIPPED.

**Tagging dispatches NOTHING** — a `GITHUB_TOKEN`-pushed tag does not trigger workflows, which is exactly what is wanted: the tag marks the release, it does not start one.

It used to be `auto-tag.yml`, a separate workflow on the same push trigger with no `needs`. So a tag asserted "someone pushed a `feat:` commit" while everyone read it as "this shipped" — which is how **`v1.195.0` ended up on `87dfe7f8`, a commit whose image build AND deploy both failed**. A skipped stage still counts as shipped; a failed one does not get a tag.

`contents: write` is scoped to the tag JOB, not the workflow — the release otherwise runs on `contents: read` while holding cloud OIDC and package write.

- **No bot ever opens a PR.** Code-change PRs remain a human gate.
- Force a specific bump with release.yml's `bump` input (`patch`/`minor`/`major`), or suppress one with `none`.

**How to apply:** just land good conventional commits on `main`; tagging and the four-stage release both run hands-off from the push. See [[deploy-workflows]] for the deploy side.

Related: [[conventional-commits]], [[pre-push-guard]], [[infrastructure]]
