# 207 — She could retire four products or delete them, but not sell them

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 5
**Surface:** mypiggles › Sell › Products, with rows chosen
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, on screen

## What happened

Four of Devi's seven garments were written but not yet on the site. She ticked
all four and looked at what the bar offered:

```
4 products chosen        Clear    [ Retire ]    [ Delete ]
```

That is it. One way to take them off the site, one way to destroy them, and no
way to put them out.

The filter tabs above the same list read **All · On sale · Not on sale ·
Retired**, so the screen names the exact state she wants and then declines to
move anything into it.

## What should have happened

The commonest thing anybody does to a set of products is put them on sale.

## Why it matters

This is the moment a shop opens. You write your products over a few evenings —
they sit as "Not on sale" while you get the photographs and the prices right —
and then one day you put them out. That day is the whole point of the screen,
and it was the one action missing.

Doing it one at a time is four clicks each: open the product, find the state
control, change it, save, close. For Devi's four that is a nuisance. This run has
already filed [166](166-fifteen-deletions-one-at-a-time.md) about deleting
fifteen things one at a time, and this is the same gap facing the other way,
except it is worse: the tedium is on the action that MAKES money, not the one
that tidies up.

There is also a plain reading problem in a bar that only ever offers harm.
Selecting things and being shown Retire and Delete teaches that choosing rows is
for getting rid of them. The bar was a demolition tool.

## Where it lives

[products-bulk-actions.tsx](../../../apps/workbench/surfaces/commerce/products-bulk-actions.tsx).

The capability was already there and already wired. `useBulkProductStatus` takes
any status the platform has:

```ts
mutationFn: (input: { productIds: string[]; status: ProductStatus }) =>
  api.post<BulkStatusResult>('/v1/commerce/products/bulk-status', input);
```

and `ProductStatus` is `'draft' | 'active' | 'archived'`. Exactly one of the
three was ever passed:

```ts
setStatus.mutate({ productIds: ids, status: 'archived' }, …)
```

So the endpoint could put products on sale the whole time. Nothing but the bar
was missing, which is why no test and no type caught it: everything present was
correct.

## The fix

A third button, and it leads, because it is the one that is not destructive:

```
4 products chosen     Clear    [ Put on sale ]   [ Retire ]   [ Delete ]
```

- **Put on sale** is `color="success"` and solid. It is the good outcome on this
  bar and it should look like it.
- It asks first, like the other two, but the question is not a warning. It says
  what will happen — they go on the website and people can buy them — and names
  the reverse.
- The count leads every sentence, the same as Retire and Delete.
- Products already on sale are **excluded from the count**, so choosing all seven
  and pressing it says "Put 4 products on sale" rather than claiming to have
  changed three that were already out. If nothing in the selection is off sale
  the button does not render at all.

That last part is the difference between a bulk action and a bulk report. Saying
"7 products put on sale" when four moved is how a number stops being trusted.

## What it looked like once fixed

Four chosen, the button pressed, the dialog accepted:

```
4 products put on sale
```

and the list, with every row now reading the same state:

```
Marlow Knit             $96.00    On sale
The Ash Overshirt      $128.00    On sale
Linen Shirtdress       $145.00    On sale
Sunday Trouser         $110.00    On sale
The Everyday Tee        $42.00    On sale
Leather-covered belt    $72.00    On sale
Silk twill scarf        $58.00    On sale
```

Her shop went from three garments to seven in one action.

## Rating effect

`Sell › Products` in [rating.md](../rating.md).
