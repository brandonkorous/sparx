---
title: Voice & microcopy
node: design
type: rule
status: active
applies-to: [both]
sources:
  - docs/sparx-brand-guide.md
---

sparx writes **short, second-person, present-tense, active**. UI copy and marketing copy share a spine even though the surfaces differ.

- Speak to *you* (the tenant/operator), plainly. No dev-speak in the UI ("null", "entity", "payload").
- No hype words — "revolutionary", "seamless", "unlock", "elevate", "supercharge".
- Hierarchy is carried by scale/weight, **not** by uppercase kicker labels — see [[no-eyebrows]].
- `sparx` is **always lowercase**; the wordmark's "x" is always sparx Ember `#e04631` (`--color-primary`, `BRAND.primary` in [marks.ts](../../../packages/brand/src/marks.ts)). This line used to say Indigo `#6366F1` — that was the pre-split value, and Indigo is now only the **Builder module hue**.

**Why:** voice is brand as much as color is. Hype and jargon are the copy equivalent of a gradient wash — instantly generic.

**How to apply:** for anything longer than a label or non-trivial marketing copy, hand to the `copywriter` agent (full copy in the sparx voice) rather than drafting hype yourself. Microcopy/empty-states: state the next action, not a slogan.

## A page tells one story — it is not a list of what the product has

Everything above is **sentence-level**. It says nothing about how a page is ordered, and that omission had a consequence: with no structural rule, every module page defaulted to the only structure available without one — a **feature inventory**. /crm ran nine sections that each named a capability and then explained it.

**The test: read only the headlines, in order. If you can shuffle them and lose nothing, it is a list, not a story.** A story has an order that can't be rearranged, because each beat only makes sense after the one before it.

The arc, in six beats:

1. **The promise** (hero) — what the reader gets, in their words, not the system's.
2. **The recognition** — name what they already do, and validate it. They are not failing; they are hitting a limit. _"You already do this. It just doesn't scale past you."_
3. **The false fix** — the obvious answer, and why it makes things worse. This is where a competitor comparison belongs, as a plot beat rather than a spec table.
4. **The turn** — the one thing only sparx does, given its own section. This is the **why sparx** moment and it gets **layer 5**, the module's own hue (DESIGN.md §2.5).
5. **The consequences** — the capabilities, reframed as things that follow from the turn rather than items on a menu. They should chain and escalate.
6. **The resolution** — return to the person from beat 2 and close the loop, then the receipts, the price, and the ask.

**Two failure modes this exists to catch:**

- **Arguing to the wrong reader.** /crm's comparison section addressed someone who had already decided they wanted a CRM and was shopping vendors. The actual reader doesn't know they want a CRM; they know a regular walked in and the new hire treated them like a stranger. Sell the **problem**, then the category, then sparx — in that order.
- **Making the same point three times.** /crm argued "one database, nothing to sync" in the hero, the comparison lede, a dedicated stats section, and the FAQ. In a story you make the point **once**, at the moment it turns; everything after it is a consequence, not a restatement.

**Why:** a feature list asks the reader to assemble the argument themselves, and they won't — most visitors scan headlines and leave. A story does the assembling for them, and it is the difference between a page and a brochure.

**How to apply:** before writing or auditing any marketing page, write the headline sequence out as a flat list and read it aloud. Fix the sequence before touching a single section's copy. Applies to all 11 module pages; /crm is the worked example.

Related: [[console-is-not-marketing]], [[typography]], [[audience]], [[no-eyebrows]]
