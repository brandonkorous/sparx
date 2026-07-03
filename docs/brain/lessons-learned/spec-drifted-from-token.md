---
title: A spec drifted from the token that implements it
node: lessons-learned
type: decision
status: active
sources:
  - docs/brain/design/typography.md
  - packages/ui/src/tokens.css
---

**What happened:** `apps/dashboard/DESIGN.md §3` (and `docs/23 §4`) specify **15px body**, while `packages/ui/src/tokens.css` implements **16px** (`--text-base: 1rem`) — which is also the platform-wide guidance. The prose spec drifted from the code that implements it.

**Why it matters:** a value written in prose *and* in code will diverge. Readers can't tell which is authoritative, and the stale one gets copied forward into new work.

**The rule it produced:** the brain's prime directive — **index and link the source of truth, never duplicate it** ([[CONTRACT]], [[tokens-are-truth]]). `docs/23`'s own "mirror `tokens.css` exactly" contract is the proof: a hand-maintained copy always drifts.

**Fix owed:** correct `DESIGN.md §3` + `docs/23 §4` to 16px — the token is already right, so this is a doc-and-audit fix. Tracked in [[tasks]].

Related: [[tokens-are-truth]], [[typography]], [[CONTRACT]]
