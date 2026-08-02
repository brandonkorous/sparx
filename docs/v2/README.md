# docs/v2 — parked work

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-02

Everything in this folder is **committed in principle but deliberately out of scope until v2**.

It exists so that a well-researched decision does not have to be re-derived from scratch six months
from now, and so that parked work stops leaking into the v1 planning surface. Nothing here is a
backlog item, nothing here is "if there's time," and nothing here should be picked up as a task
during v1 execution.

**Rules for this folder**

1. **Do not implement from these docs during v1.** If a v1 task appears to need something described
   here, that is a signal to scope the v1 task down — or to raise the v2 question explicitly with
   Brandon, not to quietly start building v2.
2. **Do keep them honest.** When a v1 change invalidates a premise in one of these docs (a table
   lands, a contract changes, an assumption turns out wrong), update the doc and bump its version.
   A parked doc that has silently rotted is worse than no doc.
3. **Every doc states what it depends on from v1.** A v2 doc that assumes a v1 feature must name it
   and link it, so the dependency is visible from both ends.

**Contents**

| Doc                                                                | What it covers                                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| [01-food-vendors-and-delivery.md](01-food-vendors-and-delivery.md) | Serving food vendors of every kind, and integrating on-demand courier + delivery-marketplace platforms (DoorDash, Uber Eats, Grubhub). |
