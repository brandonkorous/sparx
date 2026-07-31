---
title: silicaui owns the design — single point of change
node: design
type: rule
status: active
applies-to: [platform]
sources:
  - DESIGN.md
  - CLAUDE.md
  - packages/brand/src/theme.css
---

**silicaui is the design system. Feature code chooses; it does not paint.**

**The promise:** change `--color-primary` once and every button, badge, tab, link and focus ring
across `apps/workbench`, `apps/web` and `apps/market` follows. Change `--radius-field` and every
input re-shapes. Add a hover treatment to `.btn` and the whole platform gets it — no hunting, no
sweep, no migration PR.

**Why it matters (operator, 2026-07-31):** _"that is why i built and we are using silicaui. if i
change one color, or one component, i want everything to automatically be updated. not have to hunt
things down."_ The propagation IS the product. It holds only where nothing downstream has painted
over it, so **every local override is a place the change stops** — and a place someone pays for
later.

**Ownership:**

| Layer                          | Owns                       |
| ------------------------------ | -------------------------- |
| `@sparx/brand/theme.css`       | the **values** (hexes light+dark, radius by role, 18 module hues) |
| `@wizeworks/silicaui` (plugin) | the **appearance** (fill, ink, border, radius, hover/focus/active/disabled, soft/outline/ghost/dash, sizes, shapes) |
| `@wizeworks/silicaui-react`    | **behavior + a11y** (Base UI state, roving focus, indicators) |
| `@sparx/ui`                    | sparx **compositions** (shell, `PageHeader`, `ListToolbar`, `Stat`, `statusTone`) |
| feature code in `apps/*`       | the **decision** (which `color × variant × size × shape`) **+ layout** (Tailwind for spacing/sizing/position) |

**Feature code owns no appearance at all.**

**The one test:** _if someone changes a token or a component tomorrow, does this screen follow with
zero edits here?_ These all answer no — `style={{…}}` · a hardcoded hex · a fill paired with a
foreground on a control · hand-rolled `hover:`/`focus:`/`disabled:` · a `<span>` dressed as a badge ·
a text color on a component ([[neutral-must-be-earned]] §3.1) · radius re-declared as a t-shirt scale
instead of by role.

**Not "never improve" — improve where it propagates.** Ladder: (1) is there a prop? (`get_component`
first — there usually is); (2) is it a value? change the token in `@sparx/brand/theme.css`; (3) is it
a missing variant/component? add it to silicaui or a composition to `@sparx/ui`; (4) only then, with
approval, a local exception documented as debt.

**A call-site patch is a deferred fix, not a fix.** Receipt: `<TabsTab className="text-base-content">`
at 5+ workbench call sites, each papering over one question nobody asked silica once.

Related: [[neutral-must-be-earned]], [[tokens-are-truth]], [[two-design-systems]], [[components]]
