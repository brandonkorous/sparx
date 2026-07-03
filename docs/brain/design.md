---
title: Design
type: map
status: active
cssclasses:
  - purple
---

# design

Design is the **language**, not the library. It is the layer that got skipped on the partner pages. It applies *down* onto three surfaces — this is the node's shape:

- **→ components** — how the [[components]] look: variant, color, tint, elevation. See [[color-follows-functionality]], [[status-is-its-own-axis]].
- **→ elements** — raw layout, type, spacing, chrome built from utilities. See [[typography]], [[flat-by-default]], [[tokens-are-truth]].
- **→ content** — voice, microcopy, and which *composition idioms* are allowed. See [[console-is-not-marketing]], [[voice]].

**Before any of it:** [[two-design-systems]]. Dashboard and storefront are two separate systems that share a token *shape*. Conflating them is the #1 latent error.

## Sources of truth

- Dashboard values → `packages/ui/src/tokens.css`. Dashboard language → `apps/dashboard/DESIGN.md`.
- Storefront tokens → `docs/33-token-model-v2.md`. Storefront compile → `packages/surface-compile/src/theme.ts`.
- Component contract → `docs/23-frontend-component-architecture.md`. Variant API → `docs/35-ui-variant-system.md`.
- Brand + voice → `docs/sparx-brand-guide.md`.

## Notes

[[two-design-systems]] · [[tokens-are-truth]] · [[color-follows-functionality]] · [[status-is-its-own-axis]] · [[typography]] · [[flat-by-default]] · [[console-is-not-marketing]] · [[voice]]

## Why this node is acute

The partner pages proved the failure mode: the *components* were used correctly, but marketing **content idioms** — an uppercase eyebrow, hand-typeset hero-number strips, identical value-prop card grids — leaked into the operator console. Those are design-language violations, not component bugs, and the linter can't catch them (it only flags control re-skins). This node is the human backstop. Start every UI task here. See [[console-is-not-marketing]].

## Quarantine

- `docs/18-frontend-architecture.md` — HSL blue tokens, Inter font, pre-CVA components. Stale; do not copy from it.
- `docs/sparx-design-tokens.css` — a token file diverged from live `tokens.css` (14px base, removed 3px stripe, wrong `--color-info`). The root doc-map points here by mistake — use `packages/ui/src/tokens.css`.
