# 873 — "Priced by weight" over a shop where nothing has a weight

**Status:** fixed
**Severity:** **major** — a delivery option named **Priced by weight** can be
built, saved and served over a catalog where not one sellable thing has a weight
recorded. The server prices those lines at a nominal **500 g** so a quote is
always obtainable, and says so to nobody. The bands are then really counting
items, and any live carrier quote is priced on a guess the shop is billed the
difference on
**Found by:** P03 · act 309, opening Selling by data weight with the dev ports
down, from the code and the database
**Surface:** mypiggles › Selling › Postage and delivery, in both consoles
**Filed:** 2026-09-29
**Fixed:** 2026-09-29
**Confirmed by:** 12 tests, proved red on two plausible wrong rules

## Measured

Devi's own shop, using the storefront's own rule for a thing a shopper can buy
(an active undeleted product, an undeleted version, `requiresShipping`):

```
buyable things that must be posted      106
of those, no weight at EITHER level     106      ← every one
```

Platform-wide:

```
buyable things that must be posted    2,369
no weight at either level             1,280   (54%)
tenants with at least one gap            40
tenants with NOT ONE weight recorded     36
```

Her catalog holds 53 products and 233 versions in total; 106 are live and
buyable. Product-level `weight_grams` is NULL on **all 642 products** on the
platform, so the product fallback never rescues a version anywhere.

## The chain

`resolvePackageForItems` walks version → product → a default:

```ts
weight +=
  (item.weightGrams ?? item.productWeightGrams ?? DEFAULT_ITEM_WEIGHT_GRAMS) * item.quantity;
```

```ts
const DEFAULT_ITEM_WEIGHT_GRAMS = 500;
```

Its own doc comment is honest about it:

> Per-item weight/dimensions fall back variant → product → a nominal default
> when a merchant hasn't filled either in, so a quote is always obtainable.

**That decision is correct and is not what was fixed.** A checkout that refuses
to quote over a field the shop never filled in is worse for everyone. What was
wrong is that it was silent.

## What the silence costs, in two different ways

**The bands stop meaning anything.** `computeManualRate` sends that weight
straight into the band picker:

```ts
case 'by_weight':
  return pickBand(rate.bands, ctx.weightGrams);
```

A real set of bands, from the platform's own preset:

```
0 .. 0.5 kg   $5.95
0.5 .. 1 kg   $7.95
1 .. 2 kg     $11.95
2 kg and up   $19.95
```

With every line at 500 g, one item is always $7.95 and two are always $11.95.
**A winter coat and a silk scarf cost the same to post, and the bands are
counting items under a label that says weight.** The console already offers
"Priced by number of items" three rows up the same dropdown.

**A live carrier bills the real parcel.** `tryLiveRates` sends the same package.
The carrier quotes 500 g, the shopper is charged that, and the shop pays the
counter price. That difference comes out of the shop, on every order, and
nothing on any screen mentions it.

## Nothing checked, and nothing said

The weight field exists and is well built — `variant-parcel.tsx`, under **"For
working out postage"** on a product's Versions tab. The rate editor offers
**Priced by weight** in position four of five. Neither knows about the other:

- the rate editor's only mention of weight is the band unit label (`kg`);
- `assertRateInputCoherent` checks a band exists, never that a weight does;
- the product surface never says a missing weight matters to anything.

So the offer is live, the save succeeds, and the first honest signal is a
carrier invoice.

## Its own neighbor already solved this exact silence

One screen up, on the same surface:

```ts
/**
 * Live rating silently degrades to manual rates when the ship-from is missing
 * (`tryLiveRates` swallows the error by design, so checkout never breaks). That
 * is correct for the shopper but leaves the MERCHANT in the dark — they connect
 * a carrier, expect USPS/UPS to appear, and never learn the warehouse address is
 * the reason it doesn't.
 */
export async function getLiveRateReadiness(ctx: ServiceContext);
```

Same author, same surface, same sentence, one silence answered and the next one
not. So the fix went into `LiveRateReadiness` rather than beside it.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What it says now

At the moment **Priced by weight** is chosen, directly under the control:

```
These steps would not do what they say
Not one of the 106 things you sell has a weight recorded, so each one counts as
0.5 kg when a delivery price is worked out. Two very different orders can land in
the same band that way. Open a product, go to its Versions tab, and fill in
Weight under "For working out postage".
```

On an option already saved that way, above the list, because a rate built last
month is priced on the guess today and the composer warning cannot reach it.

And when a carrier is connected, beside the ship-from warning it mirrors:

```
Your carrier is guessing what your orders weigh
Not one of the 106 things you sell has a weight recorded, so your carrier is
asked to price each one as 0.5 kg. A shopper can then be quoted less than the
carrier bills you, and you pay the difference. Open a product, go to its
Versions tab, and fill in Weight under "For working out postage".
```

**Two sentences, not one, because they are two different harms.** The bands harm
is that the bands stop distinguishing anything. The carrier harm is money. A
single sentence would have described the wrong problem to one of the two readers,
and a test asserts they cannot drift into each other.
[[feedback_one_outcome_two_causes]]

## Honest about the blast radius

**Devi is not being charged wrong today.** Her two rates are `flat` and
`free_above_threshold`, and she has no carrier connected (one Shippo install
exists platform-wide and it is not hers). Exactly one `by_weight` rate exists on
the platform.

The defect is in **the offer**, not in her current setup: the control is in a
dropdown she is shown right now, and choosing it produces a silently wrong price
with no error, no warning and no way to find out. Filing it on the strength of
the offer rather than waiting for the invoice is the whole point of looking.

## Counted, not guessed

`itemsMissingWeight` walks the resolver's own chain — NEITHER level set — rather
than just `variant.weightGrams IS NULL`. A count that disagreed with the resolver
would warn about quotes that are fine and stay quiet about ones that are not.

`assumedWeightGrams` is reported by the server rather than repeated in the
console, and `DEFAULT_ITEM_WEIGHT_GRAMS` was made public to do it. Two copies of
the same assumption is how a sentence ends up describing a quote that is no
longer computed that way.
[[feedback_never_present_absence_as_measurement]]

The readiness read never throws, and the counts fall back to 0, because a
readiness probe must not fail the page it informs. **0 missing is the quiet
answer**, which is the correct failure direction: a probe that cannot count says
nothing rather than alarming a shop about a number it does not have.

## Proved

**12 tests**, proved red on two plausible wrong rules:

```
drop the "posts nothing" guard, and let the every-item sentence keep its denominator
  →  2 of 12 fail
```

Both breaks look like improvements. Dropping the guard is the obvious
simplification and warns a collect-only shop about a chore it does not owe.
Keeping the denominator on "106 of the 106" reads as though some are fine.

**Checks:** typecheck 0 on `@wizeworks/commerce`, api-rest, and both workbenches.
Tests: piggles workbench 153 files / 1464, sparx 129 / 1200, commerce 24 / 241.
`weight-readiness.ts` is byte-identical in both consoles.

## Files

- `wizeworks/packages/commerce/src/services/shipping-request-resolver.ts` — the
  default made public, with why
- `wizeworks/packages/commerce/src/services/shipping-service.ts` —
  `LiveRateReadiness` gained the two counts and the assumption
- `{piggles,sparx}/apps/workbench/surfaces/commerce/weight-readiness.ts` (new)
- `piggles/apps/workbench/surfaces/commerce/weight-readiness.test.ts` (new)
- `{piggles,sparx}/apps/workbench/surfaces/commerce/shipping-data.ts`
- `{piggles,sparx}/apps/workbench/surfaces/commerce/shipping.tsx`
- `{piggles,sparx}/apps/workbench/surfaces/commerce/shipping-rate-editor.tsx`

## The thing to remember

**A fallback that keeps a screen working is a measurement the moment a price is
computed from it.** Nothing about `?? DEFAULT_ITEM_WEIGHT_GRAMS` looks wrong:
it is documented, it is deliberate, it keeps checkout alive, and it is the right
engineering call. It becomes a defect at the point a band, a carrier and an
invoice are all derived from it while the person paying is never told the number
was invented.

The question that finds this shape is not "is this default correct" but **"who is
charged on it, and do they know?"**

## Also found on this surface, and correctly not filed

- **`commerce_product_option_values.swatch_image_id`** — NULL on all 1,168 rows.
  Both consoles already know: `displayItems` hides the "Small pictures" option
  unless a product already uses it, with a comment saying there is nowhere to
  choose a picture yet and "offering it would be offering a dead end". A gap
  handled on purpose, in both brands, with the reasoning written down.
- **`commerce_products.og_image_id`** — NULL on all 642. Not a gap: it is an
  override, and `product-seo.tsx` falls back to the product's main photo and says
  so on screen. A truncated grep made this look like a piggles-only gap; reading
  both files showed the picker is present and identical in each.
- **Her 233 versions' option coordinates** — 203 fully placed, 30 on products
  with no choices, **0 homeless or partial**. The Variants tab's whole
  retired/stranded/homeless apparatus (issues 172, 305, 306) is sound and her
  data hits only its happy paths.
- **`commerce_product_variants.costing_method` / `default_bin_id` /
  `stocking_uom_id` / `markup_rule_id`** — all NULL platform-wide. All four are
  per-version overrides of a shop-level policy, which is the correct shape for a
  setting almost nobody changes.
