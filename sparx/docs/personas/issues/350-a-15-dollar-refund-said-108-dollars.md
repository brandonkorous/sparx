# 350 — A $15.00 refund said $108.44

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · checking issue 347's last half, in the dev outbox
**Surface:** the "Order refunded" email and the "Refund issued: CRM note" automation every shop gets with commerce
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 in the dev outbox and on the CRM timeline, 2026-10-19
**Blocked on:** —

## What happened

Doty refunded the last $15.00 of O-000036, after Renée's $93.44 return. Her email read "Your
refund is on the way · Refund amount $108.44 · Order total $108.44". The note on her CRM
record read "Refund issued: O-000036 · $108.44".

## What should have happened

Both say $15.00, the money this refund gave back.

## How to reproduce

1. Give part of an order back, by a return or on the order page.
2. Refund the rest on the order page.
3. The email and the CRM note give the order's refunds so far, not this one. On a return,
   each core deposit's note repeats the running total.

## Why it matters

Renée is told she gets $108.44 and finds $15.00 on her card. The CRM record, which Doty's
team reads to answer her, says the same wrong figure.

## Where it lives

Both read `order.refundTotal`, the order's running total: the email
(`builder-schemas/src/default-emails-silica.ts`, `default-emails.ts`) and the note
(`automation-actions/src/seeds/commerce.ts`). Nothing carried the refund's own amount.

## The fix

The `order.refunded` resolver (`automation/src/resolvers/builtins.ts`) reads the refund row and
sets `refund.amount`, as money (`refundAmount` in `refund-source.ts`). A `refund` source in the
email catalog (`binding.ts`, with sample data in `email-tokens.ts`) carries it to the email,
through the send's snapshot as the wholesale sign-off emails do. The email's "Refund amount",
its preheader and the note read `{{refund.amount}}`. The shipped default's outgoing body is on
the refresh list (`email-default-refresh.ts`, `email-default-history.json`), so every shop that
has not edited the email gets the new one on the 6-hourly email reconcile; the note rides the
seed sync.

Tests, red first: `refund-source.test.ts` (`refundAmount`, 3) and
`order-refunded-seed.test.ts` ("names the money this refund gave back": red against the old
note). automation 160, automation-actions 155, builder-schemas 383 and builder 206 pass.
Lint and format clean.

## Confirmed by

P01, 2026-10-19. The email reconcile, run once for Gillett (`provisionDefaultEmails`, the
function the 6-hourly pass calls), refreshed one email; the seed sync updated the note.
Then: O-000033's $793.50 refund emailed Brynn "Refund amount $793.50 · Order total
$1,587.00" and noted "Refund issued: O-000033 · $793.50"; O-000001's read $600.00 in both;
O-000037's read $121.85.

## Rating effect

—
