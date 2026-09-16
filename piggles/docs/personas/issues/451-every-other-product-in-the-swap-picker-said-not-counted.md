# 451 — Every other product in the swap picker said "Not counted"

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 110 (my own regression from act 109)
**Surface:** Selling › Returns › a return › Send the replacement
**Filed:** 2026-09-08
**Fixed:** 2026-09-08

## What happened

[450] put a count beside every version in the replacement picker, so a shop
owner could stop choosing what to send from memory. It shipped yesterday, I
confirmed it on screen, and I read the confirmation wrong.

The counts come from ONE request: `/v1/inventory?product_id=<the thing that came
back>`. The picker lists the **whole catalog**. So the map answers for one
product and the badge was drawn for every row:

| row                               | badge shown     | truth            |
| --------------------------------- | --------------- | ---------------- |
| a version of the returned product | correct         | correct          |
| **anything else**                 | **Not counted** | **nobody asked** |

I wrote in [450]'s confirmation: _"Searching `Tote` showed the two genuinely
uncounted totes badged **Not counted**"_. They were not genuinely anything. The
query never mentioned totes. Two rows happened to be right and the reasoning was
wrong, which is worse than being wrong, because it reads as evidence.

## The second half

`useProductStock` was guarded on `productId !== 'new'` only. A return line with
no product behind it (hand-typed, or a product since deleted) passes `''`, and
the endpoint types `product_id` as a uuid — so an empty one is a **400**. The
screen then has no data at all, and every single row in the catalog reads
**Not counted**.

## Why it matters

This is the exact rule the original fix existed to protect, inverted. "Not
counted" is a claim about the shop's records: it says _somebody looked and there
was nothing to find_. Saying it about a product nobody asked after is inventing a
measurement, the same way "0 left" over an untracked version would be ([444],
[446]).

And it points the wrong way for the decision it sits in. A shop owner sending a
different product instead — which is allowed, and is why the whole catalog is
listed — would read "Not counted" on a tote she has forty of.

## The fix

The counts now travel with the product they answer for.

```ts
export interface VariantStock {
  productId: string; // the ONE product these cover
  counts: Map<string, number>; // variantId -> how many to sell
}
```

`stockNoteFor(variant, stock)` returns **null** for a row outside that product,
and the picker draws nothing at all. Four answers, not three, and the fourth is
silence. The caller passes `stock` only once the read has actually returned, so
a return with no product behind it shows no counts rather than false ones — and
`useProductStock` no longer fires on an empty id.

The rule lives in `products-data.ts` next to `stockNoteKind`, in a `.ts` file, so
it can be tested; the `.tsx` picker only chooses a badge.

### Where the code changed

- `{piggles,sparx}/apps/workbench/surfaces/commerce/products-data.ts` —
  `VariantStock`, `VariantStockNote`, `stockNoteFor`, the empty-id guard
- `{piggles,sparx}/apps/workbench/surfaces/commerce/variant-picker.tsx` — the
  `stock` prop's shape, `StockNote` returning null
- `piggles/…/commerce/return-exchange-modal.tsx` and
  `sparx/…/commerce/return-actions.tsx` — build the covered shape, pass nothing
  when nothing was asked
- Tests: `{piggles,sparx}/…/commerce/products-data.test.ts` (+5 each)

Removing the coverage check reddens exactly one test, and its message is the bug
verbatim: `expected { kind: 'uncounted' } to be null`.

## Confirmed by

act 110, on screen at `localhost:3011`. The swap picker on return SO-1003 opened
on the injector's two versions badged **None left** and **18 to sell**, with the
Aero Jersey rows below carrying **no badge at all** — a different product, so the
screen says nothing about it.

## What this is an instance of

`[[feedback_never_present_absence_as_measurement]]`, broken by the fix that cited
it. The tell I missed: **I confirmed a screen without checking what the query
behind it had actually asked.** A badge that is right for the rows you look at
first is not a badge that is right.

## Rating effect

`Selling › Returns › a return` — recorded in [rating.md](../rating.md).
