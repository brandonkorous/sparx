---
title: A green typecheck can still ship a broken "New" button
node: lessons-learned
type: decision
status: active
sources:
  - docs/brain/components/three-registries-footgun.md
---

**What happened:** adding an entity create flow requires three registries to stay in sync (`createComponents`, `*_CREATE_TYPES`, manifest `entityTypes`). Miss one and the "New X" button silently hard-navigates to a full page instead of opening the overlay — while **typecheck stays green**.

**Why it matters:** correctness that lives in cross-registry *agreement* is invisible to the type system. "It compiles" ≠ "it works." This is a whole class of bug, not one instance.

**The rule it produced:** verify **behavior**, not just types — click "New" in all three presentations before calling it done. See [[three-registries-footgun]] and the `verify` skill.

Related: [[three-registries-footgun]], [[surface-frame]]
