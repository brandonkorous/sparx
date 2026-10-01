# 900 — The person who signs off a spending limit could not be named

**Status:** fixed
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

## On the screen, and the second defect under it

Walked 2026-09-30. The picker listed Devi and Nadia; naming Nadia saved, and the
form reopened on her. The LIST then read **Anyone who can edit buying**, which
is false: only Nadia could sign.

Nadia's `users` row belongs to her own workspace. The only tenant policy on
`users` is `tenant_id = current_tenant_id()`, so Juniper Row could see her
membership and not her. Every join to a teammate who came from another business
returned null: 4 of 40 memberships, across 39 foreign keys to `users`. The
Team screen only escaped it by reading on the owner connection.

Fixed in the database, once, for all of them: migration
`20270525000000_a_teammate_from_another_business_keeps_their_name` adds a
SELECT policy for any user who is a member of the current tenant. Checked as
`sparx_app` with Juniper Row set: the limit's join reads **Nadia Osei**, users
with no membership stay at 0, and `db:rls-audit` passes. Devi's limit is back
on **The owner**, as she had it. The list itself still wants one look with the
dev stack up.
