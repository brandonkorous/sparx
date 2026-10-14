# 190 — The return form assumed clothing, and a card

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 13 (a retail return)
**Surface:** the Gillett site › an order › Send something back
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Brynn sent back a fuel injector. The form's note box suggested "A size up in the same
color, if you have it." Choosing a swap said "Tell us below which size or color you would
like instead." Choosing a refund said "We will put the money back the way you paid": she
paid at the counter, and the money came back to her in person (issue 178).

## What should have happened

Words true for any shop: a diesel part, a cake, a booking. Sparx serves every kind of
business; the form is shared by all of them.

## Where it lives

`wizeworks/apps/site/app/account/(authed)/orders/[orderId]/return/page.tsx`.

## The fix

Swap: "Tell us below what you would like instead." Refund: "We give the money back the
way you paid: to your card, or in person if you paid us in person." Note box: "For
example, what you would like instead, or what went wrong." Test
`wizeworks/apps/site/lib/return-form-words.test.ts`, red first; lint clean.

## Confirmed by

P01 on screen, 2026-10-09, as Brynn on O-000005's return form: both new sentences and the
new placeholder show.

## Rating effect

—
