# 190 — Nobody could choose a size or a color

**Status:** fixed and confirmed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 4
**Surface:** Juniper Row's own website — every product page
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Juniper Row · 2026-08-24
**Blocked on:** —

## What happened

The Ash Overshirt is sold in five sizes and three colors. Devi built all fifteen
versions, priced them, stocked them six each.

On its page there was **no way to pick one**. Title, price, description, a
Quantity box, and Add to cart. Nothing between them.

Add to cart worked. It added this, every time, for everybody:

```html
<input type="hidden" name="variantId" value="37e14f12-38ba-4582-ba4e-f53950c3492e" />
```

One version, fixed in the markup. A shopper who wanted an L in Bone pressed the
same button as a shopper who wanted an XS in Clay, and both of them bought
whichever one happened to be the default.

## What should have happened

She sells clothes. Choosing the size is the transaction.

## Why it matters

**Wrong money and wrong goods, silently.** Nothing on the page said a choice
existed, so nobody could have known to ask for one. Devi finds out when the
parcel comes back — and returns are already 22% of her orders, which is the one
number this business cannot afford to make worse.

It is not a Juniper Row problem. It is every shop on the platform that sells
anything in more than one version: a t-shirt, a candle in two scents, a coffee in
whole bean or ground.

## Where it lives

[commerce.ts](../../../../wizeworks/packages/silica-catalog/src/commerce.ts) —
`buyBox()` had no picker of any kind, and
[silica-data.ts](../../../../wizeworks/apps/site/lib/silica-data.ts) said so in
passing, as an aside inside a comment about something else:

> the buy box has no version picker, so the only thing its form can add to a cart
> is that one variant

**The platform has a complete picker and the live page never reaches it.**
`apps/site/components/product-detail.tsx` is 523 lines of exactly this: swatches,
availability computed per option value, an image that follows the chosen color, a
price that follows the chosen variant. A live product page takes the silica
record-template branch instead, and that branch never got one. Fourth time this
week the better thing turned out to be built and unreferenced ([183], [184],
[187]).

## The fix

**Radios, on the storefront, with no JavaScript.**

The record now carries `versions` — one entry per purchasable variant, labelled
from the OPTION VALUES in the product's own option order ("M · Clay"), never from
the variant title, which is usually the product code. `buyBox()` repeats them as
a radio group named `variantId`, and the hidden field appears only when there is
a single version: two controls of the same name would both post.

Four decisions worth keeping:

- **Radios, not a `<select>`.** An `<option>` would have to carry its id in
  `value` and its words as text, and a node carries ONE binding — the label would
  have to be a `<span>` inside an `<option>`, which browsers flatten. A radio
  splits cleanly. It is also the better control for five sizes, which want to be
  seen at once.
- **`required` on every radio**, so the browser refuses a submit with nothing
  picked rather than quietly defaulting to whichever came first.
- **Sorted by the owner's own option order**, XS through XL and then by color. The
  variants arrive in creation order, which read XS, S, M, L, S, XL.
- **The price joins the label only when the versions differ in price.** The buy
  box shows one price; a page saying $128 beside a picker holding a $145 version
  is quoting a price nobody can buy at. Every Ash Overshirt is $128, so no label
  carries a number.

`soldOut` also changed with it. It read the DEFAULT variant, which was right when
that was the only thing the form could add; now one sold-out size would have
taken the whole buy box down with it. It reads "no version is in stock", and each
version says "sold out" in its own label.

## Confirmed on screen

As a shopper on Juniper Row, at 1568px.

**The Ash Overshirt** shows **Choose yours** and fifteen radios, in her order:
XS · Clay, XS · Slate, XS · Bone, S · Clay … XL · Bone.

**Nothing picked, Add to cart pressed** — the browser refuses with "Please select
one of these options." pointing at the group.

**S · Moss picked on the Marlow Knit, added** — the basket line reads
`SKU: MARLOW-KNIT-S-MOSS`, and the line above it (added before this fix existed)
reads `SKU: MARLOW-KNIT`, which is the old behavior sitting there as its own
evidence.

Eight new tests pin the picker, the single-version fallback, the `required`, and
the fact that only one `variantId` control ever renders.

## What it exposed

The basket then named both of those lines "Marlow Knit" and left the product code
as the only difference — [194](194-the-basket-called-two-different-garments-by-the-same-name.md).

## Rating effect

None recorded — the tenant's own website has no row in [rating.md](../rating.md).
