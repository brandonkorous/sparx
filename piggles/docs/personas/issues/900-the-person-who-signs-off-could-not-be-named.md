# 900 — The person who signs off a spending limit could not be named

**Status:** fixed, screen proof pending
**Severity:** **major** — Devi has a teammate (Nadia Osei). She could not make
one order wait for one person, and the screen told her that was coming with a
screen that already shipped
**Found by:** P03 · act 320
**Surface:** `inventory.purchase-orders.approval-rules.detail` (both consoles),
`wizeworks/packages/inventory/src/services/purchase-order-approvals.ts`
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** `components/approver-choice.test.ts` (10 tests, red three
ways); typecheck, lint, parity and both console suites green. Not yet from the
screen: the dev stack and Docker were both off when the fix landed.

## What she saw

The approver box offered four roles. Under it:

> Naming one specific person is coming with the team screens. Until then a
> limit routes to a role, and whoever holds it can sign.

The Team screen (`platform.settings.team`) already ships, and lists Nadia.

## What was really there

Everything but the box. `requiredApproverUserId` is a column. The schema accepts
it. Create and update write it. The resolver carries it onto the sign-off.
`decidePoApproval` refuses anyone but the named person. The list prints the
name. No form ever sent one. [[feedback_fetched_but_never_rendered]]

## The fix

- One control answers "who signs it off": the four roles, then **One person**
  with the active team by name. Stored as two columns, chosen as one answer
  (`components/approver-choice.ts`, both consoles). The round trip is pinned:
  a rule that names a person does not lose the name on save.
- Somebody still invited is not offered. They have no login, so naming them
  would hold every order with nobody able to sign.
- A rule that names somebody who has since left keeps them listed, so opening
  it does not quietly change who it waits for.
- The server refuses a person who is not an active member of this account, on
  create and on update. Before, any user id from any business could be named,
  which would hold orders that nobody here could ever release.
- The sentence now says what is true: a role keeps working when somebody
  leaves; one person is stricter, and the order waits for them.

## Still to prove

Open Devi's "Anything over $200" limit, name Nadia, save, and see the list read
**Nadia Osei**. Then set it back to **The owner**, which is how she left it.
