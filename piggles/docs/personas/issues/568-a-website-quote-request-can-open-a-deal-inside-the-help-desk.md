# 568 — A website quote request can open a deal inside the help desk

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, opening her pipelines list for the first time
**Surface:** `wizeworks/packages/crm/src/services/lead-service.ts` · `wizeworks/packages/crm/src/services/deal-service.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_a_fix_leaves_its_neighbour_behind]] · [[feedback_absent_behaves_like_fine]]

## What she saw

Sell → Pipelines. Two rows, and both of them say **Default**:

| Name           | Moves            | Stages | State       |
| -------------- | ---------------- | ------ | ----------- |
| Sales Pipeline | Sales deals      | 6      | **Default** |
| Support Queue  | Support requests | 5      | **Default** |

Nothing wrong with that on its face. A pipeline is the set of steps something
moves through, and she has two different things moving: money she hopes to make,
and answers she already owes. Each is the default for its own kind.

The question is what "default" then means to the code that has to pick one.

## Measured

Her two pipelines, straight out of the database:

| kind   | name           | default | position | created                 |
| ------ | -------------- | ------- | -------- | ----------------------- |
| deal   | Sales Pipeline | **yes** | 0        | 2026-08-23 10:43:43.122 |
| ticket | Support Queue  | **yes** | 0        | 2026-08-23 10:50:06.459 |

Same flag. Same position. The lookup that decides where a website enquiry lands
sorts on exactly those two columns and then falls through to the third:

```ts
where: { archivedAt: null },
orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
```

**The only thing keeping her quote requests out of her help desk is that the
sales pipeline was seeded six minutes earlier.** That is the whole margin.

Across every tenant on the platform: 43 pipelines, 36 of them flagged default,
6 tenants running both kinds. Every one of the 6 is separated by the same
accident — between 2 and 3 seconds of seeding order, except hers at 6 minutes.
Nothing anywhere states the rule; the rule is the clock.

## How it tips over

One button. The pipeline pane has an archive action, and archiving clears the
default flag on the way out:

```ts
data: { archivedAt: new Date(), isDefault: false },
```

So a business that outgrows its starter sales process, builds a better one and
archives the old one has, in that moment, exactly one pipeline still flagged
default: the **support queue**. The next enquiry through her contact form opens
a **deal** — money she is owed — inside the help desk, in a stage called "Still
open".

And then it is gone. The deals board draws one sales process at a time, and the
pipeline picker that feeds it lists sales pipelines only, deliberately:

> _NOT to "everything": every caller that existed before pipelines became
> generic meant sales, and returning the support queue to a deal-board stage
> picker would put "Waiting on Customer" in front of a rep._

That comment is in `pipelineService.list`, written by whoever made pipelines
generic. The harm was understood and written down. The lookup one file over
never got the filter.

## The cause

Pipelines used to be, implicitly, sales pipelines. Phase 4 gave them an
`objectKey` so a support queue could reuse the same board, the same funnel
report and the same stage editor (docs/144 §7.2). Three of the four places that
resolve a pipeline were updated:

| caller                               | filters on kind            |
| ------------------------------------ | -------------------------- |
| `pipelineService.list`               | yes, defaults to `deal`    |
| `bootstrapDefaultPipeline`           | yes, `objectKey: 'deal'`   |
| `ticketService.ensureTicketPipeline` | yes, `objectKey: 'ticket'` |
| **`resolveEntryPipeline`**           | **no**                     |

The fourth is the one that decides where a real customer's enquiry goes.

**And nothing behind it would have caught the mistake.** `dealService.create`
validates that the stage belongs to the pipeline — which passes, because it
does — and then reads the pipeline for one field:

```ts
select: { propertyId: true },
```

It never asked what kind of pipeline it was writing into. A support queue's
first stage is an `open` stage exactly like a sales pipeline's, so every check
in the path agreed.

## The fix

**One filter, matching the three siblings that already had it.**

```ts
where: { archivedAt: null, objectKey: 'deal' },
```

**And the backstop that was missing.** `dealService.create` now reads
`objectKey` alongside `propertyId` and refuses:

> That pipeline is not a sales process
> _Deals can only be opened in a sales pipeline, not a support queue_

The refusal is worth having on its own. The filter fixes the caller that exists;
the refusal fixes the caller somebody writes next.

## Proven

Two guards, both proven red by reinstalling the defect.

**A source scan**, `test/unit/pipeline-lookup-names-its-kind.test.ts` — because
the defect is a lookup somebody will add next, not this particular one. It reads
every `tx.pipeline.find*` and `count` in the package and requires each to be
keyed by primary key or to name `objectKey`. Restoring the old where clause:

```
expected [ 'services/lead-service.ts:226' ] to deeply equal []
```

The line number is the real one. Comments are blanked with
`match.replace(/[^\n]/g, ' ')` rather than `' '.repeat(n)`, which preserves
newlines and keeps the report honest.

It also asserts its own denominator — at least 8 lookups found — so a tree move
cannot leave it scanning nothing and printing green
([[feedback_structural_checks_go_blind]]).

**A case**, in `test/integration/deal-service.test.ts` — a real support queue,
a real `open` stage, a real attempt to open a deal in it. With the refusal
removed:

```
AssertionError: promise resolved "{ …(25) }" instead of rejecting
```

The deal was created. In the help desk.

**521 CRM tests pass** across 56 files.

## Still open

Two things this walk surfaced and did not close, because each is a decision
about the screen rather than a defect in it:

**There is no way to choose the default.** `PipelineInput.isDefault` exists, the
API accepts it, the badge displays it — and the pipeline pane has no control for
it. Four tenants run more than one sales pipeline today (Atlas Supply Co,
Circuit Notes, Northwind Studio, WizeWorks LLC) and none of them can say which
one new enquiries should land in.

**Nothing clears the previous default.** `create` and `update` write
`isDefault` straight through with no "unset the other one" step, unlike
`billing-template-service`, which does it explicitly and explains why. Two sales
pipelines can both be default; the tiebreak is then seeding order again.
