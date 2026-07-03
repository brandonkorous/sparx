---
title: The three-registries footgun
node: components
type: pattern
status: active
applies-to: [dashboard]
sources:
  - .claude/skills/form-surface/SKILL.md
  - docs/86-surface-frame-pattern.md
---

Wiring a new create flow touches **three registries that must stay in sync**:

1. `createComponents` — in the detail-slot
2. `*_CREATE_TYPES` — in the detail-registry
3. `entityTypes` — in the manifest

Miss any one and the "New X" button **silently hard-navigates** (full-page) instead of opening the overlay — **with a green typecheck**. If the surface has a live summary, there's a fourth: `SUMMARY_CREATE_TYPES` (summary↔width coupling).

**Why:** it fails silently *and* typechecks clean, so it's invisible until someone clicks "New" and gets a jarring full-page nav. A textbook detached-behavior bug.

**How to apply:** when adding a create surface, update all three (four with a summary), then **verify "New" in all three presentations** (drawer/modal/full-page). The `form-surface` skill enumerates them; log any new instance in [[lessons-learned]].

Related: [[surface-frame]]
