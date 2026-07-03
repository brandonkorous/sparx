---
title: File & function size
node: conventions
type: rule
status: active
sources:
  - CLAUDE.md
  - eslint.config.js
---

Target **≤250 lines/file** and **≤50 lines/function** (≤120 for JSX component bodies). The real point is **cohesion — one file/function, one responsibility** — with line count as the smell detector, not the verdict.

- **Split when a unit takes on a second responsibility**; never fragment one cohesive responsibility just to hit a number. Three files that only call each other read worse than one.
- ESLint enforces this as a **`warn` that never blocks** push/CI (`max-lines`, `max-lines-per-function`). Tests + data-as-code (blueprints, seed, catalogs, templates) are exempt.
- **Boy-scout, not a migration:** split a flagged file when you're already editing it. A pre-existing over-limit file is not a reason to block unrelated work.

**Why:** cohesion is maintainability; the line count is just the tripwire that makes you look.

Related: [[production-not-mvp]]
