# 815 — Five em dashes on one screen, and no check for them

**Status:** fixed (the migration waits on Brandon)
**Severity:** copy
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `crm.report.library`, and `report-builtins.ts`
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi; counted in the database
**Blocked on:** applying `20270518000000_the_ready_made_reports_say_what_this_file_says`

## What happened

Devi opened **Build a report**. Eight ready-made examples, and five of them
carried an em dash:

> Everyone on your list grouped by where they have got to **—** leads,
> customers, the ones who went quiet.
>
> Closed-won value month by month over the last year **—** whether you are
> growing, and by how much.
>
> Open support requests grouped by how urgent they are **—** what your team
> should pick up first.

The house rule on em dashes is flat: never in copy, reword instead. It has
been a standing instruction for a long time.

## The source file was already right

`report-builtins.ts` had replaced every one of those em dashes with a colon at
some point. The rows in the database had not moved. Counted 2026-09-25:

|                                            | rows   |
| ------------------------------------------ | ------ |
| built-in report rows (8 slugs x 7 tenants) | 56     |
| still carrying an em dash the file dropped | **35** |
| with `created_at = updated_at`             | 56     |
| distinct descriptions per slug             | 1      |

Not one of the 56 had ever been touched by the business it belonged to, and
all seven tenants read the same stale sentence.

The mechanism is stated on `seedBuiltinReports` itself:

> Existing rows are left ALONE rather than upserted: a tenant may have shared
> one with their team or hung it on a dashboard.

That is the right call. The cost is that the file is a template for NEW
tenants and nothing else, so a wording fix in it never reaches anybody who
already has the report. That cost had never been paid.
[[feedback_data_is_a_deploy_stage]]

## There was no check for an em dash anywhere

Not in either console, not in any of the 60-odd guard scripts. A CORE house
rule with nothing holding it.

`check:em-dashes` is new. It reads the same copy strings
`check-plain-words` does, with comments stripped, and it allows exactly two
things because banning them would be banning the punctuation mark rather than
the habit:

- **a number range** — "61–90 days late" and "15–30% light" are correct
  typography, not slips
- **a quoted glyph** — the page results note tells a person a figure can read
  "—" rather than zero, and has to print the thing it is talking about

A bare `—` in a table cell is the console's empty-cell mark and is rejected by
the prose test for free: it asks for two words with letters in.

Measured on the first run: **7 findings, 5 of them the legitimate ranges, 2
real.** Both fixed:

| where                           | was                                                                          | is                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `order-detail-address-form.tsx` | Optional — the courier may need it                                           | Optional. The courier may need it                                            |
| `subscriptions-list.tsx`        | again and again — a candle every month, a box every quarter — and bills them | again and again, a candle every month or a box every quarter, and bills them |

Green it reads: **10,731 sentences across 1,416 files, and not one of them
reaches for a dash instead of a word.** Proved red by putting one back.

## The wording itself was written for somebody in sales

Fixed in the same pass, because the descriptions are the first thing anybody
reads in the builder and they are the only user-facing sentences in that
package that get written into a tenant's database:

| was                                                    | is                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Closed-won value month by month                        | What you won, month by month                                                              |
| grouped by where they have got to: leads, customers    | grouped by how far along they are: the ones you are still talking to, the ones who bought |
| Open support requests … what your team should pick up  | Requests nobody has answered yet … what to pick up first                                  |
| whether your support load is growing                   | whether more is arriving than before                                                      |
| Lifetime spend added up by the company people work for | Everything each company has spent with you, added up                                      |

"What your team should pick up first" is on a console whose owner is a sole
trader. Devi has no team.

## Three names changed with them

"Deals by stage" and "Customers by stage" both said **stage** while the
summary line directly underneath now says **step** and **how far along** — one
card disagreeing with itself. A seeded name is one string for both consoles
and neither can rename a database row, so these are words that read plainly
for a shop owner and correctly for an operator:

- Deals by stage → **Where your deals are**
- Customers by stage → **How far along your customers are**
- Open tasks by owner → **Who is carrying what**

The last one was already the first sentence of its own description, so the
card said one thing twice. The description is now the rest of it.

## The summary line was printing a column name

Under each card, assembled from the report's own parts:

> 1 thing worked out, **broken down by closed**, narrowed by 1 rule

"Closed", "Added" and "Opened" are date column headings, and they are correct
as headings. Dropped into that slot they are not a sentence. When a date is
bucketed the bucket IS the breakdown — the report groups by month, not by
"closed" — so it says **broken down by month** now.

The card's opening line was also missing its full stop.

## The migration

`20270518000000_the_ready_made_reports_say_what_this_file_says`. Dry-run
against the dev database, read-only: **56 rows refreshed**, all 8 slugs.

Matched on `builtin_slug`, which is the row's identity and is never displayed.
Gated on `created_at = updated_at`. `updated_at` written back to itself. No
triggers on `crm_reports`. A business that has edited its copy keeps every
word of it.

## The other migration would have renamed nothing

Checked while writing this one: `crm_reports`, `pipelines` and
`pipeline_stages` all carry **ENABLE + FORCE** row level security, and
`sparx_owner` is a NON-SUPERUSER in production. A plain `UPDATE` in a
migration sees zero rows there and reports success.

`20270517000000_stage_names_a_shop_owner_would_use` (issue 808) was written
that way. It passed its local dry run **only because the local owner is a
superuser**, and would have shipped green while renaming nothing.

Then every other migration still waiting was checked, which is the point of
finding a class rather than an instance:

| migration                                   | writes to                  | looped |
| ------------------------------------------- | -------------------------- | ------ |
| `20270513000000_starter_units…`             | inventory_units_of_measure | yes    |
| `20270514000000_every_document_workflow…`   | document_stages            | yes    |
| `20270515000000_a_letterhead…`              | nothing (DDL only)         | n/a    |
| `20270516000000_a_note_only_your_team_sees` | commerce_fitment_domains   | **no** |
| `20270517000000_stage_names…`               | pipelines, pipeline_stages | **no** |
| `20270518000000_the_ready_made_reports…`    | crm_reports                | **no** |

Three of the six. All three loop tenants now with
`set_config('app.tenant_id', …)` and `RAISE NOTICE` what landed, so a run that
changes nothing is visible in the release log rather than indistinguishable
from a run with nothing to do. Re-run read-only: 174 stages and 29 boards, 56
reports, and 0 fitment notes (that one's rows already match on this database,
which is the guard working).
[[feedback_a_fix_leaves_its_neighbour_behind]]

## Files

- `piggles/scripts/check-em-dashes.mjs` — NEW, wired into `package.json` + `.githooks/pre-push`
- `wizeworks/packages/crm/src/services/report-builtins.ts`
- `wizeworks/packages/crm/src/services/report-builtins-read-plainly.test.ts` — NEW, 5 tests
- `wizeworks/packages/db/prisma/migrations/20270518000000_…/migration.sql` — NEW
- `wizeworks/packages/db/prisma/migrations/20270517000000_…/migration.sql` — the tenant loop
- `piggles|sparx/apps/workbench/surfaces/crm/reports-library.tsx`
- `piggles|sparx/apps/workbench/surfaces/crm/report-builder-data.ts` — `BUCKET_NOUN`
- `piggles/apps/workbench/surfaces/commerce/{order-detail-address-form,subscriptions-list}.tsx`
