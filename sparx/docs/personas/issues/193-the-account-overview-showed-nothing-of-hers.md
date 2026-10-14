# 193 — The account overview showed nothing of hers

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 13 (the other side)
**Surface:** the Gillett site › Your account › Overview
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Renée signed in and landed on her account overview. It said "Hi, Renée. Manage your
orders and details here." Below that were two fixed links, Continue shopping and Your
cart. Nothing else.

She has 8 orders, one of them (O-000020) waiting for approval. Her company's account
had $1,769.30 of its $10,000.00 credit left and 6 invoices not yet paid. Earlier the
same day an order of hers was held because the account ran out of credit (issue 187).
None of that was on the page she lands on. She had to know to open Orders, then
Wholesale account.

## What should have happened

The page that says "manage your orders" shows her orders: the last few, with their
state, and the way to all of them. And for a buyer on a wholesale account, where the
account stands: the credit left to spend, and what is owed, overdue first.

## Why it matters

A fleet buyer who does not see that the account is near its limit learns it when her
next order is held. The overview is the one page every buyer sees.

## Where it lives

- `wizeworks/apps/site/app/account/(authed)/page.tsx`: the overview, a greeting and two
  links.

## The fix

- `components/account/recent-orders.tsx`: the last 3 orders, then "See all 8 orders".
  Nothing for someone with no orders; an error says so and links to the Orders page.
- `components/account/account-standing.tsx`: one card per wholesale account the person
  buys for: the company, "Open the account", "$1,769.30 of your $10,000.00 credit is
  left to spend.", and what is owed in a warning (danger when overdue) with "See your
  invoices". Nothing for a buyer on no wholesale account.
- `lib/trade-account-words.ts`: `creditLeftWords` and `openInvoiceWords`. The wholesale
  account page now says what is owed with the same function, so the two pages cannot
  drift.
- `components/account/order-row.tsx`: one order row. The Orders page, the overview, the
  wholesale account page and its Orders page each drew their own, and they had drifted
  (a whole-card link on one, only the number a link on the next).

Found on the way: the wholesale summary's account row is keyed `id`, but the site's type
said `accountId`, so the first build linked "Open the account" to
`/account/b2b/undefined` (and React warned of an empty list key). The summary
(`services/api-rest/src/routes/v1/public/b2b-portal.ts`) now carries `accountId` too, and
the overview takes the id from the accounts list. A guard in the test fails if the card
reads `account.accountId` again.

Tests, red first, in `lib/trade-account-words.test.ts` (5 new: the credit words, none
left and no negative, no credit line, the owed words, and that both pages use them and
the overview draws both blocks). Site 461 pass; lint and format clean.

## Confirmed by

P01 on screen, 2026-10-09.

- As Renée: "Wasatch Front Utility Contractors, LLC · Open the account · $1,769.30 of
  your $10,000.00 credit is left to spend. · 6 invoices are not yet paid: $8,230.70.
  See your invoices", then "Your recent orders" O-000022 Placed $2,026.38, O-000021
  Collected $377.52, O-000020 Waiting for approval $1,380.65, "See all 8 orders".
  $10,000.00 less $8,230.70 used is $1,769.30, as the account page says. Open the account
  went to Wasatch's page; its Orders page shows the same rows with "Placed by Renée
  Castañeda".
- As Brynn (retail): her 3 latest orders and "See all 7 orders"; no wholesale card.

At 360px (in a 360px frame, as Brynn): no sideways scroll; each order row fits on one
line, number and date left, state and total right. Not checked: the wholesale card at
360px, and dark theme (the site follows the tenant's theme).

## Rating effect

—
