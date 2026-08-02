---
title: Conventional commits
node: conventions
type: rule
status: active
sources:
  - CLAUDE.md
  - .github/workflows/release.yml
---

Commit messages are **conventional commits**, and they directly drive releases:

- `feat:` → **minor**, `fix:` / `perf:` → **patch**, `feat!:` or a `BREAKING CHANGE:` footer → **major**.
- `chore / docs / refactor / ci / build / test / style` → **no bump**.
- **Never add a `Co-Authored-By` trailer.**

**Why:** release.yml's `tag` job parses these to compute the version bump. A wrong type ships a wrong release — or silently ships none.

**How to apply:** pick the right type + scope for what actually changed. The bump follows automatically — see [[releases-are-automated]].

Related: [[releases-are-automated]]
