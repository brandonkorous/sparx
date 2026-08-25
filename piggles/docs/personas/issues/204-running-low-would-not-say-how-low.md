# 204 — "Running low" would not say how low

**Status:** fixed and confirmed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 5
**Surface:** mypiggles › Sell › Groups of products › a group that fills itself
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, on screen

## What happened

Devi's third group is **Last chance** — "anything below 3 in stock" — and it is the
one she wants filled automatically, because the whole point is that she is not
watching it.

The rules editor is good. It asks in plain words ("A product belongs here when it
matches all of the conditions below"), and the conditions are named for what they
are to her: Product name · Brand · Kind of product · Label · Price · **Stock**.
Adding Stock offers three operators:

```
is in stock
is out of stock
is running low
```

"is running low" is the one she wants. Choosing it, the row reads:

```
Where  [ Stock ]  [ is running low ]     No value needed.
```

**How low is running low?** She wanted below 3. There is no box to type 3 in, and
nothing on the screen says what the line is or where it is set. She is being asked
to trust a threshold she cannot see.

## What should have happened

The row says what it means.

## Why it matters

The threshold is genuinely good — a size is running low once it reaches **the
reorder point set for that size**, so it is her number, per size, not a platform
guess. But a rule whose meaning is invisible is one she cannot rely on, and this
group's whole job is to run without her. She either does not use it, or she uses
it and later finds a garment on Last chance that had four left.

"No value needed" is also true of "is in stock" and false here: a value IS needed,
it just lives somewhere else. Saying "none needed" tells her the question does not
exist.

## Where it lives

[collection-rules-value.tsx](../../../apps/workbench/surfaces/commerce/collection-rules-value.tsx),
which returned one string for all three inventory operators, with a comment that
was true for two of them:

```tsx
if (field === 'inventory') {
  // The operator already says everything ("is in stock"); there is nothing to
  // type. Kept as a spacer so rows line up.
  return <Text className="text-sm @lg:pt-2">No value needed.</Text>;
}
```

What it compiles to is right and worth recording:
[collection-rules.ts](../../../../wizeworks/packages/commerce/src/collection-rules.ts)
maps `low_stock` to `Product.lowStock`, a denormalized column set by the inventory
consumer when at least one variant or warehouse level has crossed its reorder
point. Her number, per size.

## The fix

The row says it, where she is looking:

> A size counts as running low once it reaches the reorder point set for it under
> Stock. There is no fixed number here — change that point and this group follows.

Two sentences: what the line is, and what to do about it. "No value needed" stays
for **is in stock** and **is out of stock**, where it is true.

The screen it points at is named as an app (**Stock**), not as a specific pane.
Naming a pane that turns out not to exist is exactly what
[173](173-she-was-sent-to-the-product-for-a-panel-that-is-not-on-it.md) was.

## What it looked like once fixed

```
Where  [ Stock ]  [ is running low ]   A size counts as running low once it reaches
                                       the reorder point set for it under Stock.
                                       There is no fixed number here — change that
                                       point and this group follows.
```

## What is NOT proved, and why

**Last chance is empty, and that is honest rather than verified.** Every one of
her garments has 6 per size and no reorder point set, so nothing should match. But
`Product.lowStock` is maintained by an inventory event consumer, and local dev
routes events to a log rather than a worker — so the column would not move even if
something did qualify.

The pane says this correctly and deserves credit for it:

> No products match these conditions yet — or the last check has not run.
> Membership is worked out in the background after you save.

That is the right sentence: it does not claim zero. Whether a rules-driven group
actually fills is **not checked** in this run.

## Rating effect

`Sell › Groups of products` in [rating.md](../rating.md).
