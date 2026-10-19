# 336 — "She says she never got the receipt"

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 9, the owner's side of a stranger's order
**Surface:** console › an order › Who bought it (both consoles); `wizeworks/services/api-rest`
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-18
**Blocked on:** —

## What happened

A buyer who says her order confirmation never came is the commonest call a shop takes after a sale. Nothing on Doty's order could send it again. Only WizeWorks support had that (`/internal/operator/…/resend-confirmation`), so the owner's answer was a screenshot.

## What should have happened

One button on the order sends the same confirmation again, to the address on it, and says where it went.

## How to reproduce

1. Open any order with a customer email.
2. Look for a way to send the confirmation again.

## Why it matters

A buyer without her receipt does not know her order went through, and the shop looks like it lost it.

## Where it lives

- `wizeworks/services/api-rest/src/routes/v1/orders.ts` (`POST /v1/orders/:id/resend-confirmation`).
- `sparx/apps/workbench/surfaces/commerce/resend-confirmation.tsx`, `resend-confirmation-words.ts`, `order-detail.tsx`.
- `piggles/apps/workbench/surfaces/commerce/resend-confirmation.tsx`, `resend-confirmation-words.ts`, `order-detail-parties.tsx`.

## The fix

- **The route.** The same send support uses (`sendTenantEmailByKey` with the business's own published `order-confirmation`, for this order), behind the order routes' own role and module gate, 404 for an order the business cannot see. It refuses an address on the do-not-email list with `scope: all` (one that bounced or complained), which the support tool did not check.
- **The button.** "Email the confirmation again" under the buyer's email, in CRM's color like the rest of that block. Sent: "O-000035's confirmation is on its way to dana.whitcomb.buyer@example.com". Not sent, in her words: no email on the order, the address is on the do-not-email list and why, or the confirmation email is not set up.

Tests: `resend-confirmation.test.ts` in both consoles (3: no email, the do-not-email list with the address named, not set up). Commerce and lib suites: sparx 113 files / 909, Piggles 124 / 1000; api-rest `lib` and routes 82 / 582. Not checked: the api-rest and workbench `tsc` (out of memory on this machine).

## Confirmed by

2026-10-18. On O-000035, "Email the confirmation again" answered "O-000035's confirmation is on its way to dana.whitcomb.buyer@example.com", and the dev outbox received a second "Your order O-000035 is confirmed" from "Gillett Diesel Service <noreply@sparx.email>".

## Rating effect

None to the scores.
