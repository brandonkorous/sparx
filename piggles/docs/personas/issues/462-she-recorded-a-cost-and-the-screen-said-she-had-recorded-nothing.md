# 462 — She recorded a cost and the screen said she had recorded nothing

**Status:** fixed
**Severity:** blocker
**Severity note:** blocker because it makes the module's one write unusable, and because the natural response to it is to enter the cost again.
**Found by:** Devi recording her first cost — $240.00 of fabric
**Surface:** `finance.spending`, the accounting export, `markExported`
**Filed:** 2026-09-09

## What was wrong

She typed $240.00, "Linen and cotton from Ashcombe Mills", chose a category and
pressed **Record**. A green toast said **"Cost recorded"**. The status bar said
**"Saved just now"**.

The list underneath said:

> **Spending · This month**
> **$0.00** — 0 costs
>
> **Nothing recorded yet**

Pressing Refresh changed nothing. The row was in the database, correct in every
field, on the right site.

A shop that sees this records the cost again.

## Why

The list asks for `?from=2026-09-01&to=2026-09-09`. The period picker builds those
and says what they are:

> _"Ranges are calendar-boundary DATES (YYYY-MM-DD), not instants."_

The server parses `to` with `z.coerce.date()` — giving midnight — and filtered:

```ts
incurredAt: { gte: from, lte: to }
```

Her cost was incurred at **10:37**. `lte: 2026-09-09T00:00:00Z` excludes it, and
excludes every other minute of that day. **A range ending "today" contained none
of today.** Everything she entered would have been invisible until tomorrow.

The contract was stated correctly by the client and broken at the seam.

## Two more places, the same bound

- **The accounting export** used `lte: utcMidnight(request.to)`, so the last day
  of every period she sent her accountant was silently short.
- **`markExported`** used the same bound, and it must cover exactly the rows the
  export sent. Left as it was, the last day's costs would go unstamped after
  being sent — and be offered again next time as "still needs sending".

A shared `endOfDayExclusive(date)` now names the rule, built on `utcDayRange`,
whose own comment already called the half-open range "the range every query below
uses". The pattern existed; these three had not used it.

## What was NOT changed

Two `lte: utcMidnight(to)` filters on the `bucket` column stay as they are: that
is a DAY column whose stored values ARE midnights, so an inclusive bound is
correct there.

`finance/channels.ts` looked identical and is not the same case — I changed it,
then checked what the client sends and reverted. It posts
`new Date().toISOString()`, an instant, not a calendar date, so `lte` is right.
The rule is about the SHAPE of the bound, not the shape of the query.

## On screen

After the fix, without touching anything else: **$240.00 · 1 cost**, and the row
`Sep 9, 2026 · Linen and cotton from Ashco… · Parts & materials · Unpaid ·
$240.00`.

A second cost recorded afterwards (shop rent, $1,850.00) appeared **immediately**
with no refresh — so the cache invalidation had been working the whole time and
the date bound was the entire defect. Worth stating, because "the list did not
update" is the obvious diagnosis and it was the wrong one.
