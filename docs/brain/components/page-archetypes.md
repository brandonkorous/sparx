---
title: Page archetypes & widths
node: components
type: rule
status: active
applies-to: [dashboard]
sources:
  - docs/34-dashboard-working-area-standard.md
  - docs/24-dashboard-shell.md
---

Everything inside `<main>` is one of **six archetypes** at one of **three widths** — name both before you lay out.

- **Archetypes:** Overview · List · Detail · Form · Settings · Preview.
- **Widths:** Full · Wide · Focused (chosen by intent, not by eyeball).
- **Furniture:** `PageHeader` · `ListToolbar` · `EmptyState` · `Stat`.
- One primary action, **top-right**. The **breadcrumb is the back button**. Section nav lives in the shell rail — **in-content tabs only for record facets** (§11.1), never for navigation.

**Why:** archetypes make a new page predictable and on-system; ad-hoc layouts are how pages start looking "off" even when the components are right.

**How to apply:** declare "this is a Detail at Focused width" before building. Metrics → [[stat-is-the-metric]]. Forms → [[surface-frame]].

Related: [[surface-frame]], [[stat-is-the-metric]]
