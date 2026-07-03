---
title: The pre-push guard
node: conventions
type: rule
status: active
sources:
  - .githooks/pre-push
  - CLAUDE.md
---

`pnpm install` wires `git config core.hooksPath .githooks`, enabling `.githooks/pre-push`. Every `git push` first runs, against the working tree:

```
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm typecheck
```

A red local check **blocks the push** — intentionally.

- **`--no-verify` is not an acceptable bypass.** Fix the failing check.
- Formatting failure → run `pnpm format`. Never `git stash`, never bypass.

**Why:** CI on `main` is the production tripwire, not a debugging surface. Catch it locally, keep `main` green.

Related: [[releases-are-automated]], [[production-not-mvp]]
