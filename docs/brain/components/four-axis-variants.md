---
title: Four-axis variants
node: components
type: rule
status: active
applies-to: [dashboard]
sources:
  - docs/35-ui-variant-system.md
  - packages/ui/CLAUDE.md
  - packages/brand/src/theme.css
---

Every color-bearing control is **four orthogonal axes: `color × variant × size × shape`** — never a flat enum.

- **`color`** is a semantic or module slot: `primary`, `success`, `danger`, `module`, a module hue. It answers *what is this?*
- **`variant`** is the treatment: `solid | soft | outline | dashed | ghost | link`. It answers *how loud?*
- They are **separate** — `primary` is a color, not a variant. `<Badge color="success" variant="soft">` is a legal combination precisely because they're independent.

Resolution is **silicaui's Tailwind-plugin classes**: `<Button color variant size>` → `btn btn-<color> btn-<variant> btn-<size>` (silica spells `dashed` as `btn-dash`). The plugin emits every color × treatment class from the `@sparx/brand/theme.css` tokens, so runtime/custom/tenant colors work with **no rebuild**. This holds for the selection controls too: Checkbox/Radio/Switch/Slider/Progress are imported from `@wizeworks/silicaui-react` and take `checkbox-<color>` / `switch-<color>` / … directly. (They were briefly hand-rolled on Radix in `@sparx/ui`, where a plugin color class can't attach, and drove their accent off a per-instance `--sx-sel` custom property — deleted 2026-07-31 along with `colorVars()`.) A tint is always `<color> + soft` (`bg-<color> bg-soft`) — never a baked value.

**Why:** a flat `variant="primary"` enum can't express "soft success" without a combinatorial explosion or a hardcoded hex. The four-axis recipe is why any hue works in any treatment.

**How to apply:** pick color and variant independently. Status colors come from [[status-is-its-own-axis]]. Never reach for a hardcoded hex to get a color the axes already give you.

Related: [[appearance-lives-in-ui]], [[status-is-its-own-axis]], [[color-follows-functionality]]
