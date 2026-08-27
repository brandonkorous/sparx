# 258 — A size nobody can buy, and Home said everything is fine

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 11 — Monday morning, "what is nearly out"
**Surface:** mypiggles › Home
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Devi opened Home on a Wednesday morning to see what needed her.

```
What needs you
  4 orders are waiting to go out

Everything else is fine — everyone has had a reply, no bookings are
waiting, nothing is overdue and nothing is running low.
```

At that moment her own shop was showing this on The Ash Overshirt:

```
Choose yours
  XS · Clay    XS · Slate    XS · Bone, sold out
```

`XS · Bone` is struck through and cannot be selected. Its level is 0 on hand,
0 allocated, and the variant's policy is `deny`, so nobody can buy it — and it
is the exact size sitting in Priya Anand's abandoned basket.

Her Stock list knew. It badges that row **None to sell** in red.

Three screens, one shelf:

| screen               | what it said                |
| -------------------- | --------------------------- |
| Her shop, to a buyer | XS · Bone, **sold out**     |
| Console › Stock      | **None to sell**            |
| Console › **Home**   | Everything else is **fine** |

Home is the one she opens at 8am. It is the one that told her nothing.

## What should have happened

A size nobody can buy is the most urgent thing stock can tell an owner, and it
is the first thing Home should say.

## Why it matters

- **It is money leaving while the screen reassures her.** Every visitor who
  wants XS Bone this week leaves without it. Nothing anywhere prompts her to
  make more or take it off the page.
- **"Fine" is a stronger word than the measurement behind it.** The count that
  produced it measures one thing, and that thing could not have been true.
- Home already carries the shape of the answer: a numbered line, an app hue and
  a link straight to the screen. It just never asked the question.

## Where it lives

Home's stock count is `GET /v1/inventory?low_stock_only=true`, and
`LOW_STOCK_SQL` in
[low-stock.ts](../../../../wizeworks/packages/inventory/src/services/low-stock.ts)
reads:

```sql
(l.reorder_point IS NOT NULL AND (on_hand - allocated - buffer - unsellable) <= l.reorder_point)
```

**Every one of Devi's 62 levels has `reorder_point` NULL.** She has never set a
reorder point, because nothing has ever asked her to. So the predicate is false
for every row she owns, for ever, and the count is a permanent, structural zero
that no amount of selling out can move.

`LOW_STOCK_SQL`'s own comment defends that, and the defense is right: "an owner
who set no trigger asked for no alert." **The bug is not in "low" — it is that
Home had no other question.** Being OUT is not a threshold judgement. It needs
no policy to be true, and the console already has the definition: `levelState`
in the stock list returns `None to sell` on `canSell <= 0`, before it looks at
any reorder point at all.

This is the same shape as the bakery already recorded in
[signals.ts](../../../apps/workbench/surfaces/home/signals.ts): four products at
"None to sell" reading "stock is healthy". That repair narrowed the WORDS from
"stock is healthy" to "nothing is running low" and stopped there — the sentence
became defensible and the owner still was not told.

## The fix

**Being sold out is measured, and it is its own line on Home.**

`OUT_OF_STOCK_SQL` added beside `LOW_STOCK_SQL` as a sibling, in the file that
declares itself the one definition, with a JS twin; surfaced as
`out_of_stock_only` on `GET /v1/inventory`; read by a new `outOfStock` count in
[home-data.ts](../../../apps/workbench/lib/console/home-data.ts) and written as a
signal above the low-stock one, because it is the worse of the two.

The word is **"sold out"** — what her own product page says to the customer, so
she reads the same phrase her shopper is looking at.

`LOW_STOCK_SQL` is untouched. An alert and a reorder list must keep including
the items at zero; those are the rows they exist to show.

**Two counts on one screen, and they must not overlap.** A level at zero that
also has a reorder point satisfies both predicates, so the rail would have added
one shelf twice. `IN_STOCK_SQL` (`sellable > 0`) makes them disjoint: Home's low
count asks `low_stock_only` + `sellable_only`, which is exactly what the stock
list badges "Running low" — a level at zero reads "None to sell" there and never
"Running low". So the two counts now mirror the two badges the owner already
sees, and adding them is honest.

**A latent trap closed on the way.** `SURFACE_COUNTS` in
[waiting.tsx](../../../apps/workbench/components/rail/waiting.tsx) inverted
`COUNT_SURFACE` into a `Map<surface, key>` — one key per screen. A second count
naming the same screen would have silently replaced the first, and which one
survived would have depended on object key order. It is a `Map<surface, key[]>`
now and sums them.

## Also fixed here — the same screen at 360px

Scoring Home at 360px (RULE #6) turned up a second defect on it. The "your
design has been refreshed" notice sets its heading **one word per line**:

```
The
design
your
site
was
built
...
```

`.alert` is a flex row that never wraps, and `.alert-content` is
`flex: 1 1 auto; min-width: 0`, so a trailing action holds its width and the
message column is squeezed to whatever is left — about 60px inside a phone-width
pane. It now stacks below `34rem` and keeps the side-by-side row above it.

A platform-wide correction was tried first and reverted: `flex-wrap: wrap` on
`.alert` looked additive but is not, because the content column's basis is
`auto` (max-content), so every alert on every screen wrapped immediately —
including ones with room to spare. Silica's Alert genuinely has no narrow-width
behavior; that is worth raising upstream (found against 0.55), and until it has
one this is a layout decision the call site is allowed to make.

## Confirmed

Reloaded Home as Devi:

```
Good morning, Devi.
2 things are waiting for you.            ← was "One thing"

What needs you
  4 orders are waiting to go out
  1 item is sold out                      ← new

Everything else is fine — everyone has had a reply, no bookings are
waiting, nothing is overdue and nothing is running low.
```

The quiet line correctly dropped "nothing is sold out", because it is not true.
The nav rail badges **Stock 1** where it previously badged nothing — and it is
1, not 62, so the filter is being applied by the server rather than an unknown
parameter being ignored. Clicking the row opens the Stock list.

Checked in dark at 1288px and at 360px; the notice reads as prose at both.

## Still open, and why it is not fixed in this pass

The "1 item is sold out" row opens the Stock list at 62 rows with the sold-out
one **ninth**, because the list holds its filters in `useState` and reads no
parameters on open — there is no way to hand it "show me the sold-out one", and
its toolbar offers "Running low" but not "Sold out".

Those files (`surfaces/inventory/stock-list*.tsx`) are being refactored by
another agent in this working tree right now, so editing them would collide.
It is one prop and one toggle once that work lands.

## Related

[[feedback_never_present_absence_as_measurement]] — a value nobody measured must
never render as one. This is the variant where the measurement exists and cannot
fire: every reorder point NULL means the count is a structural zero, and the
screen reads it as calm.

[[feedback_fetched_but_never_rendered]] — the console had the right definition
(`levelState`) and the right badge all along; Home just never asked for it.

Same family as [173] and [issue 077]'s bakery: a sentence that is technically
defensible and still leaves the owner unwarned.

## Rating effect

Home, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
