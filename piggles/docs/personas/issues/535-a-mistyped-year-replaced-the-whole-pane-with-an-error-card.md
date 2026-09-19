# 535 — A mistyped year replaced the whole pane with an error card

**Status:** fixed and proven
**Severity:** critical
**Found by:** Devi, doing exactly what the screen had just told her to do
**Surface:** `piggles|sparx/apps/workbench/lib/today.ts` + 20 surfaces per console
**Filed:** 2026-09-16
**Follows:** [534](issues) — the empty "Late" tab that sent her to the Due by box in the first place

## What she saw

The Bills to pay screen had just told her: _"Open a cost and fill in Due by to
have it watched."_ So she opened **Shop rent, September** and typed into the
**Due by** box. One slip in the year segment, and the editor vanished:

> ⚠ **This panel ran into a problem**
> Nothing else in your workspace was affected. Try loading it again.

Her unsaved edit went with it. Nothing on screen said what she had done wrong,
because from her side she had done nothing wrong: she typed a date into a date
box.

## Measured first

The workbench issue overlay named it exactly:

```
Console RangeError
Invalid time value
  Date.toISOString
  dayStartUtc              lib/today.ts
  dateValue                surfaces/finance/expense-detail.tsx
  toDraft
  ExpenseDetail.useMemo[draft]
```

Then, in the page itself, to check the premise rather than assume it:

```js
const i = document.createElement('input');
i.type = 'date';
i.value = '20266-09-01'; // reads back as "20266-09-01"
i.value = '275760-09-13'; // reads back as "275760-09-13"
```

**The control does not promise a real date.** Chrome's year segment takes SIX
digits. And:

| day            | `new Date(day + 'T00:00:00.000Z').toISOString()` |
| -------------- | ------------------------------------------------ |
| `2026-09-01`   | fine                                             |
| `0009-01-20`   | fine                                             |
| `20266-09-01`  | **throws RangeError**                            |
| `090120-01-01` | **throws RangeError**                            |
| `2026-02-30`   | silently becomes March 2                         |

An audit of both consoles found the same conversion **44 more times**. One of
them, the one she hit, was inside a render-time `useMemo`, which is why it took
the pane rather than the save.

## Why it is two different severities

| where the conversion sits | what the owner sees                                         | count |
| ------------------------- | ----------------------------------------------------------- | ----- |
| a render-time `useMemo`   | the pane is replaced by an error card; unsaved work is lost | 1     |
| a save handler            | Save does nothing at all, with no message                   | 43    |

The second is quieter and not much better: a button that does nothing teaches an
owner that the software is broken, and she has no way to find the year box.

## Fixed

**`lib/today.ts` is now a total family.** Every helper returns `string | null`
rather than throwing, because a function handed a form value has to be total:

- `dayStartUtc` — a day at midnight UTC (also rejects `2026-02-30`, which
  `new Date` accepts and rolls to March 2; handing back a day nobody typed is
  the same class of lie)
- `dayEndUtc`, `dayMiddayUtc` — the same day, later in it
- `dayStartLocal`, `dayEndLocal`, `dayTimeLocal` — the ones that mean the
  reader's own midnight, for a shift or a day of leave
- `localMomentInstant` — for `datetime-local`, which carries a clock time and is
  a different shape
- `badDayIn(...)` and `NOT_A_DATE` — one sentence, one place

**All 44 call sites now go through them**, across 20 surfaces per console. Every
one either shows the message under the field (the pattern the Amount field
already used), joins the form's existing blocking-reason chain, or raises the
toast that surface already raises for its other refusals. **Nothing silently
drops a date the person typed.**

One bug found while sweeping: the CRM custom-property editor is a
`datetime-local`, not a `date`, so the day helper would have returned null for
every value and quietly saved nothing. It takes `localMomentInstant`.

## It cannot come back

`scripts/check-date-conversions.mjs`, wired into `pnpm check:date-conversions`
and the pre-push guard. It scans **2,238 files** and allows
`new Date(<nothing>)`, arithmetic on `Date.now()`, and an existing `Date` —
everything else has to go through `lib/today.ts` or guard `Number.isNaN` itself.

Proven red both ways, per the rule that a guard nobody has seen fail is not a
guard: reinstating the old `recurring-costs.tsx` line fails it with that exact
line named, and renaming a scan root fails it with "the paths moved" rather than
printing a green tick over zero files.

Five guards were also added to `lib/today.test.ts` in both consoles. **Three go
red** against the implementation that shipped; the other two are the positive
cases, which were always right.

## Files

- `piggles|sparx/apps/workbench/lib/today.ts` + `today.test.ts`
- `scripts/check-date-conversions.mjs` (new), `package.json`, `.githooks/pre-push`
- 20 surfaces per console: `finance/expense-detail` (the render-time one),
  `finance/recurring-costs`, `finance/accounting`, `b2b/invoice-detail`,
  `commerce/giftcard-detail`, `commerce/price-list-detail`,
  `crm/custom-properties-panel`, `inventory/backorder-detail`,
  `inventory/preorders`, `inventory/purchase-order-procurement`,
  `inventory/receipt-bill-panel`, `inventory/supplier-bill-new`,
  `invoicing/save`, `scheduling/availability-settings`, `staff/schedule`,
  `staff/time-off`, and `email/broadcast-detail` (sparx)
