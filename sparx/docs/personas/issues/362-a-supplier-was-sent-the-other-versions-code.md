# 362 — A supplier was sent the other version's code

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · checking issue 171's open half (a product with several versions at different costs), as Doty
**Surface:** workbench › a product › Dropshipping, "Have a supplier ship this"; `PUT /v1/dropship/product-links`; the order email to a supplier (`dropship-worker/src/handlers/route.ts`)
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 on screen as Doty and in the dev outbox, 2026-10-19
**Blocked on:** —

## What happened

The S&B Cold Air Intake 75-5094 comes in two versions, Oiled (75-5094) and Dry (75-5094D).
"Have a supplier ship this" asked for one "Their code for it" and one "What they charge you" for
the whole product. Every version got that code and that price, and every order emailed S&B the
one code: a buyer of the Dry filter would be sent the Oiled one.

## What should have happened

With more than one version, the form asks for each version's code and price, and the supplier
is sent the code and price of the version that was bought.

## How to reproduce

1. On a product with two versions, have a supplier who takes orders by email ship it.
2. Buy the second version. The supplier's email gives the first version's code.

## Why it matters

The wrong part arrives at the customer, and the cost of every version but one is wrong in the
margin and the profit figures.

## Where it lives

The link holds one `supplierSku` and the supplier's item one `costPriceCents`; the PUT wrote
them onto every version, and the order email read the link's code for every line.

## The fix

- `@wizeworks/dropship` `hand-versions.ts`: each version's code and price kept on the supplier's
  item, in its `variants` list (the one an imported item keeps its versions in), naming our
  version; `supplierLineFor` picks a line's own version, else the product's one code.
- `PUT /v1/dropship/product-links` takes `versions` (every version on sale, each once) and prices
  each version on its own; the GET gives each version's code back.
- The order email uses `supplierLineFor` for each line.
- The form, with more than one version: "It comes in 2 versions. Give their code and price for
  each.", a code and a price per version with its margin (`dropship-versions.ts`). The panel
  reads "Their codes: …" and "They charge you $250.00 to $262.00".

Tests, red first: `dropship-worker/src/handlers/hand-versions.test.ts` (4) and the console's
`dropship-versions.test.ts` (4). dropship-worker 15 and the console's commerce 524 pass;
dropship, dropship-worker and api-rest `tsc` clean. Lint and format clean.

## Confirmed by

P01, 2026-10-19. As Doty, S&B Filters set to ship the 75-5094 intake: 75-5094 at $250.00 and
75-5094D at $262.00. The panel read "Their codes: 75-5094 for 75-5094, 75-5094D for 75-5094D",
"They charge you $250.00 to $262.00", and a margin per version. Renée bought the Dry filter on
account (O-000040); S&B's email read "their code 75-5094D · 1 × $262.00".

## Rating effect

—
