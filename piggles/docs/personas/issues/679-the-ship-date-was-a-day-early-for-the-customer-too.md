# 679 — The ship date was a day early, for the customer too

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 241
**Surface:** mypiggles › Stock › Preorders, and the shop's own product page
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 in the console; the shop page could not be reached — see below
**Blocked on:** —

## What happened

Three dates on a preorder row — **Ships**, and the two ends of **Window** — were
drawn with `<Timestamp format="absolute">`, which prints an instant on the
reader's own clock. All three are calendar DAYS typed into a date box and stored
at UTC midnight, so west of Greenwich every one of them showed **the day before
the one she typed**.

This is [670](670-the-date-i-typed-came-back-a-day-earlier.md) again, in the
same folder, in a pane that was not walked when 670 was fixed.
[[feedback_a_fix_leaves_its_neighbour_behind]]

**And this time it reaches customers.** The shop's product page prints the same
field:

```text
`Preorder: ships ${formatArrival(preorder.availableAt, locale)}`
```

and `formatArrival` had no `timeZone`. A maker who typed 10 March got a page
promising **9 March** to most of the United States. The console mistake is an
embarrassment; this one is a business making a written promise it did not make.

## Why

Two halves of one rule, both unlearned in this module.

**The console half.** `Timestamp format="absolute"` is for moments. The folder
already has the right pair — `formatDay` (`timeZone: 'UTC'`) and `formatMoment`
— added when 670 was fixed, in `purchase-orders-data.ts`, three files away.

**The shop half, and the bit that made it subtle.** `formatArrival` prints two
different fields, and only one of them was unambiguously a day:

| Field            | Where it comes from                                        |
| ---------------- | ---------------------------------------------------------- |
| `availableAt`    | a date box in the preorder screen. A day, at UTC midnight. |
| `expectedBackAt` | a backorder's `promisedAt`, which had **two writers**      |

`promisedAt` is a purchase order's `expectedArrivalAt` when one exists — a
calendar day — and otherwise `now + N days` from a measured lead time, which
carried whatever time of day the sweep happened to run at. One column, two
meanings, so no single formatter could be right for it.

That second writer had a consequence of its own. `promiseSlipDays` subtracts one
stored promise from another and **rounds**, and a day measured against an
afternoon always rounds away from zero:

```text
told:  2026-03-10T00:00:00Z   (a purchase order's arrival day)
now:   2026-03-12T17:00:00Z   (lead time, counted from when the sweep ran)
       → 2.708 days → rounds to 3 → at or over the 3-day threshold → EMAIL SENT
```

Two days is drift. The threshold exists to keep quiet about it, and the fraction
was defeating it.

MEASURED 2026-09-18: `available_at` on the window Devi opened is stored
`2027-03-10 00:00:00+00`, exactly the day she typed.

## What should have happened

A promise to a customer is a day. It is stored as a day, compared as a day, and
printed as a day, on every screen either of them looks at.

## How to reproduce

Before the fix, in any zone west of Greenwich:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. **Stock › Preorders**, start an offer, type a ship date of 10 March 2027.
3. The row reads **March 9, 2027**.
4. On the shop, the same item out of stock reads "Preorder: ships 9 March 2027".

## Why it matters

The whole point of the preorder screen is that the date is a commitment. The
pane's own header comment argues at length for letting the field stay BLANK,
because "a guess in this field becomes a promise the moment somebody reads it".
Printing the wrong day is worse than a guess: it is a specific promise nobody
made, in writing, on the shop.

## Where it lives

| What                        | Where                                                            |
| --------------------------- | ---------------------------------------------------------------- |
| Three day fields as moments | `piggles\|sparx/apps/workbench/surfaces/inventory/preorders.tsx` |
| The shop's formatter        | `wizeworks/apps/site/components/product-detail.tsx`              |
| The column with two writers | `wizeworks/packages/commerce-schemas/src/demand.ts`              |

## The fix

**The console uses the pair that already exists.** `formatDay` for all three,
with the reason written at the call site so the next person does not have to
find issue 670 to know why a timestamp is wrong here.

**The shop's formatter takes `timeZone: 'UTC'`**, with the same note.

**And `promisedAt` became a day in both its branches**, so that formatter is
right for both fields it prints:

```ts
at.setUTCDate(at.getUTCDate() + Math.ceil(days));
at.setUTCHours(0, 0, 0, 0);
```

This fixes the slip arithmetic as a side effect: two stored days subtract to a
whole number, so the threshold means what it says.

**Proved red.** Two new tests in `demand.test.ts`, and removing that one line
reddens exactly those two and nothing else:

- _lands on a whole day even when it counted from the middle of one_ — every
  existing test anchored on UTC midnight already, so none of them could ever
  have caught this.
- _stays quiet about a two-day drift measured off a lead time_ — the pair this
  function actually gets in production.

[[feedback_a_test_that_cannot_go_red]]

## Confirmed by

> **In the console:** typed 10 March 2027 into a new preorder for the Linen
> Shirtdress. The row reads **March 10, 2027**. A second offer typed as 5
> January 2027 reads **January 5, 2027**. The stored value is
> `2027-03-10 00:00:00+00`.

**Not seen on the shop, and the reason turned out to matter.** Her site was
suspended at the time (an expired trial); once it was brought back, the page was
read and the line was not merely wrong, it was **absent** — the product page
every tenant actually gets renders through the silica template, which had no
preorder ref at all. That is [682](682-the-shop-page-never-said-it-was-a-preorder.md),
and it is the larger half of this.

So the fix here is in both renderers, and it went one level further than the
formatter. `formatArrival` lives in `wizeworks/apps/site/lib/format.ts` with the
`timeZone: 'UTC'` rule and its reasoning, and the two WHOLE SENTENCES that use it
live beside it: `preorderShipsLine` and `backInStockLine`. Neither renderer
calls `formatArrival` any more — moving only the date left each page free to
word the sentence itself, and they immediately disagreed
([683](683-the-shop-never-said-when-a-sold-out-thing-comes-back.md)). One home
each, two callers each: the day the rule holds in one and not the other is the
day this comes back.

Four tests in `wizeworks/apps/site/lib/silica-data.test.ts` now pin the day.
Deleting the `timeZone: 'UTC'` line reddens exactly those four and nothing else,
which is the check this issue never had.

## Rating effect

Recorded in [rating.md](../rating.md) on the `inventory.preorders` row.
