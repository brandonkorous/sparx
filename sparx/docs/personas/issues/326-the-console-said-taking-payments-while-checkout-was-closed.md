# 326 — The console said "taking payments" while checkout was closed

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9, the Stripe connection
**Surface:** console › Payment providers › sparx Pay; Gillett site › checkout; `wizeworks/services/api-rest`
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as Doty and as a stranger (Gillett Diesel Service), 2026-10-18
**Blocked on:** —

## What happened

Doty finished sparx Pay's setup on Stripe's page. Stripe turned on card payments and payouts. Back in the console, sparx Pay read "Active, taking payments" and "Ready to take card payments". On the site, checkout still said "Orders can't be placed here yet" and nothing could be bought. The database still held the old switch: sparx Pay off, never onboarded.

## What should have happened

When the console says the shop is taking payments, the site takes them.

## How to reproduce

1. Choose sparx Pay and finish Stripe's setup, from Payment providers › sparx Pay › Continue setup.
2. Come back to the console. Read sparx Pay.
3. As a stranger, open checkout.

## Why it matters

The owner reads that she is live and tells her customers to order online. Every one of them meets a closed checkout, and she has no way to know why.

## Where it lives

`wizeworks/services/api-rest/src/lib/payments-onboarding.ts` (`getPaymentConfig`, `syncSparxPaySwitch`, `refreshSparxPayStatus`, `reconcileSparxPayAccount`).

## The fix

- The console reads Stripe's live answer (BUG-013), but only two things ever SAVED it: Stripe's `account.updated` message and the setup wizard's refresh. The Payment providers pane calls neither, and locally Stripe's message never arrives. Now `getPaymentConfig` saves the live answer when sparx Pay is the chosen provider and the stored switch differs, and tells the site its payments changed (`site.updated`, issue 040). When nothing differs it writes nothing.
- `refreshSparxPayStatus` is now that same read.
- **The neighbor.** The refresh and the `account.updated` handler set the switch whatever provider was chosen. A shop on its own Stripe keys or on manual payments, with an old sparx Pay account, could be switched off by that account's message. `syncSparxPaySwitch` now touches the switch only when sparx Pay is the chosen provider.

Tests: `src/lib/payments-onboarding.test.ts` (8): saves and tells the site; writes nothing when it matches; switches off when Stripe stops charging; never touches another provider's switch; the webhook does the same; and what Stripe still needs (issue 327). Red with the save removed and the provider guard removed (3 fail). Not checked: the api-rest `tsc` and ESLint ran out of memory on this machine.

## Confirmed by

2026-10-18. Stripe's account: charges and payouts enabled, nothing due. Before the fix the row read `is_active = false`. After it, opening Payment providers › sparx Pay saved `is_active = true` with an onboarded date. The site's own business read (`/v1/public/tenants/gillettdiesel`) said `card`, and checkout opened with the card form once the site's five-minute copy ran out. Locally nothing delivers `site.updated` to the site; in production that message clears it.

## Rating effect

None to the scores: the payments rows were scored on their words, and the words were right. This makes them true on the site too.
