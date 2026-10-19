# 353 — Each console kept its own list of payments taken by hand

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · fixing issue 351, reading the code
**Surface:** workbench › Selling › Orders › an order, the refund and "Take it off" wording, in both consoles; `GET /v1/orders/:id/payments`
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 on screen as Doty, 2026-10-19
**Blocked on:** —

## What happened

Whether a refund goes back to a card is the server's decision: it calls a gateway only for a
processor in its gateway list (`takenByGateway`). Each console guessed instead, from its own
list of processors "paid by hand". The sparx list had four (`manual`, `check`, `wire`,
`gift_card`); Piggles's had six, with `card` and `ach`. O-000001 was paid with "Visa ending 4417,
Kendra at the counter" (`card`, a card on Gillett's own machine). The sparx console would have
told Doty "Sends $600.00 back to the card it was paid with" while the server only records it.

## What should have happened

Both consoles say what the server will do.

## How to reproduce

1. Record a payment taken on your own card machine, then refund the order in sparx.
2. The refund wording promises a card refund that never happens.

## Why it matters

The owner believes the money went back by itself, and the customer never gets it.

## Where it lives

`paidByHand` in `sparx/.../commerce/data.ts` and `piggles/.../commerce/order-words.ts`.

## The fix

The payments list says it: each row carries `byGateway`, the server's `takenByGateway`
(`api-rest/src/lib/payment-rows.ts`, used by `GET /v1/orders/:id/payments`). Both consoles'
`paidByHand(payment)` read that flag, for the refund wording and for "Take it off".

Tests, red first: `payment-rows.test.ts` (3: gateways marked, a card on the shop's reader and
the rest not, every field kept) and a `paidByHand` block in both consoles'
`refund-words.test.ts` (it reads the flag; no pane asks it of a processor name, red before).
Commerce tests pass in both consoles. Lint and format clean.

## Confirmed by

P01 as Doty, 2026-10-19. O-000001 (the counter card) read "Marks $600.00 as given back. You
hand the money over yourself" in the row and in the confirm, and the server recorded it with
no gateway call (`{"settledBy": "hand"}`). O-000037 (paid online) read "back to the card" and
went through Stripe test. Piggles, as Thistle & Rye: O-000001 (paid by hand) read "Marks $33.00 as
given back. You hand the money over yourself, so nothing is sent anywhere", from the API's
`byGateway`.

## Rating effect

—
