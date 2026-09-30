# 862 — The "None to sell" filter returned a row marked "In stock"

**Status:** fixed
**Severity:** **moderate** — a stock row offered one unit for sale that nothing may
be sold from, on the same row the filter beside it had just classified as having
none, and every stock row on the platform was running the sellable arithmetic with
three of its four terms
**Found by:** P03 · act 305, following the 4 on the Stock nav row to see what was
waiting
**Surface:** mypiggles › Stock, in both consoles
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** her own pane before and after, and the database arithmetic

## Her own screen, disagreeing with itself

The Stock row had a **4** on it. "Running low" said **"Nothing is running low"**, so
all four were under **"None to sell"**:

```
item                                    location            To sell  On shelf  Spoken for  State
The Everyday Tee  THE-EVERYDAY-M-BLACK  Main Warehouse            0         0           0  None to sell
Brass belt hardware  BRASS-BELT-1       Fulfillment Center        1         1           0  In stock      ←
The Ash Overshirt  THE-ASH-OVER-XS-BONE Main Warehouse            0         0           0  None to sell
Brass belt hardware  BRASS-BELT-1       In transit                0         0           0  None to sell
```

**Row two is under a filter called "None to sell" and its own State cell says "In
stock".** One of them is wrong, on one row, four inches apart.

## What was actually on that shelf

```sql
SELECT on_hand, allocated, safety_buffer, unsellable_on_hand,
       on_hand - allocated - safety_buffer - unsellable_on_hand AS sellable
  FROM inventory_levels … WHERE sku = 'BRASS-BELT-1';
```

```
 location             on_hand  allocated  buffer  unsellable  sellable
 Fulfillment Center         1          0       0           1         0
 In transit                 0          0       0           0         0
 Main Warehouse            59          0       0           0        59
```

One unit at the fulfillment center, **and it is on a quarantine shelf**. Nothing
may be sold from it. The filter was right. The badge and the number were wrong.

## Four answers to one question, on one column

"Sellable" has a single definition, and the module that owns it says so in capital
letters:

> **THE ONE DEFINITION OF "SELLABLE" AND "RUNNING LOW"** … This arithmetic used to
> live in five places and disagreed with itself.

Four terms: on-hand, minus spoken for, minus the cushion held back from the
website, minus what sits on a shelf nothing may be sold from. The column headed
**To sell** got a different answer from each of the four things that touch it:

| who asks             | terms | how                                                     |
| -------------------- | ----- | ------------------------------------------------------- |
| the **filter**       | 4     | `OUT_OF_STOCK_SQL` in the database                      |
| the **sort**         | 4     | `SORT_COLUMNS.available` → `SELLABLE_SQL`               |
| the **number shown** | 3     | the console's `sellable()`, minus one it never received |
| the **State badge**  | 3     | derived from that same number                           |

The sort already carried a comment saying it orders by sellable stock "not the
reported `available`". Two of the four were right, in SQL. The two on the screen
were not.

## And the console had already done its half

`sellable()` in the console takes all four terms, with a comment that names the
exact failure:

> FOUR terms, not three. A unit on the quarantine or damaged shelf is counted in
> on-hand because it is genuinely in the building, and no shopper can be sold it.
> This line stopped at three, so sending a returned item to quarantine moved it on
> one screen and **left it for sale on every other**.

`StockLevel` declared the field, and even explained why it might be absent:

> Optional because it arrived after the field did and **an older cached row will
> not carry it**; absent means zero.

It was absent from **every** row, on every request, forever — because
`PublicInventoryRow` never declared it and the endpoint's `select` never asked for
it. So `?? 0` was applied to the whole platform rather than to a handful of stale
caches, and no error was raised anywhere.
[[feedback_absent_behaves_like_fine]]

Two smaller omissions rode along: `levelState`'s own parameter type listed three of
the four, so a reader of the signature would conclude the fourth was not needed;
and the `safetyBuffer` doc claimed `available` is "lower than on-hand minus
allocated" when the code computes exactly that and deducts nothing.
[[feedback_verify_capability_in_code_not_docs]]

## The whole fix is three lines of server

```ts
// PublicInventoryRow
unsellableOnHand: number;
// the select
unsellableOnHand: true,
// the mapper
unsellableOnHand: r.unsellableOnHand,
```

Everything downstream was already written and waiting for it. That is the shape of
this defect: not a wrong calculation, a **missing input to a right one**.

## How far it reaches

```
levels holding anything back            2 of 630, across 2 tenants
levels the badge got wrong              1 of 1   ← hers, the quarantined buckle
units on a no-sell shelf platform-wide  1
```

Small, because returns disposition (docs/146 Phase 9.7) is a young feature. But the
mechanism was not small: **no row could ever be right**, so every unit anybody
quarantines from here on would have rendered as sellable. The disposition workflow
is the feature whose own comment warns that without this term it is "decorative".

## On screen, before and after

```
before   BRASS-BELT-1  Fulfillment Center   To sell 1   On shelf 1   In stock
after    BRASS-BELT-1  Fulfillment Center   To sell 0   On shelf 1   None to sell
```

"On the shelf" still says 1, which is right: the unit is genuinely in the building.
All four rows under "None to sell" now say "None to sell".

## Proved

**9 tests**, and **proved red** by dropping the fourth term from `sellable()`: 4 of
the 9 fail. One of them is a property over every mix of the four numbers, asserting
the badge and the count can never disagree — which is the pair that was broken and
the pair a future term would break again.

**Checks:** typecheck 0 on `inventory`, `api-rest` and both workbenches. Tests:
piggles workbench inventory 21 files / 201. ESLint and prettier clean.

## Files

- `wizeworks/packages/inventory/src/services/public-api.ts` (send the fourth number)
- `{piggles,sparx}/apps/workbench/surfaces/inventory/data.ts` (`levelState` asks for it)
- `piggles/apps/workbench/surfaces/inventory/level-state.test.ts` (new)

## The thing to remember

**A shared definition protects the places that use it, not the places that never
receive it.** `low-stock.ts` is a good module, it says THE ONE DEFINITION at the
top, and both SQL readers used it correctly. The screen used it correctly too. The
defect lived in the gap between them: a number that exists in the database, is
named in the predicate, is declared in the row type on the browser side, and was
never put on the wire between the two.

And the tell: **the comment explaining why a field might be missing was a better
story than the truth.** "An older cached row will not carry it" is a plausible,
narrow, reassuring reason. The real reason was that nothing ever sent it. A comment
that explains an absence is worth checking against the population of rows that are
actually absent, because the two are usually different sizes.
