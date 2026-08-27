# 282 — She was told one thing was sold out, and handed sixty-two rows

**Status:** fixed
**Severity:** major (the count and the screen behind it disagreed; and one of the
four states the screen can show was good news about a shelf holding nothing)
**Found by:** P03 · Juniper Row · pressing "1 item is sold out" on her own Home,
which is the whole of what that row is for
**Surface:** the console — Stock, and the Home row that opens it
**Filed:** 2026-08-27
**Confirmed:** 2026-08-27

## Where this came from

[258] fixed Home so it would say "1 item is sold out" instead of "everything is
fine", and then recorded what it could not finish:

> The "1 item is sold out" row opens the Stock list at 62 rows with the sold-out
> one **ninth** … It is one prop and one toggle once that work lands.

That work has landed. This is the other half — and doing it turned up three more
things, none of which were visible from the code.

## 1. The sentence promised a count the screen did not show

Home says **1**. The screen behind it shows **62**, unsorted, with the one it
counted ninth from the top. The number was right and finding the thing it counted
was the reader's problem.

A sentence naming a count is a promise that the screen behind it shows THAT
count. So the narrowing now travels with the sentence: `Signal` carries `params`,
the row passes them, and the Stock list seeds its filter from the address.

```
Home  "1 item is sold out"  →  Stock · none to sell  →  Showing 1–1 of 1
```

Seeded ONCE, as the initial value. After the first render the chips own it, so
this hands her a starting point rather than a screen that fights her when she
changes it.

The tab is named for what it is showing — `Stock · none to sell` — because params
make a distinct pane, and two tabs both reading "Stock", one holding 62 rows and
one holding 1, is a worse answer than the deep link is a better one.

## 2. "Running low" listed rows badged "None to sell"

Found while adding the second chip beside it, not by looking for it.

The list asked the server for `low_stock_only` alone. That predicate matches a
level at zero as readily as one at two, and `levelState` reports the WORSE state
— so a row returned by the "Running low" filter renders badged **"None to sell"**.
The filter and the badge, on the same row, disagreeing about what it is.

The pairing that fixes it was already written down, in the file that declares the
predicates:

> `LOW_STOCK_SQL AND IN_STOCK_SQL` is "running low but not gone", which is
> exactly what the console badges "Running low".

and in the route's own comment:

> `low_stock_only` — measured against SELLABLE stock **so the filter agrees with
> the "Running low" badge the surfaces render**.

Home had been passing `sellable_only` since [258]. The Stock list never had. The
route said the surfaces did it; one of the two surfaces did.

**Measured on her own data.** Her one level with a reorder point:

```
sku                     sellable  reorder_point  matches_low_raw  matches_out
THE-ASH-OVER-XS-BONE           0              2                t            t
```

`t | t` — it satisfied both. Before this it appeared under "Running low" wearing
a "None to sell" badge. It now appears under "None to sell" only, and "Running
low" correctly reports nothing.

## 3. "Everything has some to sell at Fulfillment Center" — which holds nothing

The new chip needed an empty state, and writing one exposed that the existing one
was already wrong.

Devi has a second location she has never counted anything into. Choose it, choose
a state:

> **Everything has some to sell at Fulfillment Center**
> Nothing you are counting has run out.

One click to **All**, same location:

> **Nothing matches that**
> You are only seeing stock kept at Fulfillment Center.

There is nothing there. A place holding nothing scores zero on every worry there
is, so a screen that reads that zero as reassurance is reporting absence as a
measurement. The pre-existing "Nothing is running low at \_\_\_" said the same thing
the same way.

Good news now needs evidence: a probe asks whether the scope holds any counted
stock at all, fired only where the answer changes the sentence. When it does not,
the claim is not made and the honest nothing is shown instead — a named location
says which one, and a shop that has counted nothing anywhere gets the two ways to
start.

## 4. On a phone, the row could not say what it was about

She reads "1 item is sold out" on her phone. At 360px, measured in the frame:

| column                    | width | holds                   |
| ------------------------- | ----- | ----------------------- |
| **Item**                  | 64px  | name, code AND location |
| To sell                   | 79px  | `0`                     |
| State                     | 126px | two badges              |
| Location / shelf / spoken | 0px   | collapsed, correctly    |

Which rendered as `Th… / TH… / M…`. The file's own header says which two matter:

> so a pane docked at 320px still shows the two that matter — **what it is and
> how many can be sold**

The identity cell had been made the one that gives (`max-w-0 w-full`, added so
the state badge could never be pushed off the edge) with no floor, so it gave all
the way down while a column that is not in that top two took twice its width.

The file already had the answer, used one column over: below `@lg` the Location
column disappears and comes back inside the identity cell. State now does the
same below `@md`. Nothing is lost, and Item goes **64px → 185px**:

```
The Ash Overshirt
THE-ASH-OVER-XS-BONE
Main Warehouse (MAIN)
[None to sell] [38 hours old]
```

`documentElement.scrollWidth === clientWidth === 360`.

## The toolbar, and why it stopped being a toggle

"Running low" was one pressed button, and its comment defended that:

> a single yes/no question, and "All / Running low" as two chips reads as two
> categories of stock.

Correct while there was one question. There are now two states that are genuinely
different problems — low needs a reorder point somebody set, out needs nothing —
so they ARE two categories, and a subset of a toggle is not a toggle. Two
independent toggles would have offered a both-on combination meaning neither.

It is now the shared `filters` slot with three chips — **All · Running low ·
None to sell** — which is the same control the Products list uses, and brings
with it the things a bespoke one had to be given: chips when there is room, a
labelled select in the popover when there is not, the active-filter badge, and
saved-view persistence. A view saved under the old `low: '1'` still applies.

The chip says **None to sell**, which is what the State column badges on every
row it returns. Home says "sold out" — the shopper's word, right where it stands
and one click away.

## Verified by doing it

As Devi, clicking, in both themes and at 360px:

1. Home → **1 item is sold out** → `Showing 1–1 of 1`, chip lit, tab reads
   `Stock · none to sell`.
2. Set a reorder rule on that size (warn at 2, order 12, 21 days) so it satisfies
   both predicates → **Running low** reports nothing, **None to sell** reports it.
3. Fulfillment Center + None to sell → "Nothing matches that", not good news.
4. Main Warehouse + Running low → "Nothing is running low at Main Warehouse" —
   good news, earned, because that scope holds stock.
5. 360px: one legible row, filter folded to a labelled select in the popover
   badged `1`, no sideways scroll.

## Not fixed here

The badges on that row measure **2.28:1** and **1.37:1** in light. That is
[076], open since 2026-08-21, upstream in silicaui, and re-confirmed with token
math in this pass.

## The lesson worth keeping

The deferred half was one prop and one toggle, exactly as [258] estimated. The
three defects around it were not visible from the code and cost more than the
deferral did — every one of them turned up because building the thing meant
looking at the states it could land in. A deferral is not just late work; it is
the work that would have found the other bugs, not being done.
