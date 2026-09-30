# 782 — The badge said "Draft" on a stage called "Quoted"

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 276
**Surface:** mypiggles + sparx workbench — `invoicing.workflow.edit`, the stage canvas and inspector
**Filed:** 2026-09-22
**Blocked on:** —

## What happened

Opening **B2B Quotes**, the workflow her trade customers' prices run on:

```
1  Draft          Draft        Documents start here
2  Submitted      Draft
3  Under Review   Draft
4  Quoted         Draft
5  Accepted       Committed
6  Declined       Void
7  Expired        Void
```

The left word is hers. The right word is the database's. Four rows running say
"Draft" beside a name that is not Draft, and on the first row the badge simply
repeats the name.

The inspector did the same in its subtitle: heading **Under Review**, subtitle
**Draft · stage 3 of 7**.

## This was fixed once already, one file over

Issue 766, fifteen days earlier, replaced exactly this badge in `lifecycle.tsx`
— the menu an operator uses to advance a document — and the note it left behind
describes this screen's symptom precisely:

> That badge used to print `stage.stageType` raw, so a shop owner choosing what
> to do next read "Accepted committed", "Declined void" and — on four rows
> running — "Submitted draft", "Quoted draft".

That fix added `typeBadge()` to `stage-presentation.ts` and pointed one caller
at it. The two callers in the stage canvas, and the one in the inspector, went
on calling `typeLabel()`, which returns the schema word with a capital letter.

The canvas is the screen where a stage's meaning is CHOSEN, so if anywhere
mattered more it was here. [[feedback_a_fix_leaves_its_neighbour_behind]]

## What was done

The canvas badge, the drag-overlay badge and the inspector subtitle all read
`typeBadge()`:

```
draft      → not promised yet
open       → sent, still yours to change
committed  → they said yes
final      → they owe it
paid       → settled
void       → called off
```

So the same workflow now reads:

```
1  Draft          not promised yet   Documents start here
2  Submitted      not promised yet
3  Under Review   not promised yet
4  Quoted         not promised yet
5  Accepted       they said yes
6  Declined       called off
```

Four rows still share a badge, and that is the truth: those four steps are all
"nothing is promised to the customer yet", which is the fact she needs and the
schema word was hiding.

`typeLabel()` had no callers left and is deleted. The inspector's SELECT never
used it — it renders `STAGE_TYPES`' full labels, "Draft: still being put
together", where the sentence follows the word and earns it.

## Proof

Walked on screen in both consoles, on B2B Quotes (seven stages, every type) and
on Service / Repair (six). The stage-type select and its hint are unchanged;
only the badge and the subtitle moved.

## Files

- `piggles|sparx/apps/workbench/surfaces/invoicing/stage-canvas.tsx`
- `piggles|sparx/apps/workbench/surfaces/invoicing/stage-inspector.tsx`
- `piggles|sparx/apps/workbench/surfaces/invoicing/stage-presentation.ts`

## Noted, not fixed

`stageTone('draft')` returns `'neutral'`, so those four badges are grey. A
colorless badge is the right control for "the absence of a standing" and is what
`templateStanding` uses for Draft one folder over — but `stageTone` is shared
with the invoice editor's lifecycle menu and the document history, and naming
`neutral` is Brandon's call either way. Carried with the other 585.
