---
title: Four-axis variants
node: components
type: rule
status: active
applies-to: [dashboard]
sources:
  - docs/35-ui-variant-system.md
  - packages/ui/CLAUDE.md
---

Every color-bearing control is **four orthogonal axes: `color × variant × size × shape`** — never a flat enum.

- **`color`** is a semantic or module slot: `primary`, `success`, `danger`, `amber`, a module hue. It answers *what is this?*
- **`variant`** is the treatment: `solid | soft | outline | dashed | ghost | link`. It answers *how loud?*
- They are **separate** — `primary` is a color, not a variant. `<Badge color="amber" variant="soft">` is a legal combination precisely because they're independent.

Resolution is **role-variable indirection** (`.sx-c-*` → `--c-bg / -fg / -ink / -hover / -tint`, mixed in oklch), so runtime/custom/tenant colors work with **no rebuild**.

**Why:** a flat `variant="primary"` enum can't express "soft amber" without a combinatorial explosion or a hardcoded hex. The four-axis recipe is why any hue works in any treatment.

**How to apply:** pick color and variant independently. Status colors come from [[status-is-its-own-axis]]. Never reach for a hardcoded hex to get a color the axes already give you.

Related: [[appearance-lives-in-ui]], [[status-is-its-own-axis]], [[color-follows-functionality]]
