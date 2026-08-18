---
title: Flat by default
node: design
type: rule
status: active
applies-to: [both]
sources:
  - DESIGN.md
  - docs/sparx-brand-guide.md
  - sparx/packages/ui/src/tokens.css
---

Depth comes from **tonal layering + border**, not drop shadows. Shadow is reserved for *true* elevation — things that float above the page (dropdown, popover, modal, toast), matched to the z-scale.

- Layer with the surface scale: `surface-100 / 200 / 300` (+ the corner-wrap cascade). Never nest a card in a card for depth.
- **No gradients as a visual device.** No hero/mesh/aurora/wash gradients — they are the #1 AI-slop tell. Use solid fills, discrete module-color elements, line/dot grids, real product glimpses, kinetic type. (The only sanctioned gradients are functional ones already in tokens, e.g. TopProgress.)

**Why:** shadow-everywhere and gradient washes read as generic template SaaS — the exact "detached from our designs" feeling. Flatness + tonal layering is the house look.

**How to apply:** need to separate two regions? Reach for a border or the next `surface-*` step before a shadow. Never add a gradient for flavor.

Related: [[tokens-are-truth]], [[console-is-not-marketing]]
