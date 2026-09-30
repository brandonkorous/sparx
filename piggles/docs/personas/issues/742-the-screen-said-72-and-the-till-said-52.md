# 742 — The wholesale screen listed the prices in the opposite order to the one that charges

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 265
**Surface:** mypiggles + sparx workbench — Wholesale price (the product panel); api-rest
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, with both rules on one version of one product
**Blocked on:** —

## The screen said $72.00. The till charges $52.00.

The pane renders four kinds of wholesale rule and puts the order it believes in
under its own heading:

> "Listed strongest first: **a price agreed with one business wins over a signed
> agreement**, which wins over a whole group's price."

It listed them that way too, and `product-pricing.ts` in api-rest said the same
thing in its header comment.

`pricingService.resolve` — the function that prices a cart line and a checkout —
does the reverse:

```ts
// 1. Contract price (B2B-only, highest priority)
if (input.companyId) {
  const contract = await tx.contractPrice.findFirst({ … });
  if (contract) {
    …
    return finishLine(input, unitPriceCents, trace);   // ← returns
  }
}

// 1.5. B2B pricing tier … resolve_b2b_price(…)          ← never reached
```

The contract price is looked up FIRST and the function **returns**, so
`resolve_b2b_price()` — which is where the per-business override and the group
rules live — is never consulted at all.

**MEASURED 2026-09-19, Juniper Row, both rules on MARLOW-KNIT-XL-MOSS for Loom
and Larder:**

```
standing price, no end date       $72.00    resolve_b2b_price(...) → 7200
agreed until Mar 31, 2027         $52.00    contract price, returns first
```

The screen said she was charging $72.00 for the Marlow Knit. She was charging
$52.00. Twenty dollars a garment, on the screen she would open to check.
[[feedback_a_promise_in_copy_is_a_contract]]

## Which one is right

The server. An agreement has a date on it and was signed; a standing price is an
ongoing arrangement with nothing promised. If a shop agreed $52 until March,
$52 is what it agreed, and a standing price added afterwards must not quietly
undo that. So the screen was changed to match the code, not the other way round.

## What was done

**The order is one exported string and one render order, in one file.**
`trade-price-order.ts` holds `STRENGTH_ORDER_SENTENCE`, the pane's subtitle is
that constant, and the lists render agreement → one business → a group.

> Listed strongest first: a signed agreement wins for as long as it runs, then a
> price set for one business, then a whole group's price.

**The row that will not be charged says so.** A standing price covered by a live
agreement for the same business and the same version now carries a warning badge
reading **Not what they pay**, and a sentence saying when it takes over:

> Not while the agreement above runs. This takes over on Mar 31, 2027.

Because a figure on a screen is read as the figure being charged, and this one
is a real price that nothing will bill for another six months.
[[feedback_never_present_absence_as_measurement]]

**The two comments that said the wrong order** — the pane's header and
`product-pricing.ts`'s — now say the right one, and say which function decides.

**`trade-price-order.test.ts` reads the charging code.** Nothing rendered can
tell a right order from a wrong one, which is how this shipped. So the test
asserts, in `wizeworks/packages/commerce/src/services/pricing-service.ts`, that
`contract_price` comes before `b2b_pricing_tier` AND that the contract branch
still `return`s — that return is the whole of why an agreement wins. It also
reads the pane, so the sentence and the list cannot drift.

Proved red twice: once by putting the pane's list back the way it was, once by
deleting the `return` from the charging code.

## Files

- `piggles|sparx/apps/workbench/surfaces/commerce/trade-price-order.ts` — new
- `piggles|sparx/apps/workbench/surfaces/commerce/trade-price-order.test.ts` — new
- `piggles|sparx/apps/workbench/surfaces/commerce/product-trade-pricing.tsx`
- `wizeworks/services/api-rest/src/routes/v1/b2b/product-pricing.ts`

## Proof

Three rules on one version, in the console, after the fix:

| what            | badge                                      | price  | note                                                        |
| --------------- | ------------------------------------------ | ------ | ----------------------------------------------------------- |
| Loom and Larder | Signed agreement                           | $52.00 | Agreed until Mar 31, 2027                                   |
| Loom and Larder | Just this business · **Not what they pay** | $72.00 | Not while the agreement above runs. Takes over Mar 31, 2027 |
| Stockists       | Everyone in this group                     | $48.00 | 50% below list price                                        |

`select resolve_b2b_price(variant, company)` → `7200`, and the contract branch
returns `5200` before it is called. The top row is what gets charged, and it is
now the top row.

Checked in light and dark and at 360px.
