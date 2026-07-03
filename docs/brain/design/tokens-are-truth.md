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

The runtime token files are the **only** authoritative values. Docs that embed token tables drift — `docs/23 §4` claims to "mirror `tokens.css` exactly" and no longer does. Trust the CSS, not a doc's copy of it.

- **Dashboard truth:** `packages/ui/src/tokens.css` (colors, 14 `--module-*` hues, `--text-*` scale where `--text-base: 1rem` "never below", radii, the `.sx-c-*` role classes, `surface-100/200/300` elevation, chart palette).
- **Storefront truth:** the tenant's compiled `--st-*` set (`docs/33`), hex-stored / CSS-derived.

**Why:** hardcoded hex and hand-copied token tables are how the design system silently forks. Every drifted value is a screen that no longer matches the brand.

**How to apply:**
- Reference a token var or a component variant — never a raw hex, never `text-white` on a fill (`-content` pairs exist for exactly this).
- Need a value? Read `tokens.css`. Don't trust a doc's inline table.
- **Never edit `packages/ui/src/tokens.css` for a merchant-specific change** — storefront themes override `:root` via `--st-*` custom properties.

Related: [[two-design-systems]], [[color-follows-functionality]], [[flat-by-default]]
