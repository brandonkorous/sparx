# 053 — "Sold out" was a thing her website could not say

**Status:** fixed
**Severity:** **blocker** (every sold-out product on every tenant site stayed on sale)
**Found by:** P01 · Thistle & Rye · act 11 — mark the seeded rye out of stock
**Surface:** the tenant site › any product page, and the shop grid
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 11 — **Seeded rye** and **Morning bun**, both on screen

## What happened

Her cardamom buns had sold. The console said so in the plainest words it has —
**On the shelf −1 · None to sell** — and the product's own setting said **"When
you run out of this one: Stop selling it."**

Her website showed the buns at $16.00 with a **Add to cart** button. Clicking it
did nothing at all. No message, no error, no line in the basket. The basket
stayed empty and the page said nothing about why.

Her own description of that product, written by her, is _"Weekends only, and
they are usually gone by eleven."_ So from eleven every Saturday, every visitor
to that page clicked a button that did nothing.

## Why it matters

This is not a missing badge. Three things are wrong at once and each is worse
than the last:

1. **She is offering something she does not have.** Somebody standing at a bus
   stop decides to buy a box of buns and cannot, and is told nothing.
2. **The setting she chose was ignored.** `Stop selling it` is a real per-version
   choice with real words on it. It was honoured by the API and by nothing the
   shopper could see.
3. **The failure was invisible by construction.** The POST came back `409` — the
   right answer, with a good sentence in it — and silica's form behaviour
   announced that sentence into a live region it BUILT for the purpose: `1px ×
1px`, `clip-path: inset(50%)`. A screen reader heard "Sorry, this item just
   sold out." A sighted shopper watched the button depress and nothing happen.

It is every tenant, not this one. The buy box is the platform's, seeded into
every site.

## Why it happened

The PDP renders through the silica engine's `commerce.product` template, and
that template's `addToCartForm()` in `@wizeworks/silica-catalog` bound the
variant id and a quantity and **never read stock at all**. The record already
carried the answer — `productToSilicaRecord` puts `inStock` on it, right beside
the `lowStock` the low-stock badge binds — and nothing looked at it.

The React `product-detail.tsx` does this properly: disabled button, "Sold out",
preorder wording, "Only 3 left". That path is now reachable only for sample-data
previews. The engine path replaced it and did not bring the behaviour along.

## The fix

**The buy box tells the truth.** `buyBox()` now hangs the add-to-cart form and a
sold-out notice off the same bind, one negated, so a product that cannot be
bought never renders a control that says it can:

> **Sold out**
> This one has gone for now. We will put it back as soon as we have more.

The bind is `soldOut`, **not** `inStock`, and that is the load-bearing detail.
silica DROPS a node whose ref resolves absent, so binding `inStock` would have
hidden the buy button on every record that does not carry the field — an older
stored shape, a theme preview, a fixture. Not knowing a product's stock is not
the same as knowing it has none. `soldOut` is set only when the answer is
actually no, which puts absence on the sellable side, exactly as
`computeAvailability` does for a variant nobody has counted.

It reads the **default variant's** `inStock`, not the product's. The buy box has
no version picker, so the only thing its form can add to a basket is that one
variant — and the variant's figure is computed per request from live levels,
where the product's is a denormalized column that can lag (it did: see
[054](054-the-first-count-of-zero-never-reached-her-website.md)).

**The card says it too.** `productCardNode` gained an outline "Sold out" chip on
the same bind, and `toSilicaProduct` carries `soldOut` so a grid can show it. A
shop that prices ten things identically and lets a shopper find out which two
are gone by opening each one is not a shop front.

**A failed add is no longer silent.** The form now authors a real
`data-sui-part="status"` line under the button, so the behaviour writes its
message into something a person can see instead of inventing the clipped one.
`empty:hidden` keeps it out of the layout at rest, and `data-success-message` is
deliberately empty — the cart drawer opens on success, so the only thing left to
say is what went wrong.

Three tests pin all of it, including the one that matters most: a record with no
`soldOut` at all still renders **Add to cart**.

## Confirmed

- **Seeded rye**, counted at zero: the buy box is gone, replaced by the sold-out
  notice. Her page, her theme, her words.
- **Morning bun**, counted at zero: **Sold out** on the shop grid at
  `/products`, on the card, over the image.
- A product nobody has counted still sells — every other loaf on her shop is
  untouched.

## What it exposed next

Two things, both filed:

- [054](054-the-first-count-of-zero-never-reached-her-website.md) — the first
  count of zero never updated the product flag, so the fix above worked on the
  product page and not on the grid until the ledger was fixed too.
- [055](055-the-stock-screen-could-not-find-a-loaf-she-had-never-counted.md) —
  before any of this, there was no way for her to SAY the rye was out.

## Still open, for Brandon

**No silica form can show a sighted visitor an error.** The buy box now authors
its own `status` part, which fixes the buy box. Every other silica form — the
contact block, the newsletter capture — is authored upstream in
`@wizeworks/silicaui-html`'s block library, has no `status` part, and therefore
settles every failure into the same invisible 1px region. `BehaviorRole` does not
even list `status`, so the part cannot be authored through `part()` without a
cast (this fix sets the attribute directly). That is a silicaui-level change.
