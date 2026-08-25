# 208 — The console told her the shop was blank while it was selling

**Status:** fixed and confirmed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 5
**Surface:** mypiggles › Sell › Products, the notice above the list
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, both screens side by side

## What happened

Across the top of her products list, in warning colors:

> **Customers can't find these on your site**
> Your shop page looks up products in a search list, and yours is empty — so
> anyone visiting is told there is nothing to buy. Everything here is safe; it
> just needs putting back into that list.

And her shop, open in the next tab at the same moment:

```
Shop
3 products
Marlow Knit $96.00 · The Ash Overshirt $128.00 · Linen Shirtdress $145.00
```

Both screens were right about the facts and only one was right about the
consequence. The search list IS empty. Nobody is being told there is nothing to
buy.

## What should have happened

The warning describes what is actually going wrong, which is that search and the
filters are degraded — not that the shop is dark.

## Why it matters

This is the same rule as [203](203-her-shop-page-said-she-had-nothing-to-sell.md)
and [175](175-372-garments-arrived-and-the-count-was-worth-nothing.md), pointing
the other way. There, a thing that could not be measured rendered as zero. Here,
a consequence that is not occurring renders as though it is.

The cost is specific and it is not "a slightly wrong sentence". Devi reads that
her shop is telling customers she sells nothing. That is the single worst thing
that can be true about a shop, and it is the reason people stop what they are
doing and start refreshing pages. She would have spent the evening on a fire that
was already out.

It also spends the warning. A banner that has cried the worst case once is the
banner someone dismisses next time, and the next time may be the real one.

**This is a fix that CAUSED a defect**, which is the honest way to record it.
[203] gave listings a database fallback, so the blank shop stopped happening. The
console's sentence was written against the old behavior and nobody went back to
it. A change that repairs a consequence has to visit whatever was describing that
consequence.

## Where it lives

[products-list-notices.tsx](../../../apps/workbench/surfaces/commerce/products-list-notices.tsx).
The file's own header states the standard it broke:

```
// Each is worded as a consequence to the BUSINESS rather than as a system state:
// "customers can't find these" rather than "search index empty".
```

Which is right, and is exactly why the sentence had to change when the
consequence did. Written as a system state it would have aged fine and been worse
every day it was correct.

## The fix

The notice keeps its job and tells the truth about what is lost:

> **Searching your shop won't find these**
> Your products are on your site and people can buy them. What isn't working is
> the search box and the filters beside your shop — those look things up in a
> separate list, and yours is empty, so a customer searching for something by
> name may be told you don't have it.

- The first sentence is the one she needs, and it is the reassuring one.
- The damage is named exactly: search and filters, not the shop.
- `color="info"` rather than `warning`. A degraded search box on a working shop is
  not the same alarm as nobody being able to pay her, which is the `warning`
  directly above it and has to stay louder.
- The button stays **Put them back**, and does the same thing.

## What it looked like once fixed

The two screens now agree. The console says search is degraded; the shop sells
three garments; neither claims the other is broken.

## Rating effect

`Sell › Products` in [rating.md](../rating.md).
