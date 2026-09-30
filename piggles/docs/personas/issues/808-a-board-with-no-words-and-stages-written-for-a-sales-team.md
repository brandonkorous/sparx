# 808 — A board with no words, and stages written for a sales team

**Status:** fixed (the migration waits on Brandon)
**Severity:** copy + first run
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `crm.deals.list`, and `DEFAULT_PIPELINE_TEMPLATE`
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi
**Blocked on:** applying `20270517000000_stage_names_a_shop_owner_would_use`

## What happened

Devi opened **Deals** for the first time. She got six empty columns:

> Lead · Qualified · Proposal Sent · Negotiation · Closed Won · Closed Lost
>
> Nothing at this step yet. · Nothing at this step yet. · …

and, along the bottom, `0 on this pipeline`. No explanation of what a deal is.
No button to make one. Nothing telling her what this screen is for.

## Two defects

### 1. The invitation only existed in the other view

```tsx
) : rows.length === 0 && !isBoard ? (
  <ListEmptyState … firstRun={{ title: 'No deals yet', … }} />
```

`&& !isBoard`. **Board is the default view.** So the first-run state that
explains what a deal is, and the button that makes one, rendered only if she
first found the List toggle and pressed it. The "no deals match those filters"
message was hidden the same way, so filtering down to nothing on a board also
said nothing.

Zero deals is zero deals in either view. The guard is gone; both views get both
states.

Its own copy was wrong too. It offered to "start a pipeline", and the pipeline
already existed with six stages in it. It now says the deal lands at the first
step of her board, which is what actually happens.

### 2. The stages were written for somebody who works in sales

| stage                    | what it asks a clothes maker to know     |
| ------------------------ | ---------------------------------------- |
| Lead                     | industry word for a person who might buy |
| Qualified                | qualified by whom, against what?         |
| Proposal Sent            | she sends quotes, not proposals          |
| Negotiation              |                                          |
| Closed Won / Closed Lost | two words where one will do              |

Counted 2026-09-25: **43 pipelines in the database, and all 43 have
`created_at = updated_at`.** Not one tenant has ever edited one, so nobody
translated them either. Everybody is still reading the installer's vocabulary.

Now:

```
New inquiry → Worth pursuing → Quote sent → Agreeing terms → Won / Lost
```

and the pipeline is called **Sales**, not "Sales Pipeline" — "pipeline" is the
word this console spells out as "how a deal moves", so it has no business being
half the name in a picker.

"Quote sent" earns its place twice: it is what she actually does, and a quote is
a real record with a number on it, so the stage points at something she can go
and open.

## The part that made this harder than it should have been

Five integration test files found a stage **by its display name**:

```ts
wonStageId = pipeline.stages.find((s) => s.name === 'Closed Won')!.id;
```

A stage's identity is its `sortOrder` and its `stageType`. The name is display,
and every tenant is free to change it — so a test keyed on the name is asserting
something that was never true. They key off the real fields now:

```ts
wonStageId = pipeline.stages.find((s) => s.stageType === 'won')!.id;
```

**Proof this worked:** all 26 of those tests pass against a database that still
holds the OLD names, while the template ships the new ones. That is what
name-independence looks like.
[[feedback_copy_edit_breaks_identity_lookups]]

## The migration

`20270517000000_stage_names_a_shop_owner_would_use` renames what is already
stored. Dry-run against the dev database, read-only:

|                              | rows |
| ---------------------------- | ---- |
| Lead → New inquiry           | 29   |
| Qualified → Worth pursuing   | 29   |
| Proposal Sent → Quote sent   | 29   |
| Negotiation → Agreeing terms | 29   |
| Closed Won → Won             | 29   |
| Closed Lost → Lost           | 29   |
| "Sales Pipeline" → "Sales"   | 29   |

Guarded three ways: only the `sales` pipeline, only where the pipeline has never
been edited, only where the stage still carries the exact old name. Matched on
**`sort_order` and `stage_type`, never on the old name** — matching on the name
would repeat the mistake this exists to undo.

The database holds 33 stages called "Qualified"; the guard correctly touches
**29**, leaving the four that belong to other pipelines alone.

`updated_at` is preserved on every row, and there are no triggers on either
table, so a renamed pipeline still reads as never edited to the next migration
that needs to know.

### It would have renamed nothing in production

Caught on 2026-09-25 while writing the migration for issue 815. Both
`pipelines` and `pipeline_stages` carry **ENABLE + FORCE** row level security,
and `sparx_owner` is a NON-SUPERUSER in production. A plain `UPDATE` in a
migration sees zero rows there and reports success.

The dry run above passed **only because the local owner is a superuser**. As
written, this would have shipped green on a release and renamed nothing, on
every tenant, with no way to tell from the log.

It loops tenants with `set_config('app.tenant_id', …)` now, and raises a
notice saying what landed, so a run that renames nothing is visible rather
than indistinguishable from a run with nothing to do. Re-run read-only: **174
stages and 29 boards**, the same numbers as before.
(`wizeworks/packages/db/CLAUDE.md`, "Backfilling a FORCE-RLS table")
[[feedback_a_fix_leaves_its_neighbour_behind]]

Until it is applied, Devi's board keeps the old words. The template is already
right for every tenant created from here.

## Files

- `piggles|sparx/apps/workbench/surfaces/crm/deals-list.tsx`
- `wizeworks/packages/crm-schemas/src/builtins/pipeline.ts`
- `wizeworks/packages/crm/test/integration/{deal-service,deal-attach-forecast,merge,rls-isolation}.test.ts`
- `wizeworks/packages/db/prisma/migrations/20270517000000_stage_names_a_shop_owner_would_use/migration.sql` — NEW
- `docs/11-crm-prd.md` — v1.0.1 → v1.1.0

## Left alone, and why

The **support queue** template (New / In Progress / Waiting on Customer /
Resolved / Closed) is already plain English and was not touched. Only its
container name, "Support Queue", carries a word an owner would not pick, and it
is not worth a second migration on its own.
