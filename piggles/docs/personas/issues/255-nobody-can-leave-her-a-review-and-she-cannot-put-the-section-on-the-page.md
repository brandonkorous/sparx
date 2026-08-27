# 255 — Nobody can leave her a review, and she cannot put the section on the page

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 11 — "leave a review as a customer on the published site"
**Surface:** the published site › a product page · and My Site › Page › Each product › Insert
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Act 11 opens by leaving a review on her own shop, the way one of her customers
would. The Everyday Tee's page is, in full:

```
The Everyday Tee
$42.00
Choose yours    XS · White … XL · Clay
Quantity
Add to cart
Shipping & delivery
Returns & refunds
```

No reviews. No stars. No "write a review". Nowhere to leave one, and nothing
saying anyone ever had.

So she goes to put one there: My Site › Page › **Each product** › Add & layers ›
Insert, and searches. Everything she would call it:

| she types  | she is offered                                                                           |
| ---------- | ---------------------------------------------------------------------------------------- |
| **review** | **Review score** — "Your rating, how many reviews it is from, and where they came from." |
|            | Preview Card — a hover-triggered link hovercard (matched on "preview")                   |
| **rating** | **Rating** — a bare star input, filed under Form                                         |
|            | **Review score** again                                                                   |

A **score** with no reviews under it, and a star **input** with nothing to submit
it to. She can put a rating summary on the page. She cannot put reviews on the
page, and she cannot put a form there for a customer to write one.

**Act 11's first job cannot be done by anyone.**

## What should have happened

A shop that sells clothing collects reviews. It is on the persona's "working end
to end" list for exactly that reason, and it is the ordinary thing a customer
expects on a product page.

She should be able to add reviews to her product page the way she adds anything
else, and a customer should be able to write one.

## Why it matters

- **It is silent, and it looks finished.** The product page does not say reviews
  are unavailable. It looks like a product page that simply has no reviews yet,
  which is what a new shop's page looks like — so nobody ever finds out the
  feature is unreachable rather than empty.
- **The score makes it worse, not better.** "Review score" is offerable today. An
  owner who adds it gets a rating summary on a page where nothing can ever
  produce a rating. A permanently empty number is a broken promise printed in her
  own shop.
- **Every layer below is already built.** This is not a missing feature; it is a
  feature nobody can reach.

## Where it lives

Everything works except the one place the owner touches.

| Layer                   | State                                                                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database                | reviews stored; `averageRating` / `reviewCount` returned on every product in the listing                                                                                                        |
| API — write             | `POST /v1/public/commerce/products/:handle/reviews`                                                                                                                                             |
| API — read              | `GET  /v1/public/commerce/products/:handle/reviews` — approved only, plus the summary                                                                                                           |
| Console moderation      | `get_reviews_pending_moderation`, `moderate_review(s)`, `respond_to_review`                                                                                                                     |
| Storefront renderer     | `components/sections/product-reviews.tsx` — summary + `<ReviewForm>`; wired into `section-renderer.tsx` at `case 'product-reviews'`, and `app/products/[handle]/page.tsx` renders that renderer |
| Old builder registry    | `sitebuilder-schemas/src/section-registry.ts` registers `product-reviews`, and `default-templates.ts` puts it on the DEFAULT product template                                                   |
| **New builder catalog** | **`silica-catalog/src/sections/index.ts` has one `Review score` label and no reviews section at all**                                                                                           |

The break is a generation gap. Product pages authored under `sitebuilder-schemas`
got `section('product-reviews')` in their default template; pages authored under
the silica catalog cannot get one, because the catalog the Insert palette reads
never carried the entry forward. Devi's product page is a silica page
(`silica_draft_tree` populated, both published trees NULL), so hers has no
reviews section and no way to acquire one.

`Review score` came across. The thing it scores did not.

## The fix

A `commerce.product-reviews` HOST CORE, added to
[host-nodes.ts](../../../../wizeworks/packages/silica-catalog/src/host-nodes.ts) and
mounted by the storefront in
[silica-host-cores.tsx](../../../../wizeworks/apps/site/components/silica-host-cores.tsx).
It appears in the Insert palette as **"Reviews and ratings"**, under Your shop:

> What customers said about this product: the star rating, their reviews, and a
> form for writing one. Put it on your product page.

A host core rather than a bound node tree, because reviews are a TRANSACTION and
not a read: a shopper types into a form and posts to the API, and what comes back
is moderated server-side. Binding refs can draw a list; they cannot carry a form,
and a reviews section without one is a wall nobody can write on. The core takes
the product handle the route already puts in scope and fetches its own reviews —
degrading to an empty list rather than throwing, so a reviews service having a bad
afternoon leaves the product page intact ([253]'s rule).

**NOT pinned.** Every other `Your shop` core protects money or identity — the
cart, the checkout, the sign-in form — and a tenant who deleted one would break
their own shop. Reviews are a choice: plenty of businesses deliberately do not
show them, and one that tries them and changes its mind has to be able to take the
section off the page. `site-chrome.test.ts` asserts the exact unpinned set and
went red on the addition, which is the tripwire working; the reason is written
into the list beside the entry.

The LOOK moved to `products/product-reviews-view.tsx`, shared with the legacy
bound section, so the two builder generations cannot drift into two designs for
the same thing. Author-tunable heading, empty-state line and a switch for the
form, matching the old `ProductReviewsConfig` so a page moving between
generations keeps its words.

## Confirmed

The whole round-trip, on the screen, as the two people involved.

**As Devi:** My Site → Page → Each product → Add & layers → Insert → typed
"review" → **Reviews and ratings** appeared beside Review score → inserted → Save
→ Publish. ("Save" needed [256] fixed first — no record template could be saved at
all.)

**As a customer, signed out, on the published site:** The Everyday Tee's page
showed _Reviews · No reviews yet — be the first. · Write a review_. Opened the
form, gave it five stars, signed it Tessa Wren, titled it "Holds its shape after a
hot wash" and wrote a real paragraph about the Clay M. Submit → **"Thanks for your
review! It'll appear once it's approved."**

**As Devi again:** Sell → Reviews → 1 waiting → the review, with her stars, her
title and her words → **Publish it** → badge went green, "Nothing else is waiting
for you right now."

**Back on the shop:**

```
Reviews
★★★★★ 5.0 (1)
★★★★★  Tessa Wren                                    Aug 26, 2026
Holds its shape after a hot wash
I bought the M in Clay to wear under things and it is what I put on first. …
Write a review
```

A review round-trips. Act 11's "done when" is met.

## Also true of her pages, and part of why this was invisible

Only **Home — Landing** is published. Each blog post, Each product, About, Each
collection and Each category all read "Not live yet", and the public product page
is rendered from a code fallback rather than from anything she has authored — so
editing the product template would not have changed the live page anyway until
she published it. The editor says so, quietly, in grey at the bottom: "Saved, but
never published — your visitors can't see this page yet."

That is [RULE #8](../CLAUDE.md) territory and is tracked with the site build, not
here.

## Related

Her nav offers Shop, Book, Journal, About and Contact, and two different pages
both claim to be the front page ("Home — Landing" badged _Also About_, "About"
badged _Also Home — Landing_). Recorded against the site build.

## Rating effect

The product page and the Insert palette, in [rating.md](../rating.md). Recorded
in the run log of [03-juniper-row.md](../03-juniper-row.md).
