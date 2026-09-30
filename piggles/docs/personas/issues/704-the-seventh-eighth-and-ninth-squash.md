# 704 — The seventh, eighth and ninth squash, all in one file

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 246
**Surface:** mypiggles + sparx — Stock › Things that do not add up
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen
**Blocked on:** —

## What happened

Devi's refused-sale row named the product and stopped:

> **The Ash Overshirt**
> Your website

The Ash Overshirt comes in five sizes. The row does not say which one ran out,
which is the only fact she needs to do anything about it.

## Why it matters

`variant-label.ts` states the contract this breaks, in its own header:

> TWO fields, never one. A caller that squashes them into a single string is the
> bug coming back.

`integrity.ts` squashes in three places, and it is worse than a squash — it is a
**fallback**, so the version name is fetched and then thrown away whenever the
product has a name:

```ts
// selects BOTH, keeps one
variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
…
productTitle: r.variant?.product?.title ?? r.variant?.title ?? null,
```

- `listReconciliationDrifts` — the items whose record and history disagree
- `listOversellIncidents` — the refused sales
- `oversellSummary.topVariants` — the raw-SQL twin, `COALESCE(p.title, v.title)`

```
Juniper Row variants with no title of their own    108 of 108
```

Every one of hers. So on her tenant the fallback always fires, and every row on
this pane is the product name again. [[feedback_a_fix_leaves_its_neighbour_behind]]

## What was changed

All three now use the shared contract — `VARIANT_LABEL_SELECT` + `variantLabel()`
for the two Prisma reads, `VARIANT_LABEL_COLUMNS` + `VARIANT_LABEL_JOINS` for the
raw one — and both consoles' hand-rolled name cells are `<ItemName>`, the same
component the other stock lists use.

The lateral join rebuilds the option label the way the catalogue shows it, so an
untitled variant is named by its own options rather than by its code.

## Confirmed

> **The Ash Overshirt**
> XS / Bone · THE-ASH-OVER-XS-BONE
> Your website

Sixth instance was the counting sheet ([700](700-nothing-will-ship-it-except-everything-would-have.md)'s
sibling); these are the seventh, eighth and ninth. See
[698](698-every-row-was-the-product-name-again.md) for the family.
