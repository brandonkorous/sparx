---
title: Tokens are the source of truth
node: design
type: rule
status: active
applies-to: [both]
sources:
  - packages/ui/src/tokens.css
  - docs/33-token-model-v2.md
---

The runtime token files are the **authoritative** live values. An *unowned* doc copy drifts — `docs/23 §4` claimed to "mirror `tokens.css` exactly" and rotted. The brain instead keeps a **re-synced mirror** ([[dashboard-tokens]]) so you have the values without opening the code; the code still wins any disagreement ([[CONTRACT]]).

- **Dashboard truth:** `packages/ui/src/tokens.css` (colors, 14 `--module-*` hues, `--text-*` scale where `--text-base: 1rem` "never below", radii, the `.sx-c-*` role classes, `surface-100/200/300` elevation, chart palette).
- **Site truth:** the tenant's compiled `--st-*` set (`docs/33`), hex-stored / CSS-derived.

**Why:** hardcoded hex and hand-copied token tables are how the design system silently forks. Every drifted value is a screen that no longer matches the brand.

**How to apply:**
- Reference a token var or a component variant — never a raw hex, never `text-white` on a fill (`-content` pairs exist for exactly this).
- Need a value? Use the brain's [[dashboard-tokens]] mirror — it exists so you don't have to open the code; it's re-synced to `tokens.css`, and the code wins if they ever disagree.
- **Never edit `packages/ui/src/tokens.css` for a merchant-specific change** — site themes override `:root` via `--st-*` custom properties.

Related: [[two-design-systems]], [[color-follows-functionality]], [[flat-by-default]]
