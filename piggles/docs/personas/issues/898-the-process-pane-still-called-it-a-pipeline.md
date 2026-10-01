# 898 — The process pane still called it a pipeline

**Status:** fixed
**Severity:** **major** — the screen is named "How things move", its heading
says Steps, its own paragraph says "A process is your own set of steps", and its
one destructive button said **Archive this pipeline**. Two words the console had
already decided against, on the control that does the irreversible thing
**Found by:** P03 · act 319, opening How things move
**Surface:** Customers › How things move, and any process; the deals board and a
deal's own pane. Piggles only — sparx says "pipeline" and "stage" on purpose
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** `check:plain-words` and `check:nav-vocabulary`, both proved
red; and her own screen, including the confirm dialog

## What she saw

The bottom of the Sales process, in one card:

```
Putting it away hides this process. Deals already on it are kept.
                                              [ Archive this pipeline ]
```

The sentence and the button it belongs to disagree twice over: "putting away"
against "archive", and "process" against "pipeline". Pressing it opened:

```
Archive Sales?
This puts the process away, so it drops out of the list and out of the deal
editor. Deals already on it are kept, and you can find it again by including
the ones you have put away.
                                            [ Keep it ]  [ Put it away ]
```

A title in one vocabulary over a body and two buttons in the other.

## The console had already decided, twice, in writing

The list beside this pane carries a comment:

```
/* "Put away" is this console's word for hidden-but-kept … this badge said
   "Archived". */
```

and a test on the reports picker carries another:

```
// "Stage", "Pipeline" and "Lead" were each removed from a pane by hand and
// came straight back through this picker.
```

So both renames happened. Both were done by hand, one screen at a time, and the
pane the word is named after kept it. [[feedback_a_fix_leaves_its_neighbour_behind]]

## What was still saying it

Fourteen reader-facing strings across four panes:

```
crm/pipeline-detail.tsx   noun="pipeline"         → "That pipeline is no longer here"
                          label="Pipeline actions"  the toolbar, for a screen reader
                          "Could not save this pipeline"
                          "Archive this pipeline"   the button
                          "Archive {name}?"         the confirm title
                          "{name} archived"         the toast
                          "Archived"                the badge
                          'New stage'               what "Add a step" names a new step
                          "Remove stage"            the button, beside "Remove this step"
                          "still on this stage"     the confirm body
crm/deal-detail.tsx       aria-label="Pipeline"
                          aria-label="Stage"
                          "moving it to a Won or Lost stage"
crm/deals-list.tsx        <th>Stage</th>            the column header
```

Two of those are worth naming on their own. **Pressing "Add a step" created one
called "New stage"** — the screen asking for a step and writing a stage. And the
step editor's own remove button already said "Remove this step" while the
confirm below it said "Remove stage".

## What it says now

```
Putting it away hides this process. Deals already on it are kept.
                                              [ Put this process away ]

Put Sales away?
This puts the process away, so it drops out of the list and out of the deal
editor. Deals already on it are kept, and you can find it again by including
the ones you have put away.
                                            [ Keep it ]  [ Put it away ]
```

Title, body and both buttons in one vocabulary. Verified on her screen; the
dialog was opened and dismissed with "Keep it", and the database confirms both
processes are still there.

## And the tab title

`check:nav-vocabulary` went red the moment "pipeline" joined the lexicon:

```
[pipeline] pane tab "Pipeline"  crm.pipeline.detail  (crm.ts)
```

The pane renames itself once it has loaded, so that is what a tab says in the
moment before that, and what the launcher offers. `vocabulary.ts` now names it
**Process**.

## Not changed, and why

**sparx says "pipeline" and "stage" throughout, consistently**, from the catalog
title to the confirm body. That is its audience's word and nothing there is
wrong. This is a Piggles-only fix.

**"Stage" elsewhere in the Piggles console is a different question.** Twenty-odd
strings across invoicing, social and the record board use it, and invoicing's
"stage" is a document workflow stage — a different concept with a screen of its
own. Deciding that from this pane would be renaming screens nobody has walked.
Measured and recorded; not touched.

## Proved

'pipeline' is now in `BANNED_IN_PRODUCT_COPY`. Measured before the fix: three
findings, all in this one file, no false positives anywhere in 1,335 files.
Restoring `noun="pipeline"` turns `check:plain-words` red; removing the
vocabulary entry turns `check:nav-vocabulary` red.

## Files

- `piggles/apps/workbench/surfaces/crm/pipeline-detail.tsx`
- `piggles/apps/workbench/surfaces/crm/deal-detail.tsx`
- `piggles/apps/workbench/surfaces/crm/deals-list.tsx`
- `piggles/apps/workbench/lib/console/vocabulary.ts`
- `piggles/packages/config/src/lexicon.ts`

## Also checked and correctly not filed

**`pipeline_stages.color`.** Every one of her eleven steps carries a colour in
the database — `#94A3B8`, `#06B6D4`, `#0EA5E9`, `#6366F1`, `#10B981`, `#EF4444`,
`#F59E0B` — the console fetches it into `PipelineStage.color`, and nothing in
either console renders it or offers a way to set it. Worth its own look: the
right answer is probably a tone derived from what the step MEANS rather than a
stored hex, since a hex cannot answer light and dark. Recorded, not acted on.

**Both processes say "Default".** Two rows, both badged Default, which reads odd
until the Moves column beside it is read: one is the default for sales deals and
one for help requests. Correct.

**"Support Queue".** The Sales process has had its steps written in her language
— New inquiry, Worth pursuing, Quote sent, Agreeing terms — and the ticket one
has not: Support Queue, In Progress, Waiting on Customer. That is seeded data,
not console copy, so it belongs with the seeds rather than here. Recorded.

## The thing to remember

**A rename done by hand is done to the screens somebody opened.** Both of these
renames were real decisions, written down in a comment and pinned by a test, and
both stopped one screen short — at the screen named after the word. The word
came back into the lexicon and the checks found it in under a minute.
