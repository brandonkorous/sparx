---
title: Appearance lives in @wizeworks/ui
node: components
type: rule
status: active
applies-to: [dashboard]
sources:
  - docs/23-frontend-component-architecture.md
  - sparx/packages/ui/CLAUDE.md
---

A control's *appearance* lives in the component library — the silicaui primitives (`@wizeworks/silicaui-react`) and the sparx compositions built on them (`@wizeworks/ui`). Feature code in `apps/*` uses named variants (`<Button color="primary" variant="soft">`) — it **never re-skins a control**.

**The banned fingerprint** (ESLint-flagged in `apps/**`): a **background fill + a foreground text color** — or hand-built `hover:` / `focus:` / `disabled:` states — means you're rebuilding a `<Button>` / `<Input>` / `<Badge>`. Use the silicaui primitive / its variant, or add a composition to `@wizeworks/ui`.

**Allowed:** layout / positioning / spacing / sizing utilities, and one-off chrome (an `absolute top-0 right-0` indicator dot). The ban is *re-skinning*, not utilities in general.

**Why:** re-skinned controls drift from the system instantly and can't be re-themed. It is the single most common "detached from our designs" cause.

**How to apply:** need a styled control? It almost certainly exists in `@wizeworks/silicaui-react` — use its variant. If it's a genuine sparx pattern (a composition, not a primitive), add it to `@wizeworks/ui`; don't inline it in feature code.

Related: [[four-axis-variants]], [[design]], [[color-follows-functionality]]
