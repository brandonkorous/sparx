# 211 — The return form never said what the goods were worth

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 13 (the other side)
**Surface:** the Gillett site › an order › Return or exchange something
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Brynn opened the return form for O-000010, ticked the O-ring, and chose "Refund my
money". The form said how the money goes back, and "$4.32 each" on the line, but never
what her choice came to. With several lines, or a rebuilt part whose core deposit also
comes back, she had to work it out herself, and had no way to know the deposit counted.

## What should have happened

Once she chooses, the form says what it comes to: the figure the shop starts from when it
gives the money back (the price paid for each, plus the deposit on a rebuilt part that
still owed its old part, issue 051). And, because the shop decides the refund, that it
tells her the amount once it has looked.

## Where it lives

- `wizeworks/apps/site/app/account/(authed)/orders/[orderId]/return/page.tsx`
- `wizeworks/packages/commerce/src/services/return-service.ts` `returnability`: the
  lines carried the price but not the deposit, and not the currency.

## The fix

- `returnability` (shared): each line carries `coreDepositCents` and `coresOwed`, and
  the answer carries the order's `currency`.
- `lib/return-value-words.ts`: `returnValueOf` adds the price paid and the deposits for
  the quantities chosen, with the console's rule; `returnValueSentence` says "At the
  price you paid, this comes to $4.32. We tell you what we give back once we have looked
  at it.", naming the core deposit when there is one. Nothing before anything is chosen,
  or when she asks for a swap.

Tests, red first: `lib/return-value-words.test.ts` (7). Site 482 and commerce 538 pass;
lint and format clean.

## Confirmed by

P01 on screen, 2026-10-09, as Brynn: O-000010, O-ring ticked: "At the price you paid,
this comes to $4.32. …". O-000001, the Bosch injector whose old part already came back:
"… comes to $600.00." with no deposit, which is right. Not placed.

Not checked on screen: a line with its core deposit still out (no buyer with one is
signed in here); covered by the test.

## Rating effect

—
