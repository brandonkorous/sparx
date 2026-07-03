---
title: Billing model — pay for what you use
node: business
type: reference
status: active
sources:
  - docs/17-billing-subscriptions.md
  - CLAUDE.md
---

A tenant **pays only for what they use.** Modules activate independently; there are **no plans or tiers.**

- **Gate by MODULE flag, never by `tenant.plan`.** A disabled module returns 404 with a clear error, runs no workers, and stores no rows.
- Activation is **event-driven** (`module.activated` on Pub/Sub) — never gate a feature by checking subscription rows inline.
- MCP / AI capability gates on the **`ai` module**.

**Why:** plan-tier gating would create exactly the pricing model the product rejects, and it couples features to billing rows (fragile, and wrong on principle).

**How to apply:** feature gating = "is this module active?", resolved from the module-flag system — see the mechanism in [[architecture]].

Related: [[what-sparx-is]], [[pricing]], [[architecture]], [[modules]]
