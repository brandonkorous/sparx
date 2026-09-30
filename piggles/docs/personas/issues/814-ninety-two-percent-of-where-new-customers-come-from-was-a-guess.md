# 814 — 92% of "Where new customers come from" was a guess

**Status:** fixed
**Severity:** correctness
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `crm.reports`, and `reportingService.leadsBySource`
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi, full width and at 360px; counted in the database
**Blocked on:** —

## What happened

Devi opened **Customer reports** and read the panel headed "Where new
customers come from":

> Last 90 days
> Direct · 32 · 80%
> Storefront · 4 · 10%
> Admin · 3 · 7.5%
> B2B portal · 1 · 2.5%

Four sources, in four words she does not use, and the tallest bar is not a
source at all.

## A customer with no order is not a source

The figure is the channel of a customer's FIRST ORDER. That is a real
observation. The query then filled in everybody else:

```sql
COALESCE(
  (SELECT o.channel FROM orders o WHERE o.customer_id = c.id ORDER BY o.placed_at ASC LIMIT 1),
  CASE WHEN c.company_id IS NOT NULL THEN 'b2b_portal' ELSE 'direct' END
)
```

A company link says what KIND of customer somebody is, not how they arrived.
And `direct` is a real-sounding channel name for "we never found out".

Counted on the dev database, 2026-09-25, every tenant:

|                                   | customers |
| --------------------------------- | --------- |
| has a first order (a real answer) | 59        |
| no order, attached to a company   | 8         |
| no order, no company              | 678       |
| **answered with a guess**         | **686**   |

**92%.** On Devi's own shop, 33 of 40.

The guessed bar was also the tallest on every shop measured, so the peak the
other bars were drawn against was itself meaningless, and the three true
answers rendered as slivers a pixel wide.
[[feedback_never_present_absence_as_measurement]]

## A second copy of the channel words, gone stale

The same function kept its own `SOURCE_LABELS`, a copy of
`ORDER_CHANNEL_LABELS` in `@wizeworks/crm-schemas`. `marketplace` was added to
the channel set and never added to the copy, so three marketplace customers
read the raw key — **`marketplace`, lowercase** — on screen.

The labels now come from the one table, and the report keys a marketplace
order by its own slug, so **Etsy and Faire are separate lines** rather than one
bucket saying nothing.

## A third copy, that nothing could reach

`crm-customers.ts` held a THIRD map with plainer words ("Your website", "Added
by your team") behind:

```ts
label: r.label || sourceLabel(r.source);
```

`r.label` is never empty — the service falls back to the raw key, which is
always a non-empty string. So the right-hand side never ran, and those words
had never once rendered. Deleted.
[[feedback_screen_over_a_function_nobody_calls]]

## A fifth name for where a sale came from

`lib/console/channels.ts` exists because this console once had FOUR names for
one channel (issue 260). The reports pane drew the API's wording instead and
made a fifth. It reads its own table now:

| the API says | this console says |
| ------------ | ----------------- |
| Storefront   | Your website      |
| Admin        | Added by hand     |
| B2B portal   | Wholesale portal  |
| MCP / AI     | AI assistant      |

**`label` has been taken off `LeadSourceRow` in the Piggles data layer.** A
guard would have said "do not do that again"; removing the field means
`row.label` is not there to reach for, so the only way to name a source is to
ask this console what it calls one.

## What Devi sees now

> Last 90 days
> Your website · 4 · 57.1%
> Added by hand · 3 · 42.9%
>
> 33 of these 40 have not ordered yet. Until somebody orders, there is nothing
> to say about where they came from.

Two real bars, a readable comparison, and the missing 82% stated rather than
drawn. The `b2b_portal` row is gone because that one customer had never
ordered either, which is the guess being removed rather than a row going
missing.

## The panel header could not fit its own controls

At 360px the "How things move" header held a title, a picker and a link on one
unwrapping row, and **the link was sliced in half by the card's edge**. The
header wraps now and the picker gives way. Measured: nothing clipped, no
horizontal scroll, `scrollWidth === clientWidth` at 360.

## The rest of the pane, in this console's words

| tile or panel | was                               | is                                    |
| ------------- | --------------------------------- | ------------------------------------- |
| tile          | Pipeline value                    | Value of open deals                   |
| tile          | Active segments                   | Customer groups                       |
| panel + link  | Tasks / All tasks                 | Things to do / All of them            |
| panel + link  | Audiences by size / All audiences | Customer groups by size / All of them |
| panel         | Pipeline                          | How things move                       |
| empty         | No segments yet.                  | No customer groups yet.               |

"Pipeline", "segments" and "audiences" were each a word the rail had already
replaced. `check:screen-names` could not see them: a one-word sparx name is
only checked inside the file that draws that screen, and these sit in the
reports pane (issue 813).

## Proved red

`leadSourceLabel`, with the stale copy put back: **4 of 5** red.
`splitLeadSources`, with the split removed: **5 of 11** red.

## Files

- `wizeworks/packages/crm/src/services/reporting-service.ts`
- `wizeworks/packages/crm/src/services/lead-source-label.test.ts` — NEW, 5 tests
- `wizeworks/services/api-rest/src/lib/analytics/metrics/crm-customers.ts` — the dead third map removed
- `piggles|sparx/apps/workbench/surfaces/crm/lead-sources.ts` — NEW
- `piggles|sparx/apps/workbench/surfaces/crm/lead-sources.test.ts` — NEW, 11 tests
- `piggles|sparx/apps/workbench/surfaces/crm/reports.tsx`
- `piggles/apps/workbench/surfaces/crm/reports-data.ts` — `label` removed from the type
- `piggles/apps/workbench/lib/console/channels.ts` — `channelKeyLabel`
- `piggles/apps/workbench/surfaces/crm/reports-tiles-name-what-they-count.test.ts`
