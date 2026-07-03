---
title: Appearance lives in @sparx/ui
node: components
type: rule
status: active
applies-to: [dashboard]
sources:
  - docs/23-frontend-component-architecture.md
  - packages/ui/CLAUDE.md
---

A control's *appearance* lives in `packages/ui/`. Feature code in `apps/*` uses named variants (`<Button color="primary" variant="soft">`) — it **never re-skins a control**.

**The banned fingerprint** (ESLint-flagged in `apps/**`): a **background fill + a foreground text color** — or hand-built `hover:` / `focus:` / `disabled:` states — means you're rebuilding a `<Button>` / `<Input>` / `<Badge>`. Use the component, or add a variant to `packages/ui`.

**Allowed:** layout / positioning / spacing / sizing utilities, and one-off chrome (an `absolute top-0 right-0` indicator dot). The ban is *re-skinning*, not utilities in general.

**Why:** re-skinned controls drift from the system instantly and can't be re-themed. It is the single most common "detached from our designs" cause.

**How to apply:** need a styled control? It almost certainly exists in `@sparx/ui` — use its variant. If it truly doesn't, add it to `packages/ui`; don't inline it in feature code.

Related: [[four-axis-variants]], [[design]], [[color-follows-functionality]]
