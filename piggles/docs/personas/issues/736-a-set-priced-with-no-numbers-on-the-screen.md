# 736 — A set priced with no numbers on the screen, and a price nothing charged

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 263
**Surface:** mypiggles + sparx workbench — Bundles; api-rest pricing pipeline; the storefront
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, end to end: built a real set, then bought it on her own website
**Blocked on:** —

## 1. The pricing mode was read by nothing

**The bundle form has collected three ways to price a set since the day it
shipped — add up the parts, a flat price, a percentage off the parts' total —
and NOTHING read any of them.**

```
grep pricingMode / percentOffSum across wizeworks/**   2026-09-19
  → the service that writes it
  → the schema that validates it
  → the seed that fills it
  → the availability calculator, which ignores price
  cart-service.ts     : no reference to bundles
  pricing-service.ts  : no reference to bundles
  checkout-service.ts : no reference to bundles
```

So a shop could build a gift set, set it to 15% off, watch it save, and sell it
for whatever number happened to be sitting on the wrapper product — which is a
placeholder the create form demands and nobody is ever asked to think about.

**MEASURED on Juniper Row, 2026-09-19.** The Weekend Set (Ash Overshirt M·Moss
$128 + Silk twill scarf $58, 15% off) with a wrapper price of $0.00:

|                        | before              | after       |
| ---------------------- | ------------------- | ----------- |
| Shop card              | $0.00               | **$158.10** |
| Product page           | $0.00               | **$158.10** |
| Cart                   | $0.00               | **$158.10** |
| The console's own form | said nothing at all | **$158.10** |

**The same fault is written up two steps below the fix, in the same function.**
`pricing-service.resolve` carries a comment about the B2B pricing tier: "it was
never actually called from here, so a merchant could configure a tier discount,
assign it to an account, and see it saved in the dashboard while every real
storefront/checkout price stayed at list." The bundle was the next one.
[[feedback_screen_over_a_function_nobody_calls]]

**What was done.** A `bundle_price` step in `resolve`, immediately after
`variant_base`, which it REPLACES rather than stacks on: the wrapper variant's
own number is a placeholder, not a base. Everything after it — contract price,
price list, bulk tier, discounts — layers on exactly as before, so a price list
naming the wrapper still wins. That is right: a price list is somebody deciding
what the set costs, against a figure derived from its parts.

Selected in the SAME query as the variant (`product.bundlesAsWrapper`, `take: 1`
under a unique index), so pricing a basket of ordinary garments costs no extra
round trip.

## 2. The display had to follow, or the fix would have been its own defect

Turning the pipeline on made the cart charge $158.10 while the product page
still said $0.00. **A price shown that is not the price charged is worse than
either number on its own**, so both read paths were fixed in the same act:
`publicProduct` (the shop card) and `mapFullProduct` (the buy box) both compute
the set price from the components.

Computed on the PRODUCT, not resolved per viewer. A set's price does not depend
on who is looking, so the anonymous card and PDP stay viewer-independent and
cacheable — which the existing "your price" branch deliberately protects, and
which a `pricingService.resolve` call per variant would have cost.

## 3. The form asked her to price a set and showed her no numbers

Three modes, three sentences, all of them about a total none of them printed:

- "The set costs whatever its parts add up to at their normal prices."
- "The set costs this much less than buying the parts on their own."
- **"Shoppers pay exactly this, whatever the parts add up to."** — which names
  the number in the act of withholding it.

So she could not tell whether a flat price was a discount or a markup, and a
percentage off produced no figure she could compare to anything.

**And the pane HAD every number.** The picker prints `$128.00` beside each row.
`addComponent` destructured five of a `VariantChoice`'s fields and dropped the
rest on the doorstep, one line below where the price had just been rendered.
[[feedback_fetched_but_never_rendered]]

Now: each part shows its price (`3 × $58.00 = $174.00` when there is more than
one), the list is followed by **"2 parts add up to $186.00."**, and the pricing
card ends with what a shopper pays. The arithmetic is `bundlePartsTotalCents` +
`bundleSetPriceCents` in `@wizeworks/commerce-schemas` — the SAME two functions
the pricing pipeline charges with, so the figure she reads while setting it up
and the figure the till takes cannot drift.

**One amber warning**, for the one answer that is almost always a slip:
"Shoppers pay $200.00, which is $14.00 MORE than buying the parts on their own.
Check that is what you meant." It warns rather than blocks — it is a legal thing
to do — but nothing on this form would have told her, and a shopper adding up
the product pages works it out in four seconds.

## 4. Every part of every bundle was a raw SKU

A row picked as **"The Ash Overshirt · M · Moss"** came back reading
**"ASH-OVERSHIRT-M-MOSS"**. `addComponent` branched on `variant.title`, which
the variant-catalog endpoint's own comment says "is empty on every seeded
variant" — the exact reason issue 182 taught that endpoint to send the option
values instead. The fix reached the picker and not the list the picker fills.
[[feedback_a_fix_leaves_its_neighbour_behind]]

The option sort now lives in ONE function, `variantOptions` in
`@wizeworks/commerce`, used by the variant catalog AND by `getBundle`. A rule
applied to one of N places is this repository's most common defect shape, and a
shared function is the only version of it that cannot drift.

`getBundle` also sends `priceCents` and `currency` now, so a bundle opened a
week later shows the same money the form showed while it was being built.

## Found here, NOT fixed here

**The till prices everything at list.** `commerce.sale.new` reads
`priceCents` off the variant catalog and posts it as `unitPrice`. It never calls
`pricingService.resolve`, so it applies no bundle price, no price list, no B2B
contract or tier, and no bulk break. MEASURED: The Weekend Set offered at
**$0.00** at the counter while the website charged $158.10.

That is wider than bundles and needs a decision about override semantics on a
screen whose whole purpose is writing a sale down by hand, so it is its own
issue: [737](737-the-till-charges-list-price.md). Not parked — filed, with the
measurement, on the same day.

## Checked and NOT a defect

**Optional parts count toward the total.** "Optional" means the storefront may
swap or drop a part at pick time, and there is nowhere for a shopper to say they
did, so pricing as though they had would undercharge every real sale. Recorded
in `bundlePartsTotalCents`' own doc comment with the condition that would change
it: the day a cart line can carry "this set, without the scarf".

**A fallback mode falls back to the PARTS, not to free.**
`assertBundlePricingCoherent` rejects a mode with no number on the way in, so it
should be unreachable. Unreachable and free are different, and a set that
silently costs nothing is the worse of the two by a distance.
[[feedback_never_present_absence_as_measurement]]

**The create form cannot make its own wrapper product.** "Sold as" only offers
products that already exist, so a shop wanting to sell "The Weekend Set" has to
leave, create the product, and come back. Real friction, not a defect: the
wrapper is fixed for the life of the bundle and choosing it deliberately is the
point. Noted for the punch list.

## Files

- `wizeworks/packages/commerce-schemas/src/bundles.ts` — `bundlePartsTotalCents`, `bundleSetPriceCents`
- `wizeworks/packages/commerce-schemas/src/bundles.test.ts` — new
- `wizeworks/packages/commerce-schemas/src/pricing.ts` — the `bundle_price` trace step
- `wizeworks/packages/commerce/src/variant-options.ts` — new
- `wizeworks/packages/commerce/src/variant-options.test.ts` — new
- `wizeworks/packages/commerce/src/index.ts`
- `wizeworks/packages/commerce/src/services/pricing-service.ts`
- `wizeworks/packages/commerce/src/services/configurator-service.ts`
- `wizeworks/services/api-rest/src/routes/v1/public/commerce.ts`
- `wizeworks/services/api-rest/src/routes/v1/commerce/lists.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/bundle-price-words.ts` — new
- `piggles|sparx/apps/workbench/surfaces/commerce/bundle-price-words.test.ts` — new
- `piggles|sparx/apps/workbench/surfaces/commerce/bundle-detail.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/products-data.ts`

## Proof

On screen, in Juniper Row's console and on her own website:

1. Built **The Weekend Set** from the Ash Overshirt (M · Moss) and the silk
   scarf. Each row named its version and its price; the list said **"2 parts add
   up to $186.00."**
2. **Add up the parts** → "Shoppers pay $186.00, the same as buying the parts on
   their own."
3. **15% off** → "Shoppers pay $158.10, saving $27.90 against the parts on their
   own."
4. **A flat $200.00** → the amber warning, naming the $14.00.
5. Saved it at 15% off, reopened it, and the parts came back from the server
   with their versions and their prices intact.
6. Opened the shop on **juniper-row** at localhost:3004: the card read
   **$158.10**, the product page read **$158.10**, and adding it to the cart
   charged **$158.10**. The wrapper product's own price is still $0.00.

Both console typechecks, commerce, commerce-schemas and api-rest all clean;
ESLint clean on every changed file. Piggles 1,046 tests / 115 files, sparx
916 / 102, commerce 225 / 22, commerce-schemas 519 / 19. All 53 structural
checks pass. The three new pure modules were proved red by breaking what they
guard: four deliberate breaks reddened exactly five tests, each the right one.
