---
title: A spec drifted from the token that implements it
node: lessons-learned
type: decision
status: active
sources:
  - docs/brain/design/typography.md
  - sparx/packages/ui/src/tokens.css
---

**What happened:** `apps/dashboard/DESIGN.md §3` (and `docs/23 §4`) specify **15px body**, while `sparx/packages/ui/src/tokens.css` implements **16px** (`--text-base: 1rem`) — which is also the platform-wide guidance. The prose spec drifted from the code that implements it.

**Why it matters:** a value written in prose *and* in code will diverge. Readers can't tell which is authoritative, and the stale one gets copied forward into new work.

**The rule it produced:** the **mirror contract** in [[CONTRACT]] — knowledge drawn from live code (like the token values) is materialized in the brain ([[dashboard-tokens]]) but marked a mirror and **re-synced in the same change that edits the code**; if they disagree, the code wins. An *unowned* copy with no re-sync rule (what `docs/23 §4` was) always drifts; an owned, re-synced mirror doesn't.

**Fixed 2026-07-03:** `DESIGN.md` + the `docs/23 §4` token mirror were corrected to 16px (the token was already right). The related 11px-label / 13px-mono reconciliation remains open — [[open-punch-list]].

Related: [[tokens-are-truth]], [[typography]], [[CONTRACT]]
