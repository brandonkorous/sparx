# 118 — There was no way to say a card was taken on her own machine

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 8
**Surface:** mypiggles › Sell › Take a sale · Order › Refund this order
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Priyanka paid for her treatment by card, on the reader on Nia's counter. The ways
of being paid on offer were **Cash**, **Cheque** and **Wire transfer**. There was
no card.

The nearest thing was to call it Cash, which is false, or to reach for the
gateway values — and those are worse, because `stripe` claims a charge that
exists nowhere. Halo & Hem has no working gateway at all: it is provisioned onto
`manual` ([105](105-a-client-booked-her-most-expensive-appointment-and-was-told-it-had-failed.md)),
so every card she takes is taken on her own machine. That is most of her money.

The word already existed in the product. `paymentMethodLabel` has carried
`card: 'Card'` all along. What was missing was permission to store it:
`PaymentProcessor` in crm-schemas enumerated `stripe | paypal | manual | check |
wire | net_terms`, so sending `card` 422s.

And once a card payment WAS recorded, the order's refund panel said:

> Sends $45.00 back to the card it was paid with. The money leaves your account
> straight away.

Which is not true of a card sparx never charged. She hands the money back
herself; nothing is sent anywhere.

## What should have happened

A business taking card on its own terminal should be able to say so, and the
product should not promise to reverse a charge it never made.

## How to reproduce

1. Take a sale (or record a payment on an order). Before the fix, every time: no
   card in the list.
2. Record any payment, then read "Refund this order". Before the fix: it promised
   a card credit regardless of how the money actually arrived.

## Why it matters

Wrong money twice over. Cash and card reconcile against different things at the
end of the day, so calling one the other breaks her books. And the refund
sentence is the last thing she reads before an irreversible action, telling her
the platform will do something it cannot.

## Where it lives

- [crm-schemas/src/order-payments.ts](../../../../wizeworks/packages/crm-schemas/src/order-payments.ts) — `PaymentProcessor`
- [surfaces/commerce/order-words.ts](../../../apps/workbench/surfaces/commerce/order-words.ts) — `paidByHand`, `PAYMENT_PROCESSOR_LABELS`
- [surfaces/commerce/refund-words.ts](../../../apps/workbench/surfaces/commerce/refund-words.ts) — already branched correctly; it was being told the wrong thing

## The fix

`card` joins the processor enum, between the gateways and the by-hand methods,
with the distinction written down where somebody will read it:

> `card` is a card taken on the business's OWN terminal — a reader on the
> counter, a bank machine — money sparx never touched. `stripe`/`paypal` mean a
> gateway processed it and wrote its own record, so calling a counter sale one of
> those claims a charge that exists nowhere.

`paidByHand()` counts it, which is what makes the refund wording correct: there
is no card to credit because nothing here charged one. The column is
`varchar(63)`, so no migration was needed. `PAYMENT_PROCESSOR_LABELS` gained it
too, so a payment row reads **Card** rather than the raw `card`.

The till offers Cash · Card · Cheque · Wire transfer. `stripe` and `paypal` stay
deliberately absent from every by-hand picker: a gateway writes its own record,
and offering one here invites typing in a charge that never happened.

`data.ts` was 772 lines, so it was split into `order-types` / `order-queries` /
`order-actions` / `order-tone` / `order-words` / `order-format` while this was
being made (piggles RULE #0.5). `data.ts` re-exports them, so no call site moved.

## Confirmed by

> Re-ran P02 act 8 as Nia. Sold Priyanka a $45 bond repair, paid **Card**. The
> order's Money in panel reads **$45.00 · Card · Taken**, and the refund panel
> now reads **"Marks $45.00 as given back. You hand the money over yourself, so
> nothing is sent anywhere, and this cannot be undone."**

## Rating effect

Folded into `Sell › Orders — Completeness 3 → 9`. See [rating.md](../rating.md).
