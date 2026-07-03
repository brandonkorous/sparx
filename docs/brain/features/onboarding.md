---
title: onboarding (platform)
node: features
type: rule
status: active
sources:
  - docs/15-merchant-onboarding-prd.md
  - packages/modules/src/starters.ts
---

**Goal: a live site in under 5 minutes.** Onboarding is a *platform* capability — every tenant, no flag; not a `ModuleSlug`.

- Any onboarding-flow change that **adds steps or friction** needs justification — the 5-minute target is the constraint, not a nice-to-have.
- **UI:** `(onboarding)/onboarding/` + `story/` + `welcome/`. **API:** `v1/public/signup`, `v1/industry-starters`, `v1/sample-data`; starters/presets in `packages/modules/src/starters.ts` + `presets.ts`. Writes tenant provisioning across domains (no dedicated table).
- Industry starters must stay **industry-agnostic** — vary verticals, no diesel default ([[industry-agnostic]]).

**Why:** onboarding friction is the highest-leverage churn point; every added step compounds against the 5-minute promise.

Related: [[industry-agnostic]], [[taxonomy]]
