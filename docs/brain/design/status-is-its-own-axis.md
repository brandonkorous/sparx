---
title: Status is its own color axis
node: design
type: rule
status: active
applies-to: [dashboard]
sources:
  - docs/35-ui-variant-system.md
  - apps/dashboard/DESIGN.md
---

State (status) is **orthogonal** to module hue. It is resolved through one helper pair and rendered as one component — there is **no `StatusBadge` component**.

```tsx
<Badge color={statusTone(s)} variant="soft">{statusLabel(s)}</Badge>
```

**Banned:** a hand-rolled `<span>` with color classes; a `text-xs` status label; a **neutral/outline** pill where a semantic tone applies (that's a review deduction). Also reach for **soft semantic callouts** (info/success/warning/danger) to break a wall of black-on-white into something scannable.

**Why:** status legibility is scanning speed. A bespoke span means the tone mapping lives in N places and drifts; a neutral pill throws away the one signal that tells an operator "this is fine / this needs you."

**How to apply:** any lifecycle/state value → `statusTone(s)` for the color, `statusLabel(s)` for the text, `<Badge … variant="soft">` for the shell. Warm hues are reserved for status (except modules that own one).

Related: [[color-follows-functionality]], [[components]]
