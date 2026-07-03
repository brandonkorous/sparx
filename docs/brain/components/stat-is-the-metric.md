---
title: Stat is the metric primitive
node: components
type: rule
status: active
applies-to: [dashboard]
sources:
  - docs/23-frontend-component-architecture.md
---

**Every prominent metric is a `<Stat>` / `MetricTile`.** Never hand-typeset a big number (a `text-[2rem]` span).

This is a direct partner-pages lesson: the overview used `<Stat>` correctly, then **two functions away** hand-rolled `text-[2rem]` figures on the landing and the earnings calculator. Same feature, two treatments — exactly the inconsistency this rule kills.

**Why:** uniform number treatment across every surface (size, weight, alignment, label position) is a brand signal. Hand-typeset figures drift the moment two people write them.

**How to apply:** a prominent figure of *any* kind, on *any* surface — including landings, calculators, and [[in-console-document]] pages — is a `<Stat>`. No exceptions.

Related: [[console-is-not-marketing]], [[in-console-document]], [[page-archetypes]]
