# 902 — Cost vs plan sent her to set costs on a list her items were not on

**Status:** fixed
**Severity:** **major** — the report's only way out was a dead end. Every line
it could name was missing from the screen its button opened
**Found by:** P03 · act 321
**Surface:** `inventory.costing.variance` (both consoles),
`wizeworks/packages/inventory/src/services/cost-reports.ts`,
`commerce.product.detail` (both consoles)
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** walked on screen as Devi. `costing.test.ts` asserts the row
carries its product (removing it reddens exactly 1 of 16).

## What she saw

Cost vs plan: "106 units have nothing to compare against. Everything that
arrived cost $1,083.12." The middle figure under it read **Not known, Nothing
here to add up**, one line above a banner that added it up. The button read
**Put in what they cost**, while the table already showed what they cost:
$3.83 and $18.55.

The button opened "What your stock cost you". All 67 rows loaded. Neither
LINEN-NAT-200 nor BRASS-BELT-1 was on it.

## Why

Two different gaps with one button between them. That list holds stock with no
cost at ALL. Anything that came in on a delivery has a cost from the delivery
(`avg_cost_cents` 1855 and 384). What Cost vs plan lacks is the PLAN: the
product's own "What it cost you" (`cost_cents`), or a per-location cost. Both
were empty, and no screen it pointed at could fill them. Act 257 called the
button "a named remedy with a working path"; it was never pressed with these
items on the screen.

## The fix

- Each line with no plan has **Set a plan**. It opens that product on its
  **Pricing** tab, on the "What it cost you" box. The row carries `productId`
  for it, and the product pane now opens on a named tab (`tab: 'pricing'`).
- The banner says to press it. The wrong button is gone from this screen; the
  four screens whose gap really is "no cost at all" keep it.
- The middle figure says **Only stock with a plan is counted here** instead of
  "Nothing here to add up".
- Saving a version's cost refreshes the cost reports. Before, she came back and
  the line still asked for a plan until she pressed Refresh.

## On the screen

Linen planned at $18.00: **$828.00 planned, $853.20 actual, $25.20 more
(3%)**. Brass at $3.80, switching back without Refresh: all 106 units compared,
**$1,056.00 planned, $1,083.12 actual, $27.12 more (2.6%)**, banner gone.
Devi's two plans stay, as her own data.
