# 642 — Nobody can save anything, on the screen that lists what people saved

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 221
**Surface:** mypiggles › Sell › After the sale › Wishlists, and the tenant website's product page
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 221 (the block added to her own product page through the builder)

## What happened

Sell › After the sale › **Wishlists**:

> **Nobody has saved anything yet**
> When a shopper saves a product for later, it shows up here. Once a few have,
> this becomes a good list of what to keep in stock or put on offer: the things
> people want but haven't bought.

That is a promise about what happens next, and it is a good one. It is also
unkeepable. **No page on my website has anything a shopper can press to save
something.**

Measured 2026-09-18:

|                                                         |        |
| :------------------------------------------------------ | -----: |
| businesses with the shop switched on                    | **43** |
| saved lists on the platform                             |  **0** |
| items on them                                           |  **0** |
| published product pages                                 |     13 |
| of those, carrying anything a shopper can press to save |  **0** |

Zero is not "nobody wanted to". Zero is what a counter reads when nothing can
reach it.

## What DOES exist

Everything except the button on the page:

- the API (`/v1/public/commerce/account/wishlist`, add / remove / list)
- the client state that keeps saved items in step across a page
- a **`WishlistButton`** — the heart, written, styled, accessible, with the
  signed-out case handled
- an **account page** at `/account/wishlist` for the shopper to read their list
- a **link to it in the account menu**, in the starter every shop ships with

So a customer signs in, opens the menu, clicks **Wishlist**, and lands on a page
that will be empty for the rest of their life, because the only control that
could fill it is not reachable from anywhere.

## Why

`WishlistButton` is used in exactly one file: `product-detail.tsx`, the product
body of the **previous** builder generation. Product pages are now silica trees,
and a silica tree can only place what the catalog offers. The catalog offers no
save control, so the heart went out of reach the day the generation changed, and
nothing said so.

Her own product page, read from the database, carries three shop blocks:

```
commerce.product-reviews
commerce.product-questions
commerce.related
```

and no way to save.

## The precedent, sitting two entries above the gap

`host-nodes.ts` says this, about the questions core:

> It exists because the console's Questions queue was the only end of this that
> was built. A shop owner opened it, read "no questions yet", and had no way to
> learn that no page on her website could take one — **the queue was waiting on a
> doorbell nobody had fitted.**

That is this issue, written down, understood, fixed for questions, and not
carried across to the list one line below it in her own menu.
[[feedback_a_fix_leaves_its_neighbour_behind]].

## The fix

A **`commerce.product-save`** host core, so the control exists in the palette and
can go on a product page — old pages and new alike, which a change to the starter
composition could not do, because a published page is stamped.

- **Unpinned**, for the sentence reviews and questions already use: saving is a
  choice, and a shop that tries it and changes its mind has to be able to take it
  off the page.
- It **follows the size and color the shopper has chosen**. Saved items key on a
  version, not a product, so a control that always saved the first version would
  file a size 8 under a shopper who was looking at the 14. It watches the
  buy box's own version field and falls back to the default version when the
  product has only one.
- Author-tunable words (`Save for later` / `Saved`), because not every shop calls
  it that.

## Confirming it

Driven as Devi, through her own builder:

1. **My Site › Page › Each product › Insert**, typed "save". One result:
   **Save for later · Your shop · A heart a signed-in customer presses…**, with the
   heart beside it.
2. Added it. The canvas drew it **at its real size** — a bordered ♡ Save for later
   control — directly under the page-sized dashed skeletons for Reviews and
   Questions. That contrast is the point: a 40px control drawn as a dashed band
   would have made the buy box unstylable.
3. Its **Settings** carried both words (`Save for later` / `Saved`) and the
   sentence naming where what they save turns up: "shows up in Sell, under
   Wishlists".
4. **Save** said "Saved. Visitors still see the last published version", then
   **Publish** said "Published. Your site catches up within a few minutes".
5. Read back from the database: her published product page now carries
   `commerce.product-save`.

**Not checked on screen: the control on her live website.** Juniper Row is
billing-suspended, so her site serves the "Back soon" overlay to everybody, and
no other business's product page places the block. The render path is covered by
the unit test and the core is wired the same way the reviews core beside it is,
but nobody has pressed the heart on a live page.

It lands where the builder puts any new block — at the end of the page. On her
page that is under the reviews, which is not where a shopper looks for it; moving
it beside Add to cart is a drag in her Layers list and is hers to make.

## Guard

`product-save-words.test.ts` on the website, **9 tests**. The rules:

```ts
it('never saves a version the shopper is not looking at', …)
it('refuses a version this product does not have', …)
it('waits rather than guessing when several versions and none chosen', …)
it('says Saved once it is, so the state is readable at rest', …)
```

Proved red by making it always take the first version and naming the undo:
**4 of 9** fail.

`check:host-cores` passes at **8 chrome cores of 22** — this one is filed under
"Your shop", so the check does not demand a real-size mark for it. It got one
anyway, for the reason the check exists: the rule is about SIZE, and a heart is
small. A dashed page-width card in the buy box would be the same mistake the
check was written to catch, one category over.
