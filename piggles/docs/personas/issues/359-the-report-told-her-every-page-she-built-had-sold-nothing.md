# 359 — The report told her every page she built had sold nothing

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · same screen as [358], reading down the Bought column
**Surface:** mypiggles › My Site › How your pages do
**Filed:** 2026-08-31
**Fixed:** 2026-08-31
**Confirmed by:** twelve sales, and a screen that now says it cannot place them

## What happened

Every row of "How your pages do" read **Bought 0 (0%)** and **Sales —**. All
twenty-two of them. Her shop, her home page, her product pages, the collection
that carries her knitwear: nothing, nowhere, no revenue.

She took **fourteen orders in those thirty days**, twelve of them not cancelled.

The number was not a bug in the arithmetic. A page's Bought column counts orders
whose buyer's first pageview **that day** was on that page, and not one of her
orders had a landing page recorded against it — 0 of 14. So the true answer was
"we cannot tell", and the screen wrote it as zero.

## What should have happened

A dash, and a sentence saying why.

This is not a new rule; it is the rule this exact file already follows one column
to the left. Its own type says so:

> `conversionPct: number | null` — Orders per visitor, as a percentage, or **null
> when nobody came** — a page with no visitors has no conversion rate, and
> rendering that as 0% reads as failure rather than as silence.

The reasoning was applied to the visitors side of the fraction and never to the
orders side.

## How to reproduce

Every time, on any site where no order in the window carries an attributed
landing path.

1. Sign in as Devi and open **My Site › How your pages do**, Last 30 days.
2. Read down **Bought**: `0 (0%)` on all 22 rows. **Sales**: `—` on all 22.
3. Open **Sell › Orders** in the same window: fourteen orders, twelve live.

In the database: `SELECT count(*), count(attribution_landing_path) FROM orders
WHERE property_id = 'a3fd094d-…'` returns **14, 0**. Eleven of those fourteen
carry `attribution_resolved_at`, so the platform looked and honestly found
nothing; three were never looked at.

## Why it matters

It says something false about the thing an owner cares about most, on the screen
built to tell her whether her work paid off. A wall of `0 (0%)` next to real
visitor numbers reads as one conclusion: people come and nobody buys. She would
have gone and rewritten pages that are fine.

And it is not a quirk of test data. A sale goes untraced whenever the visit and
the purchase are not the same day, which is the ordinary shape of a considered
purchase — nobody buys a $180 hand-finished knit on the first visit — and always
for a sale taken over the phone, in person, or through any channel that is not the
website. A shop like hers will have this state routinely, and the quieter version
(some sales traced, most not) understates every page without ever looking wrong.

## Where it lives

- [page-performance.ts](../../../../wizeworks/services/api-rest/src/lib/page-performance.ts) — the report had no way to say "not measured"
- [page-results-data.ts](../../../apps/workbench/surfaces/builder/page-results-data.ts) `salesUntraced`
- [page-results.tsx](../../../apps/workbench/surfaces/builder/page-results.tsx) — the two money cells and the note
- [attribution.ts](../../../../wizeworks/services/api-rest/src/lib/attribution.ts) — why a sale goes untraced; unchanged, and correct

## The fix

**The report could not tell the two cases apart, so it had to be taught the
difference.** It knew how many orders it had CREDITED to pages; it did not know
how many had been PLACED. One count closes that:

```ts
export interface AttributionCoverage {
  /** Orders placed in this window, cancellations excluded. */
  placed: number;
  /** How many of those could be credited to a landing page. */
  traced: number;
}
```

`placed` is one `order.count` in `pagePerformance`, filtered identically to the
revenue query it must agree with (`status <> 'cancelled'`, same window, same
property). `traced` is the total the report already computed. `assemble` is
untouched and stays pure — the coverage is added by the caller that has the
transaction, so all twelve of its tests keep working.

The console asks one question of it:

```ts
export function salesUntraced(report: PageResultsReport): boolean {
  return report.commerce && report.attribution.placed > 0 && report.attribution.traced === 0;
}
```

When that is true, both money columns render `—` on every row, and a soft info
callout sits directly above the existing explanation of how credit works — above
it, because the reader is looking at the dashes now and the model only matters
once they know these are not zeros:

> **None of your 12 sales could be tied to a page**
> A sale is credited to a page only when the visit and the purchase happen on the
> same day, so somebody who looked on Tuesday and bought on Wednesday counts for
> nothing here, and neither does an order you took over the phone. That is why
> Bought and Sales read "—" rather than zero: nothing was measured, so there is
> nothing to report.

Deliberately NOT fixed: the same-day window in `attribution.ts`. Widening it is a
real question about what "the visit that produced this sale" means, and it is a
decision rather than a repair — see the note carried into
[FOLLOW_UPS.md](../../FOLLOW_UPS.md). What this issue is about is that the screen
must not report an absence as a zero while that question is open.

## Confirmed by

> Reloaded **How your pages do** as Devi. Every Bought and Sales cell reads `—`,
> and above the notes: **"None of your 12 sales could be tied to a page"** with the
> explanation. Twelve is right — she has fourteen orders and two are cancelled,
> which is the same definition the revenue query uses.

## Rating effect

Folded into `builder.pages` in [rating.md](../rating.md), alongside [358].
