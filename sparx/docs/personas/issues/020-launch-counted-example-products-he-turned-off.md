# 020 — Launch counted example products he turned off, and promised no fee

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › Launch ("Your site is ready") and "Get paid"
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — Launch reads "7 pages · 2 emails · garage theme, installed and ready to edit" and states the 0.5% fee
**Blocked on:** —

## What happened

Two false sentences on the Launch screen:

1. **"7 pages · 6 products · 2 emails · garage theme, installed and ready to
   edit."** Doty had switched "Bring its examples" off. The database holds 0
   products for his business. The line read the template's catalog, not the install.
2. **"Flat per-module pricing: no per-seat fees, no cut of every order, no
   surprise overages."** The "Connect Stripe" button one step earlier is sparx Pay,
   and sparx Pay takes a flat 0.5% of every payment
   (`wizeworks/packages/payments/src/fee.ts`, `SPARX_PAY_FEE_RATE = 0.005`). The
   payments step never mentioned the fee at all. The marketing site already says it
   truthfully.

## Why it matters

The fee is money taken from every order he takes. Hearing "no cut of every order"
in setup and finding 0.5% on his first payout is the kind of thing that ends a
contract. The product count told him his shop had items it did not have.

## The fix

- sparx `step-launch.tsx`: takes `sampleData`; with examples off it counts only
  pages, emails and the theme; with them on it says "example products" / "example
  articles". Fee line: "Card payments through sparx Pay carry one flat 0.5% fee;
  connect your own card processor under Payment providers and sparx takes nothing."
- sparx `step-payments.tsx` and `story-get-paid.tsx`: the fee is stated where he
  connects Stripe.
- Piggles had both defects. `step-launch.tsx` now takes `sampleData` and its
  value line says "Card payments through the Stripe account you connect here carry
  one flat 0.5% fee" (no sparx product named; the fee code does not vary by brand).
  The file was 260 lines, so `ValuePoint` and `LaunchSuccess` moved to
  `launch-parts.tsx` under Piggles' 250-line rule.
- The story flow's launch (`story-go-live.tsx`) always installs with examples, so
  its count is true and is unchanged.

Whether Piggles should charge the fee at all is a pricing question for Brandon;
this fix only makes the screen say what the code does.

## Confirmed by

> Re-ran P01 act 1, Launch: "7 pages · 2 emails · garage theme, installed and
> ready to edit." and "Card payments through sparx Pay carry one flat 0.5% fee;
> connect your own card processor under Payment providers and sparx takes
> nothing." Database: 0 rows in `commerce_products` for the tenant.

Checks: sparx and Piggles workbench `tsc --noEmit` exit 0; eslint 0; prettier clean.

## Rating effect

Recorded with the first-run setup row.
