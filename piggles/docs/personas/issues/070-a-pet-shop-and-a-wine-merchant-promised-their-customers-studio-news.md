# 070 — A pet shop and a wine merchant promised their customers studio news

**Status:** fixed (awaiting on-screen confirmation)
**Severity:** copy
**Found by:** P01 · Thistle & Rye · act 7 / standing checks
**Surface:** every tenant site's footer, and 44 marketplace blueprints
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** — (dev stack was down; see below)

## What happened

Every page of Marisol's bakery ended with:

> Join the list — new work, journal notes, and **studio news**, about once a month.

She never typed it. It is the starter's copy, and it was the only sentence on her
whole site she had not written — on a bakery, describing a design studio, and
promising a mailing frequency nobody had agreed to.

Chasing where it came from turned it into something bigger than her footer: the
same sentence ships in **48 marketplace blueprints**. A pet supplies shop, a wine
merchant, a bookshop, a chocolate shop, a tea house, a kitchenware store and a
café all promise their customers studio news.

## What should have happened

The starter's footer says something true about any business that can pick it. The
line beside it in the same function already does — `Everything you publish and
sell, in one place.` / `Everything you publish, in one place.` — so the newsletter
branch was the one that had never been written for the platform.

## How to reproduce

1. Open her live site, scroll to the footer. Every page, every time.
2. `grep -rl "studio news" marketplace-catalog/blueprints/` — 48 bundles.

## Why it matters

It is on the customer-facing side of a real business, at the bottom of every page,
and it describes somebody else's trade. A shopper reading it learns that this shop
did not write its own website.

## Where it lives

- [wizeworks/packages/silica-catalog/src/site-chrome.ts](../../../../wizeworks/packages/silica-catalog/src/site-chrome.ts) — `siteFooter()`, the `newsletter` variant's blurb. The seed for the starter AND every blueprint.
- 47 identical strings across `marketplace-catalog/blueprints/*/site.json`.

## The fix

One line, in the seed and in the shipped payloads:

> Join the list — we'll email when there's something worth knowing.

**Deliberately not split on `commerceEnabled`** the way the line below it is.
"New arrivals" is a shop's word and "new writing" is a publisher's, and
`sparx-restaurant-cafe` — which has no `commerce.json` at all — would get a wrong
one either way. This says what a mailing list is for and promises nothing about
how often, or about what kind of business is sending it.

**Three blueprints keep the original**, because for them it was never a leak —
it is tailored copy that fits: `sparx-artist-media`, `sparx-brand-newsroom` (a
product-studio newsroom) and `sparx-retail-ceramics-studio`. An artist's site
offering "new work, journal notes, and studio news" is correct.

The 44 payloads were patched **surgically**, the method
[060](060-the-menu-on-her-website-named-no-money-at-all.md) established: never
blanket-regenerate, because node ids re-mint and the committed bundles have
drifted from their generators. The diff is symmetric — **65 insertions, 65
deletions across 44 files** (44 footers plus the café's 21 currency lines from
060, which is in both sets).

**Her live site is not fixed by this.** The sentence is already in her published
page tree, which is her content, and rewriting a tenant's published page is not
mine to do. The seed is right for the next site; hers is one edit in the studio.

## Confirmed by

**Not yet on screen.** The dev stack was down. What did run:
`@wizeworks/silica-catalog` **1147 tests in 31 files, all passing** (including
`site-chrome.test.ts`, which asserts the footer's legal links and brand binding),
and the api-rest `blueprint-bundles.test.ts` **10/10**, which validates all 191
committed bundles still parse.

To confirm: open the footer of any newly created site.
