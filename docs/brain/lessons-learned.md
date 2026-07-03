---
title: Lessons Learned
type: map
status: active
---

# lessons-learned

Postmortems. Each note is *what drifted, why, and the rule it produced* — the "don't repeat it" layer of the brain. When a mistake ships, it gets a note here, cross-linked to the rule/pattern that now prevents it.

## Lessons

- [[partner-pages-drift]] — marketing idioms leaked into the operator console. **This is the lesson that produced the whole brain.**
- [[spec-drifted-from-token]] — `DESIGN.md` said 15px, the token said 16px. Produced the "index, don't duplicate" directive.
- [[three-registries-silent-break]] — a create flow that typechecks green but ships a broken "New" button. Produced "verify behavior, not just types."
- [[claude-md-drifted]] — the always-loaded root `CLAUDE.md` drifted from the code (repo-status, email provider, event names, auth primitives). Grounding the brain caught it.

## How to add a lesson

Ship a mistake → write the postmortem here: **what happened / root cause / the rule it produced** — and cross-link that rule note. A lesson without a linked rule is unfinished: the point isn't to record the pain, it's to close the hole.
