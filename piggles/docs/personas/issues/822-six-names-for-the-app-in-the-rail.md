# 822 — Six names for the app in the rail

**Status:** fixed
**Severity:** copy, across six surfaces in each console
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `platform.settings.industry` and five others
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** the guard, proved red; seen on screen as Devi
**Blocked on:** —

## How it was found

Devi opened **What kind of business** to check what she had picked. Under each
card, a row of chips saying which parts of Piggles that trade would set up:

> Online store · Customers · Content · Email · AI

Her rail, four inches to the left, reads **Sell · Customers · Content ·
Messages · Connections**. Three of the five chips name something she cannot find
anywhere in her own console.

## One thing, six names

`lib/surfaces/nav.ts` has the answer, and resolves it through the brand's app
registry — for Piggles, straight out of the APPS list the rail itself is built
from. Six surfaces kept their own table instead. For `commerce` alone:

| where                                                 | reads        |
| ----------------------------------------------------- | ------------ |
| **`lib/surfaces/nav.ts`** (the one, via the registry) | **Sell**     |
| `automations/automations-catalog.ts`                  | Selling      |
| `integrations/data.ts`                                | Selling      |
| `sites/site-manage-scope.tsx`                         | Selling      |
| `industry/data.ts`                                    | Online store |
| `sample-data/data.ts`                                 | Online store |
| `builder/blueprints-words.ts`                         | Store        |

Six names, and the one a shop owner actually navigates by is the only one the
other six do not use. The rest of the table is the same story:

| slug        | the rail says   | the copies said              |
| ----------- | --------------- | ---------------------------- |
| `email`     | **Messages**    | Email (×4)                   |
| `ai`        | **Connections** | AI (×4)                      |
| `finance`   | **Money**       | Finance (×2)                 |
| `inventory` | **Stock**       | Stock (×2), Inventory (×2)   |
| `social`    | **Get Found**   | Social posts, Social posting |
| `staff`     | **My Team**     | Your team                    |

This is the same defect as one till sale reading four ways on four screens
(issue 260), one level up: not a fact about an order, but the name of the app the
fact lives in. And `channels.ts`, the file written to fix that one, carries the
lesson in its own header: _"a channel is a fact about an order and a fact may not
have four names."_ Neither may an app.
[[feedback_a_copy_edit_breaks_identity_lookups]]

## The reason the copies existed

`moduleLabel` took a `WorkbenchModule`, and every one of these callers holds a
plain `string` that came down from the API — a starter's module list, the packs a
sample-data bundle fills, the parts a blueprint needs, the modules a category is
unlocked by. Narrowing the parameter is what pushed six files to write their own
table instead of casting.

So the shared one takes a `string` now and degrades an unknown slug to itself,
which is exactly what all six copies already did, in one place.

## And the sentence that named the copies was right

`industry/data.ts` shipped its table under this comment:

> Plain-language name for a module slug, plus the hue it carries. A business
> owner reads "Online store", never "commerce".

The instinct is correct and it is pointed at the wrong table. Piggles does not
have modules and never names them: it has APPS, and the registry that names them
is the same one that draws the rail.

## Two false positives the guard had to learn

Both found while writing it, and both would have been wrong to sweep:

- **`KIND_LABEL` in `migration/data.ts`** is keyed on the kind of product a
  tenant is moving FROM. "Online stores" is what Shopify is, not what our Sell
  app is called; "Publishing platforms" is Squarespace, not Content.
- **`VERTICAL_LABEL` in `step-blueprint.tsx`** is keyed on a blueprint's vertical
  (retail / b2b / content / services).

Both share the `b2b` key with a real module table, which is why the rule is about
how MANY module slugs a table uses rather than about any one of them. The first
is listed by name in the check with its reason; the second falls out of the shape
rule on its own.

## Sell, Sell

Deduplicating revealed the consequence of an app fronting several modules: the
wholesale starter sets up `commerce` and `b2b`, both of which ARE Sell, so the
chips read **Sell · Sell**. That reads as a rendering fault rather than as two
parts of one app. Reduced to one chip per app, on the name rather than the slug.

## The guard

`scripts/check-app-names.mjs`, wired into `package.json` and the pre-push hook.
It reads the real `WORKBENCH_MODULES` union rather than a list of its own, and
fails on any object literal in `surfaces/**` that maps three or more module slugs
to display names.

**Its first draft was anchored to the start of a line**, and a table written on
ONE line slipped straight past it — which is the shape somebody reaches for
precisely when they think it is too small to matter. It found nothing when I
reinstalled the bug that way. Unanchored now, and proved red with the same
one-line table:

```
✖ app names: 1 surface keeps its own names for the apps

  piggles/apps/workbench/surfaces/sample-data/data.ts
     names cms, commerce, crm itself.
```

Green: **1782 surface files across both consoles, and not one of them keeps its
own table of what the apps are called (2 tables named as something else).**

## The starter descriptions, while the pane was open

Each card then described its trade the same way:

> A clothing store: size charts, an apparel catalog, US sales tax, tiered
> shipping, keystone markup, a VIP segment, and a newsletter + sale campaign.

Seven nouns, four of which are words RULE #3 names outright — catalog, segment,
markup — plus a `+` doing the work of "and". The auto-parts card had a `→` in it:
"a quote→invoice flow".

The heading above these cards promises "a head start built for it". The cards
then list the parts by their internal names, so the one screen that asks a
business what it DOES answers in the language of the thing being set up rather
than the thing being got.

All nine rewritten for Piggles in `lib/console/industry-words.ts`, keyed by the
starter's slug — a whole sentence rather than a word swap, because what a shop
owner wants to know is what she will HAVE afterwards:

> A clothing shop: sizes for people to pick from, a set of clothing categories,
> US sales tax, postage that goes up with the order, prices at double what you
> paid, a group for your best customers, and two emails ready to send.

The glyphs are fixed in the shared copy too, because an arrow standing in for
"that becomes" is sloppy in either console.

Its guard asserts three things the other vocabularies do not need: that every key
is a starter the API really offers, that every starter the API offers HAS a
sentence (absence is not a statement here — the platform's wording is wrong for
this brand in all nine cases), and that no rewrite reaches for a banned word or a
glyph.

## Files

- `piggles|sparx/apps/workbench/lib/surfaces/nav.ts` — `moduleLabel` takes a slug
- `piggles|sparx/apps/workbench/surfaces/{automations/automations-catalog,industry/data,integrations/data,sample-data/data,builder/blueprints-*}.ts`
- `piggles/apps/workbench/surfaces/sites/site-manage-scope.tsx`, `sparx/.../sites/site-detail.tsx`
- `piggles|sparx/apps/workbench/surfaces/industry/industry.tsx` — one chip per app, a toolbar status
- `piggles/apps/workbench/lib/console/industry-words.ts` — NEW
- `piggles/apps/workbench/lib/console/industry-words.test.ts` — NEW, 5 tests
- `wizeworks/services/api-rest/src/lib/industry-starters.ts`
- `scripts/check-app-names.mjs` — NEW, wired into `package.json` + `.githooks/pre-push`
