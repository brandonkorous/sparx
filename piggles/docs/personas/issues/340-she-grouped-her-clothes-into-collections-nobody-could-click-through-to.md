# 340 — She grouped her clothes into collections nobody could click through to

**Status:** fixed — platform, and her own site; 56 shipped blueprints pending regeneration
**Severity:** major
**Found by:** P03 · Juniper Row · scoring her published site (RULE #8)
**Surface:** the published site › the header, the footer, `/collections`
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** the reach rule, which now reports it; 388 site-lint tests, red before green

## What happened

Devi grouped her nine garments into named collections, gave seven of them a banner
photograph, and wrote a description for seven:

| Collection        | Banner | Description | Live products |
| ----------------- | ------ | ----------- | ------------- |
| The essentials    | yes    | yes         | 4             |
| The core range    | yes    | yes         | 3             |
| Winter layers     | yes    | yes         | 3             |
| New in            | yes    | yes         | 2             |
| The knitwear edit | yes    | yes         | 1             |
| The tailoring     | yes    | yes         | 1             |
| Last chance       | yes    | yes         | 0             |

Her site has a `/collections` page that lists all of them, and it works.

Nothing links to it. Not the header, not the footer, not any page. Reading every
`<a href>` her published site emits, no href anywhere resolves to `/collections`.

The only visitor who will ever see that page is one who types the address.

## What should have happened

A page the platform creates is a page the platform can reach, or the owner is told it
cannot be.

## Why it matters

**She did the work and the work is invisible.** Seven banner photographs and seven
descriptions, each one a deliberate act in a console that asked for it, behind an
address with no road to it.

**It is the platform's page, not hers.** `starterPages` seeds `/collections` into every
commerce site. She did not create it and was never told it existed, so "she should have
linked it" is not a fair account of what happened.

**A shop with nine products and seven ways to group them is the case this is FOR.** Nine
items fit on one screen, so the collections are not a navigation necessity — they are
how she says what the clothes are for. That is the whole point of her site and none of
it is reachable.

## The check that should have caught it, and why it did not

`reach.ts` exists for exactly this. Its header says so, and the case it was written for
is Devi's, two runs earlier: _"an apparel maker wrote a size guide and a shipping-and-
returns page, published both, and linked neither."_

It stayed silent because of one line:

```ts
import { BUILTIN_PATHS } from './routes';

function servedByPlatform(address: string): boolean {
  return BUILTIN_PATHS.includes(address) || inOpenSubtree(address);
}
```

**`BUILTIN_PATHS` answers a different question.** It is `links.ts`'s list: the addresses
that EXIST, so a link pointing at one is not broken. That is the OUTWARD direction.
`reach.ts` asks the INWARD one — does anything actually get a visitor there. The two
sets overlap and are not the same, and the list contains all three seeded browse
indexes:

```
/cart  /checkout  /search  /account       ← reached by a platform control
/products  /collections  /category        ← reached by nothing at all
```

The test is whether you can NAME the control. `/cart` is the navbar's cart core.
`/search` is the header's search field. `/account` is the account core. Name the one
that opens `/collections` and there is none.

So the rule reported nothing, on a site where the finding was true, using a list that
had been correct for its own purpose. [[feedback_structural_checks_go_blind]] —
and this one is a variant worth naming: not a stale path that scans nothing, but a
CORRECT list borrowed to answer a question it was not built for.

**The test encoded it too.** `reach.test.ts` had a case named _"never reports the
storefront's own routes, which the platform reaches itself"_ with `/products` in the
list, asserting the bug.

## The fix

**Three parts, and the first is the one that matters.**

**1. The rule gets its own list.** `PLATFORM_REACHED` in
[reach.ts](../../../../wizeworks/packages/site-lint/src/reach.ts) holds only addresses
whose opening control can be named. The three browse indexes are gone from it, so the
rule now sees them. On her site it reports what is true, in her language:

> **Nothing on your site links to Collections**
> Collections is part of your site and works perfectly if you already know its web
> address, but no link anywhere on your site points at /collections. Nobody browsing
> your site can get to it by clicking… Add a link to it from your menu, from your
> footer, or from a page where someone would go looking for it.

**This is what fixes HER site**, and it is the honest fix rather than the tidy one. Her
footer is a stored published tree; no catalog change reaches it. The rule's own header
says the problem is that _"there is no screen anywhere that shows a page's roads"_ —
the pre-publish check IS that screen, and it now shows this one.

**2. New sites get the link.** `siteFooter`'s Explore column already force-adds
`/search`; `/collections` now joins it when Commerce is on. That column is the site's
"everything else" list, which is what a seeded browse index needs.

Deliberately NOT the navbar: that row is space-constrained and Shop is the destination
most shops want first. A footer link costs nothing and is where a visitor looks for the
full map.

**3. `/products` and `/category` are reported and left open**, named explicitly in
`lint.test.ts` rather than waved past with a rule-name exclusion.

**Correction, 2026-08-29.** This section originally said `/products` "renders the same
`commerce.plp` core as `/shop` — one page at two addresses" and that "deleting it is
probably right". Brandon:

> the /products and /category pages are not the same, the products page should list all
> products (with filters and search) and the category page should list all products (with
> filters and search) per category. that's obvious

He is right and the framing was wrong. They answer three different questions a shopper
asks — everything, everything in this category, everything in this collection — all three
must work, and none is a deletion candidate. Checking whether they actually DO that found
[341] (no search box on any browse surface, now fixed), [342] (the size filter out of
order) and [343] (a page serving another company's brand color).

`/category` is now linked from her footer, so what remains open is only `/products`'
chrome: it sits beside `/shop`, which the navbar already links and which renders the same
listing under her own intro copy. Listing "Shop" and "All products" side by side in one
footer reads as a mistake even though both pages are real, so whether the starter should
seed both is the question — and it is Brandon's, not mine.

## RULE #7 — measured before it was trusted

The rule's header records that it was measured across all 191 shipped blueprints and
reported nothing. Re-measured after the change, the sweep reports **56 bundles, every
one of them `/collections`, and nothing else** — `/products` and `/category` are already
linked in blueprint chrome, so the change adds no noise anywhere but the one real hole.

A blueprint's frame is STAMPED at generate time, so those 56 carry the old footer until
their generators re-run. That is 56 scripts, each bumping a blueprint version and a
journal entry — a deliberate release, not a side effect of a lint fix. Recorded in
`blueprint-sweep.test.ts` as an exact count with the remedy written down, so a 57th
bundle or a different rule hiding behind it goes red.

## Confirmed by

`site-lint`: **388 tests across 15 files** (was 385), all passing. Three new:

- the browse indexes ARE reported, with their addresses in order;
- a browse index goes quiet once something links it, so the rule cannot degrade into
  "always complains about /collections";
- the starter site's remaining unreachable pages are exactly `['/products', '/category']`.

`silica-catalog`: **1306 tests across 36 files**, all passing.

## Confirmed on screen, and her site is fixed too

Her pre-publish check, run as Devi after the change, reports all three — the exact set
the borrowed list was hiding:

> **Nothing on your site links to Products** … `/products`
> **Nothing on your site links to Collections** … `/collections`
> **Nothing on your site links to Categories** … `/category`

Before the change it reported none of them, on a site where all three were true.

**Then the remedy was tested, because a remedy printed on a screen is part of the
contract** ([[feedback_one_outcome_two_causes]]). The finding tells her to "add a link
to it from your menu, from your footer, or from a page where someone would go looking
for it", so that is what was done, as her: select a footer link, duplicate it, change
its words and where it goes, save, publish. It works, and the words on the field help —
_"A page on your own site starts with a slash, like `/contact`."_

One thing worth knowing for anyone following that path: a duplicated item lands
**immediately after its source**, so duplicating the LAST link puts the new one last,
behind the returns policy. Duplicating **Shop** instead lands it in position two, which
is where a browse destination belongs. Her live footer now reads:

> Shop · **Collections** · How it's made · Journal · About · Contact · Search · Size
> guide · Shipping and returns

Each publish took **2 minutes 40 seconds** to reach the page — [056] again, measured
twice more here.

Her `/collections` page, now reachable by clicking, is seven groups, each with its
photograph and the description she wrote.

**`/category` was linked the same way afterwards**, once Brandon's correction made clear
it is a real second browse axis rather than `/collections`' twin — she has an 18-node
category tree with products filed in five of its branches. Her live Explore column now
reads Shop · Collections · Categories · How it's made · Journal · About · Contact ·
Search · Size guide · Shipping and returns, and her pre-publish check went **16 → 15 →
14**, leaving only `/products`.

## Rating effect

Against `P03 site — Juniper Row`. Named in that row's gap column as item (3); this
closes the platform half and hands her the finding on her own site.
