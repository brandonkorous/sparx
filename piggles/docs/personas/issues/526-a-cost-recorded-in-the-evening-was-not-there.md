# 526 — A cost recorded in the evening was not there

**Status:** fixed and proven
**Severity:** critical
**Found by:** Devi, recording $12.50 of buttons at ten at night
**Surface:** `lib/today.ts` (new), `surfaces/finance/*`, `surfaces/scheduling/availability-settings.tsx`, both trees, plus `piggles/apps/web` legal tool
**Filed:** 2026-09-15
**Follows:** [525](525-you-lost-minus-1410-dollars.md)

## What she saw

22:00, Tuesday 15 September, Los Angeles. She typed into the quick row on
**Spending**:

```
12.50   Horn buttons from the Saturday market   Parts & materials   [ Record ]
```

A green toast: **Cost recorded**. The status bar: **Saved just now**.

And the list, directly above it, still said:

```
Spending · This month
$2,136.80
3 costs
```

Three. Not four. A full page reload did not bring it back.

## It had saved

```
description                              amount  incurred_at
Horn buttons from the Saturday market      1250   2026-09-16 04:58:55+00
```

`2026-09-16`. **Tomorrow.** Her clock said Tuesday the fifteenth; UTC had been
Wednesday for five hours.

The quick row stamped the raw instant:

```ts
incurredAt: new Date().toISOString(),
```

and the list asks for a range of calendar days:

```
from = 2026-09-01    to = 2026-09-15
```

`period.ts` builds that range from the **local** year, month and day, and says
so in a comment that was right all along:

> Local Y/M/D as a UTC-midnight Date, so `iso()` prints the day the person is
> actually looking at rather than yesterday for anyone west of UTC.

So one end of the query read her clock and the other read UTC's. The cost was
filed on a day that had not started where she was standing, and no range ending
today could reach it.

## The same thing again, in the form that shows its working

The full cost pane defaults its date field:

```ts
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
```

Measured in her browser at 22:00:18:

| what                         | value                     |
| ---------------------------- | ------------------------- |
| her clock                    | Tue Sep 15 2026 22:00 PDT |
| the full form's default date | **2026-09-16**            |
| the list's `to` bound        | 2026-09-15                |
| the quick row's stamp        | **2026-09-16T05:00:18Z**  |

The pane even documents the trap two lines below, about the other half of the
same conversion:

> a local-midnight instant would land on the previous day for anyone east of UTC
> and quietly move the cost's month.

It had the rule and applied it to the parsing and not to the default.

## What it costs

Not a few confusing hours. **Seven hours out of every twenty-four**, in Pacific
time, a cost recorded on her own screen was filed under tomorrow.

And on the last day of a month it does not come back. A cost entered at six in
the evening on 30 September is stamped 1 October and stays there: September's
profit is short by it, October's is long by it, and nothing on any screen says
so. The profit figures, the job figures and the accounting export all bucket on
`incurredAt`, so all three are wrong together.

## What changed

One definition of today, in `lib/today.ts`, read off the clock the person is
looking at:

```ts
export function dayIso(at: Date): string {
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}
export function todayIso(now: Date = new Date()): string {
  return dayIso(now);
}
export function dayStartUtc(day: string): string {
  return new Date(`${day}T00:00:00.000Z`).toISOString();
}
export function todayStartUtc(now: Date = new Date()): string {
  return dayStartUtc(todayIso(now));
}
```

The two steps stay separate on purpose. A form **shows** `todayIso` and **saves**
`dayStartUtc`; a row with no date field to show does both at once with
`todayStartUtc`, so neither half can be got wrong on its own.

Everything that meant "today" now asks it, **including `period.ts`** — so the
two ends of one date range are read off one clock by construction:

| where                                     | was                       |
| ----------------------------------------- | ------------------------- |
| the quick cost row's stamp                | the raw instant           |
| the full cost pane's date default         | the UTC calendar day      |
| a recurring cost's start date             | the UTC calendar day      |
| a closure / time off date                 | the UTC calendar day      |
| the accounting export's filename          | the UTC calendar day      |
| `period.ts`'s `to` bound                  | already right, now shared |
| the marketing legal tool's effective date | the UTC calendar day      |

The legal tool lives in `piggles/apps/web` and shares no package with the
console, so it carries its own four-line copy with a comment pointing here. That
is the honest cost of the app boundary; inventing a dependency for it would be
worse.

## Deliberately not changed

`api-rest`'s `payouts.ts` compares a payout's arrival day against
`new Date().toISOString().slice(0, 10)`. That is a **server** reading its own
clock against days it derived itself, so it is internally consistent. Whether a
trading day should belong to the shop's own saved zone rather than the device's
is a real question and a bigger one — it would have to move `period.ts`, the
server's day buckets and the stored values together, and it cannot be half done.
`lib/today.ts` says so where somebody will read it.

## Proven

Eight guards in `lib/today.test.ts`, both trees. Every fixture is built with the
**local** date constructor, so each one means a wall clock rather than an instant
and the guards say the same thing on every machine — a test that asked the real
clock what day it is would agree with the bug for seventeen hours out of
twenty-four.

Putting `dayIso` back to `at.toISOString().slice(0, 10)` — the original line —
reddens **five**:

```
expected '2026-09-16' to be '2026-09-15'                              (the evening)
expected '2026-09-16' to be '2026-09-15'                              (one minute to midnight)
expected '2026-09-16' not to be '2026-09-16'                          (it IS the UTC day)
expected '2026-09-16T00:00:00.000Z' to be '2026-09-15T00:00:00.000Z'  (what gets stored)
expected '2026-10-01' to be '2026-09-30'                              (the month it belongs to)
```

That last line is the expensive one, stated as a test.

## Proven on her screen

Two costs recorded five minutes apart, either side of the fix:

```
description                              incurred_at                created_at
Tailor's chalk and pins       (after)    2026-09-15 00:00:00+00     2026-09-16 05:03:23+00
Horn buttons from the market  (before)   2026-09-16 04:58:55+00     2026-09-16 04:58:55+00
```

The second one appeared in her list immediately, dated **Sep 15, 2026**, and the
count went from 3 to **4 costs**.

The first is still missing, and has been left alone: it is a true record of what
the defect did, and it turns up on its own tomorrow.
