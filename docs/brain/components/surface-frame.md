---
title: SurfaceFrame — the one form/detail layout
node: components
type: rule
status: superseded
applies-to: [dashboard]
sources:
  - docs/86-surface-frame-pattern.md
  - .claude/skills/form-surface/SKILL.md
---

> **Superseded 2026-08-01.** `applies-to: [dashboard]` — and `apps/dashboard` was deleted in the workbench cutover. `SurfaceFrame` has now been deleted from `@wizeworks/ui` too (it had 107 consumers at the dashboard's final commit and **zero** after). The rules below are still the right *design*, and `sparx/apps/workbench` implements them in its own idiom — but the named component does not exist. For live guidance read [[pane-or-modal]] and `sparx/apps/workbench/CLAUDE.md`.

Every create / edit / detail surface uses **one** layout language: `SurfaceFrame` — the **F layout** (form column + optional live summary). Not bespoke full-page forms.

- The **same** form renders in three USER-picked presentations — **drawer / modal / full-page** — via `defaultDetailView` / `EntityCreateButton`. Single-page unless a wizard is genuinely *earned*; editors ≠ forms. (Its twin for lists is [[list-substrate]]: the user picks `defaultListView` = table/cards — same "user picks the surface" philosophy.)
- **Cancel is always leftmost.** Delete goes in the `destructive` slot.
- **Identity appears once** — the editable name field, never *also* a read-only heading atop the body. Status + lifecycle actions (Publish/Archive/Preview) teleport into the frame header via `DetailHeaderSlot` (§5.1), never a bespoke in-body "Status" card.
- **Explicit save only**, last-write-wins, + `useUnsavedGuard` (leave-guard). Autosave + ETag conflict detection were **removed platform-wide**.
- Single-module working surface → **neutral cards** ([[color-follows-functionality]]); identity rides the chrome + Save button.

**Why:** consistent surfaces mean an operator learns the pattern once. Bespoke forms are the source of "double header / dead side gutter / Cancel in the wrong place."

**How to apply:** use the `form-surface` skill to wire it — and heed [[three-registries-footgun]] or "New" breaks silently.

Related: [[three-registries-footgun]], [[page-archetypes]], [[list-substrate]], [[color-follows-functionality]]
