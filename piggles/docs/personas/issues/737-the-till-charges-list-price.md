# 737 — The till charges list price, whatever the shop has agreed

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 263
**Surface:** mypiggles workbench — Take a sale (`commerce.sale.new`); api-rest
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, with a signed agreement and the shop's buyer at the counter
**Blocked on:** —

## What happened

Selling **The Weekend Set** over the counter. The till offered it at **$0.00**
while the shop's own website, one browser tab away, charged **$158.10** for the
same thing.

## What it really cost, measured in act 266

The first measurement was a mispriced bundle, which reads like an edge case. It
is not. With a real wholesale customer on the sale:

```
Loom and Larder, signed agreement on MARLOW-KNIT-XL-MOSS until Mar 31, 2027

  what the shop agreed        $52.00
  what the till offered       $96.00      ← the catalog's list price
  what the website charges    $52.00
```

**Forty-four dollars a jumper**, on the screen she uses when that shop's buyer
phones an order in. The agreement the business signed applied on its website and
nowhere else.

## Why

The till did not ask the pricing pipeline anything. It read the variant catalog
and posted that number straight through:

```
surfaces/commerce/sale-data.ts
  :121   priceCents: v.priceCents        ← /v1/commerce/variants, the LIST price
  :218   unitPrice: Number(line.price)   ← posted to the order as-is
```

`pricingService.resolve` is the function that knows what a thing actually costs
this customer, on this site, today. It applies, in order: a B2B contract price,
the account's pricing tier, an eligible price list, a bulk-quantity break, a
subscribe-and-save rate, and a bundle's own price. **The till applied none of
them.** [[feedback_screen_over_a_function_nobody_calls]]

## What it is NOT

Not a case of the till being wrong to allow an override. "Price each" is an
editable field on every line and the pane's own copy says a one-off is as real as
anything else, which is right: somebody at a counter needs to be able to type a
number. The defect was what the box was PRE-FILLED with.

## The open question, and where its answer already was

This was filed rather than fixed because of one question: what should happen when
the operator has ALREADY typed a price and then picks a customer whose agreed
price is different. Overwriting a typed number is what
[[feedback_honor_the_users_choice]] exists to stop; leaving it is the thing this
issue is about.

**The answer was already in the same file, thirty lines up.** The payment box has
always worked this way:

```ts
// Whether she has touched the amount. Until she does it tracks the total, so
// adding a second thing to the sale does not leave the till short.
const [amountTouched, setAmountTouched] = useState(false);
```

Track whether she has touched it; follow until she has; stand aside after. That
is the house answer to this exact question, written by whoever built the pane.
There was no decision to make, only a pattern to copy.
[[feedback_copy_the_house_layout_before_building]] · [[feedback_defects_are_not_his_decision]]

## What was done

**`POST /v1/commerce/pricing/quote`** — what a named customer pays for a basket,
on a site, today. A read that takes a body, because a basket is a list. It
resolves the customer's wholesale business the way the storefront does
(`resolveActiveB2bAccountId`, the ACTIVE membership and never the pointer alone
— see [744](744-filed-as-wholesale-and-charged-retail.md)) and returns the
engine's own `PricedLine[]`, trace and all.

**`pricingService.resolveForCustomer`** — the counter's version of
`resolveCart`. The difference is one line in the middle, and making every caller
remember it is how one of them forgets.

**The till asks, whenever the answer could have changed:** the customer, the
site, or a quantity. All three change it — an agreement belongs to one business,
a price list to one site, a bulk break to a number of units.

**Each line says what it is and why.** Three shapes, in `sale-price-note.ts`:

| when               | the row says                                                                    |
| ------------------ | ------------------------------------------------------------------------------- |
| nothing agreed     | nothing at all                                                                  |
| agreed, untouched  | Their agreed price · normally $96.00                                            |
| agreed, typed over | **Not their price** You have typed $80.00. They pay $52.00, their agreed price. |

A till that annotates every normal price is a till nobody reads, so the sentence
is spent only where the number is not the one on the shelf.

**Taking the customer off puts an untouched line back to the catalog price.**
Leaving the last customer's figure on screen is how a wholesale price gets taken
over the counter from somebody who was never entitled to it.

**The line carries the version again.** It read "Marlow Knit" where the picker
had said "Marlow Knit · XL · Moss", so two sizes on one sale were two identical
lines. Issue 182 gave the picker that ladder; the line dropped it.

## Not in sparx

sparx has no Take a sale surface: no `commerce.sale.*` in its catalog, and no
`useSellables` anywhere in the app. This issue's header originally named both
consoles, which was wrong. The endpoint serves both; the pane is Piggles' alone.
[[feedback_verify_capability_in_code_not_docs]]

## Files

- `wizeworks/packages/commerce/src/services/pricing-service.ts` — `resolveForCustomer`
- `wizeworks/services/api-rest/src/routes/v1/commerce/pricing.ts` — the endpoint
- `piggles/apps/workbench/surfaces/commerce/sale-data.ts` — `useAgreedPrices`, the reason map
- `piggles/apps/workbench/surfaces/commerce/sale-detail.tsx` — when it asks
- `piggles/apps/workbench/surfaces/commerce/sale-lines.tsx` — the row
- `piggles/apps/workbench/surfaces/commerce/sale-price-note.ts` — new
- `piggles/apps/workbench/surfaces/commerce/sale-price-note.test.ts` — new

## Proof

Five paths, driven on the screen with Tamsin Vale of Loom and Larder:

| what she does              | the line reads                                      |
| -------------------------- | --------------------------------------------------- |
| no customer yet            | $96.00, nothing said                                |
| picks Tamsin               | **$52.00** · Their agreed price · normally $96.00   |
| types $80.00 over it       | **$80.00** kept · Not their price · They pay $52.00 |
| swaps to a retail customer | $96.00, nothing said                                |
| takes the customer off     | $96.00, nothing said                                |

Checked in light and dark and at 360px, where the row folds and the badge sits
against the first line of its sentence.

Nine tests on the sentence, proved red by making it ignore whether she had typed
— which is what the pane did before: **3 of 9 failed.**
