# 791 — "On sale" on a site that sells nothing, and a badge that could not differ

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 278
**Surface:** mypiggles + sparx workbench — `commerce.product.channels`
**Filed:** 2026-09-23
**Blocked on:** —

## What happened

The pane is called **Where it is listed**, and its first line says what it is for:

> Every place this product is offered, and whether each one is live.

For the Céleste Cuff:

```
Your own websites
Changed on the product itself, under which of your sites show it.

Juniper Row Journal                                          On sale
```

Selling was switched off on Juniper Row Journal. Nothing can be bought there.
The column whose whole job is "whether each one is live" said it was.

## The badge could not differ

It read `product.status` and nothing else:

```
{product.status === 'active' ? 'On sale' : 'Not on sale yet'}
```

That is a fact about the PRODUCT, printed once per SITE. The Meridian Tote is on
two sites and carried two identical badges; a product on five would carry five.
A badge that cannot differ between the rows it sits on is noise wearing a
component (RULE #4) — and here it was worse than noise, because the one thing
that could have made it differ was already on the row. `useSites()` returns
`moduleScope` on every site. [[feedback_fetched_but_never_rendered]]

## The sentence that would not take her there

Two lines on this pane name another screen and stop:

- "Changed on the product itself, under which of your sites show it."
- (after this change) "Turn it back on in the site's own settings."

Every other cross-screen reference in this console opens the pane. These read
like directions and were not one.

## What was done

**The badge answers the column's own question**, and says which of the two
reasons it is answering with:

```
Selling is off here     warning   the SITE has Selling switched off
On sale                 success   the product is active and the site sells
Not on sale yet         info      the product is still a draft
```

with a plain sentence underneath the site's name when it is the first of those.

**Both sentences became buttons.** "Change which sites show it" opens the
product's own overview; "Open this site's settings" opens that site. Pressed
both; both land on the right pane.

Not changed: this pane still REPORTS which sites a product is on rather than
editing it, and the file says why — a field owned by two screens is a field that
gets saved twice with different values.

## Files

- `piggles|sparx/apps/workbench/surfaces/commerce/product-channels.tsx`
