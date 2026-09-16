# 477 — Stock reports aged stock that had no age, three ways on one screen

**Status:** fixed
**Severity:** major
**Found by:** sweeping the rest of Stock for the shape behind [474](474-stock-was-dead-the-day-it-arrived.md)
**Surface:** `inventory.reports` (both consoles) · `@wizeworks/inventory` `agingReport`
**Filed:** 2026-09-09

## Why this was looked for at all

[474](474-stock-was-dead-the-day-it-arrived.md) was a dead-stock window applied
to lines that had sold and not to lines that had not. That fix landed in
`slowMoverReport`. **There is a second dead-stock query, in a different file**,
and it had the same rule written the same way:

```sql
AND (ls.last_sale_at IS NULL OR now() - ls.last_sale_at > make_interval(days => …))
```

`agingReport` feeds **Stock reports**, a pane already scored 8 / 9. Three separate
things on it were wrong, all from the same root.

## 1. The dead-stock list, again

Same defect, same shape: a never-sold line went straight through as dead
whatever its age. So Devi's Stock reports carried a "priciest items gathering
dust" card listing garments that arrived a fortnight earlier.

The aging BUCKETS were already right — there is a `never` band, deliberately
separate from `90+`. The dead-stock list underneath collapsed the two.

Fixed the same way: a line with no sale is measured from its first movement, and
when even that is unknown the row is left out rather than assumed old.

## 2. The window was 90 here and 180 on the screen she can change

`agingReport` kept a private `deadStockDays = 90`. The tenant's planning policy —
the number she can see and edit on **Planning settings** — says 180. Two screens
describing the same stock by two different rules, and the one being ignored was
the one she controls.

It now reads the policy. An explicit filter still wins, because the endpoint
takes one.

## 3. "54 lines not sold in over 3 months", on a shop 16 days old

The **Money sitting still** card sums the `90+` and `never` buckets for its
money, which is fair, and then labels the sum with the `90+` band's words.

Devi's real split: `90+` = **0 lines**. `never` = **54 lines**. So every line in
that sentence was a never-sold one, and the sentence said the opposite of the
truth about all of them.

Now `stillCaption()` names whichever band it is talking about, and both when
there are both:

| her data        | before                               | after                      |
| --------------- | ------------------------------------ | -------------------------- |
| 0 stale, 54 new | "54 lines not sold in over 3 months" | "54 lines have never sold" |

## 4. And then "How fast it sells: 0.0×"

Not the same root, found on the same screen and fixed with it. A turn is what the
sold goods COST set against the value held. **None of the 36 units Devi sold in
the period has a cost recorded**, so the numerator was nought, and the card
printed `0.0×` under the words _"How many times a year your stock sells through
at this pace."_

Zero turns means the stock never sells. She had just sold 36 units.

The helper already refused to answer when nothing had sold (`None sold`). It now
refuses for the other reason too: **`No cost yet`**, with the sentence that says
what to do about it. The blue band below says the money figures are "short by"
the missing costs, which is true of a total and not of a ratio that is entirely
absent.

## The empty state had to change too

With the dead-stock list correctly empty, Devi landed on:

> **Nothing is gathering dust.** Everything you hold has sold recently enough not
> to count as dead stock.

Nothing she holds has sold at all. The fix made a second sentence false, which is
the usual cost of the first fix. It now reads:

> **Nothing is gathering dust.** Nothing here has sat longer than your dead-stock
> window. 54 lines have not sold at all yet, which is not the same thing as dead —
> they have not had the time.

| breaking                                             | reddens |
| ---------------------------------------------------- | ------- |
| restoring the old `last_sale_at IS NULL` dead filter | 1       |
| restoring the private `?? 90` default                | 1       |

Adding the "just arrived" fixture moved two long-standing totals — the valuation
went from 179 units / $94,000 to 191 / $97,600 and the `never` bucket from 30
units to 42. Those are the fixture genuinely holding more stock, and they were
updated rather than loosened.

## Proven

On her Stock reports, in light and dark, and at 360px in an injected iframe
(`scrollWidth === clientWidth === 360`):

- **Money sitting still** — $870.00, _"54 lines have never sold"_
- **How fast it sells** — _"No cost yet"_ and the reason, in place of `0.0×`
- **How long your stock has sat unsold** — "Never sold $870.00 / 319 units", with
  no dead-stock card under it and the corrected note in its place
