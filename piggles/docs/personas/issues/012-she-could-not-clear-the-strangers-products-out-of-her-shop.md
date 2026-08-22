# 012 — She could not clear the stranger's products out of her shop

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Thistle & Rye · act 5
**Surface:** mypiggles › Home › Practice data › Remove all sample data
**Filed:** 2026-08-19
**Fixed:** 2026-08-19
**Confirmed by:** re-ran act 5 as Marisol — "Sample data removed. Removed 10 products, 10 orders, 7 customers and 156 more records", the pane flipped to "Not loaded", and her own sourdough is the only product left
**Blocked on:** —

## What happened

Marisol's account arrives full of somebody else's shop — single-origin coffee,
olive oil, hot sauce, a chocolate bar. The console is honest about it: every row
is marked, and **Practice data** offers "Remove all sample data · Deletes every
sample record. Your real records are left untouched."

She presses it. The confirm names exactly what goes ("the 10 products, 10 orders,
7 customers and 156 more records… this cannot be undone"). She confirms. Two red
toasts:

> **Could not remove sample data** — Nothing was changed. Try again in a moment.
>
> **That didn't save** — Something went wrong on our end, so that didn't save.
> Nothing you typed was lost — try again in a moment. If it keeps happening,
> quote req_530bf7ba09794e798b478bb83b5bfc08.

The counts do not move. Trying again does the same thing. There is no other route
to it: **the sample data cannot be removed at all.**

## What should have happened

It removes them. This is the one control that turns a demo account into her
business, and act 5 exists precisely to check that pressing it does not cost her
anything she typed.

## How to reproduce

Every time, on any tenant whose pack loads three or more variants — which is
every trade pack that runs the inventory-depth stage:

1. Sign up, pick any trade, finish onboarding.
2. Console → Home → **Practice data** → **Remove sample data** → confirm.
3. Two error toasts; the counts are unchanged.

`POST /v1/sample-data/clear` returns **500 INTERNAL_ERROR**.

Underneath, the real error, reproduced against the database as the `sparx_app`
role with `app.tenant_id` set:

```
ERROR:  update or delete on table "commerce_product_variants" violates RESTRICT
        setting of foreign key constraint "inventory_bom_components_variant_fk"
        on table "inventory_bom_components"
DETAIL:  Key (id)=(2f72d389-…) is referenced from table "inventory_bom_components".
```

## Why it matters

**Nothing she does can make her account hers.** She either sells a stranger's
olive oil on her bakery's website or she deletes ten products by hand — and the
first thing she does after that would be to wonder what else in here is not real.

It is also silent in the worst way at the system level: the clear runs in one
transaction, so the failure is total. Not "removed most of it" — nothing at all,
every time, with an error that does not say why.

## Where it lives

`wizeworks/packages/db/src/sample-data/engine/clear.ts`.

The file opens by naming the constraint it is built around:

> The two RESTRICT edges drive the ordering: CartItem→variant (drop cart items
> first) and BundleComponent→variant (drop bundles first); Order→customer (drop
> orders before customers).

There are **three** RESTRICT edges into variants, not two. The third is
`BomComponent.variantId`, and the clear never touches a Bill of Materials.

The row is created by the loader itself —
`src/sample-data/engine/inventory-depth.ts` builds one sample recipe whenever a
pack has at least three variants, so the assembly and buildable-quantity surfaces
have something real to compute against. Its own note reads:

> Sample recipe. Change the components, **or delete it with the sample data.**

Deleting it with the sample data is exactly what did not work.

## The fix

`clearSampleDataOnTx` now deletes the recipe before the products it points at,
in the same place bundles are handled and for the same reason:

```ts
await tx.billOfMaterials.deleteMany({
  where: {
    tenantId,
    OR: [
      { outputVariantId: { in: variantIds } },
      { components: { some: { variantId: { in: variantIds } } } },
    ],
  },
});
```

Matched by which variants it points at rather than by a `sample` marker, because
the row carries none — it is identified by what it references, the same way the
bundles above it are. Components cascade from the BOM. An `AssemblyOrder` that
referenced it is `SET NULL`, so a real batch history survives losing the recipe
it was built to.

**Both edges are covered on purpose.** Matching only `outputVariantId` would
leave a recipe whose OUTPUT is one of the tenant's real products but whose
components are sample variants — which is a recipe a person could plausibly have
built on top of the samples, and it would fail the clear the same way.

This is shared platform code and the fix is brand-blind: a sparx tenant hit it
identically.

## Confirmed by

> Re-ran P01 act 5 as Marisol, on the same screen, with the same data — and
> deliberately with one of HER products already saved first (Country sourdough,
> whole loaf, $8.50), because the act's own test is whether clearing costs her
> anything she typed.
>
> Pressed **Remove sample data** → confirmed → green toast: **"Sample data
> removed. Removed 10 products, 10 orders, 7 customers and 156 more records."**
> The pane flipped to **Not loaded** and now offers "Load sample data".
>
> Opened Sell → Products: **one row, hers**, `Country sourdough, whole loaf`,
> `/country-sourdough-whole-loaf`, **$8.50**, Not on sale. Checked the database
> for the rest: 0 customers, 0 orders, 0 bills of materials — and her **5 site
> pages are untouched**, because blueprint pages are not sample rows.

## Rating effect

mypiggles › Home › Practice data — Ease 1 → 9. It was a 1 for the only reason a
pane is ever a 1: she would have stopped. The pane itself is excellent — the
marked rows, the counts, the honest confirm, the two-way load/remove — and the
9 reflects that now the button works. (Recorded in [rating.md](../rating.md).)

## One thing left, small

The rail calls it **Practice data** and the pane it opens is titled **Sample
data** — two names for one screen, and the tab that appears in the dock carries
the second one. Filed as part of the copy sweep rather than separately; it is one
word in `lib/surfaces/catalog`.
