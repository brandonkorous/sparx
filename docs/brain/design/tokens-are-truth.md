---
title: Tokens are the source of truth
node: design
type: rule
status: active
applies-to: [both]
sources:
  - sparx/packages/brand/src/theme.css
  - sparx/packages/ui/src/tokens.css
  - docs/33-token-model-v2.md
---

The runtime token files are the **authoritative** live values. An *unowned* doc copy drifts — `docs/23 §4` claimed to "mirror `tokens.css` exactly" and rotted. The brain instead keeps a **re-synced mirror** ([[dashboard-tokens]]) so you have the values without opening the code; the code still wins any disagreement ([[CONTRACT]]).

- **Dashboard color truth:** `sparx/packages/brand/src/theme.css` (`@sparx/brand`) — the silica token set: `--color-base-100/200/300` + `--color-base-content`, the semantic palette (`--color-primary/secondary/accent/neutral/info/success/warning/error/danger` + each `-content`), and the 18-module palette `--color-module-<name>`. The silicaui Tailwind plugin turns these into the `btn-*`/`bg-<color>`/`bg-soft` classes.
- **Dashboard non-color truth:** `sparx/packages/ui/src/tokens.css` — the `--text-*` scale (`--text-base: 1rem` "never below"), spacing, radii, shadow, motion, and the `--chart-*` palette. (Its old color block + the `.sx-c-*` role classes were deleted in the silicaui migration.)
- **Site truth:** the tenant's compiled `--st-*` set (`docs/33`), hex-stored / CSS-derived, bridged onto silica base tokens.

**Why:** hardcoded hex and hand-copied token tables are how the design system silently forks. Every drifted value is a screen that no longer matches the brand.

**How to apply:**
- Reference a token var or a component variant — never a raw hex, never `text-white` on a fill (`-content` pairs exist for exactly this).
- Need a value? Use the brain's [[dashboard-tokens]] mirror — it exists so you don't have to open the code; it's re-synced to `@sparx/brand/theme.css`, and the code wins if they ever disagree.
- **Never edit `@sparx/brand/theme.css` for a merchant-specific change** — site themes override `:root` via `--st-*` custom properties (bridged to silica base tokens).

Related: [[two-design-systems]], [[color-follows-functionality]], [[flat-by-default]]
