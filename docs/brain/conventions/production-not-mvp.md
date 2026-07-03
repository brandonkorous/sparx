---
title: Production, not MVP
node: conventions
type: rule
status: active
sources:
  - CLAUDE.md
---

Everything is built **production-complete** — no stubs, placeholders, partial happy paths, or "later slice" TODOs. Incomplete work is *blocking*, because the cost of finishing rises exponentially once real users exist.

- A committed capability means the **entire surface**, not a token slice.
- Don't self-impose scope limits — surface the cost, but scope is the operator's call.
- Build continuously; deploy the moment any one app/API works ("deploy early, deploy small").

**Why:** half-built features are liabilities that *look* like progress. The [[partner-pages-drift]] is what "looks done, isn't right" actually costs.

**How to apply:** finish the surface. If cost or scope worries you, say so and let the operator decide — don't quietly cut.

Related: [[releases-are-automated]], [[lessons-learned]]
