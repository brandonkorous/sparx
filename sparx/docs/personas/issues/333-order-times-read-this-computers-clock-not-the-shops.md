# 333 — Order times read this computer's clock, not the shop's

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 9, the owner opens a stranger's order
**Surface:** every "when did this happen" stamp in both consoles: order payments, invoices, payouts, form submissions, CMS and media, webhooks, approvals, partner earnings
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-18
**Blocked on:** —

## What happened

Stripe took O-000035's payment at 09:28 UTC. In Bluffdale that was 3:28 AM, and the shop's receipt said so. The order's Money in said "Oct 18, 2026, 2:28 AM": the console was open on a computer set to Pacific time, and the stamp read that computer's clock.

Bookings, schedules and due dates already read the business's clock (issues 086, 885, 942). These stamps went through eight copies of one formatter in each console, and none of them asked.

## What should have happened

A time the business reads about its own shop is on the shop's clock, wherever the computer is.

## How to reproduce

1. On a computer set to another time zone than the business, open an order with a payment.
2. Compare Money in's time with the receipt.

## Why it matters

An owner travelling, or a bookkeeper in another state, reads every time an hour or more out, and a payment can land on the wrong day.

## Where it lives

- `sparx/apps/workbench/lib/shop-clock.ts` (new: `formatShopDateTime`, `setShopClock`), `lib/business-timezone.ts` (`useShopClock`), `components/workbench-shell.tsx`.
- The eight formatters: `surfaces/b2b/approvals-data.ts`, `builder/form-submissions-data.ts`, `cms/data.ts`, `cms/media-admin.ts`, `cms/webhooks-data.ts`, `commerce/data.ts`, `finance/format.ts`, `partner/format.ts`.
- The same in `piggles/apps/workbench` (`components/console-shell.tsx`, `builder/form-submissions-words.ts`, `commerce/order-format.ts`).

## The fix

- One setting, the shop's zone, that every formatter reads. The signed-in shell fills it from the business's time zone (`useShopClock`), so the sign-in page never asks. Each `formatDateTime` now returns `formatShopDateTime`.
- With no zone set, or a zone the browser does not know, a stamp reads this computer's clock, which is what every formatter did before.
- `shop-clock.ts` has no React in it, so a formatter that a server page imports stays importable.
- The shell holds its panes until the business's zone is in (`useShopClock` answers whether it is), the same hold it already shows while setup is read. A failed read answers too, as this computer's clock, so a hiccup never holds the console. Without the hold, a pane drawn before the zone arrived kept the computer's time: the first look at Gillett's order, during loading, read 2:28 AM.

Tests: `lib/shop-clock.test.ts` in both consoles (3: the shop's clock wherever the computer is, a dash for nothing, the computer's clock for an unknown zone). Suites over lib and the touched surfaces: sparx 151 files / 1192, Piggles 168 / 1346. Not checked: the workbench `tsc` (out of memory on this machine).

## Confirmed by

2026-10-18. On a computer set to Pacific time, O-000035's Money in reads "Oct 18, 2026, 3:28 AM", Bluffdale's time. With the hold in, the page was read every 50ms from the reload until it settled: only "3:28 AM" ever appeared.

## Rating effect

None to the scores.
