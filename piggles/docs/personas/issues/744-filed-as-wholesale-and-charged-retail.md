# 744 — Filed a shop under its wholesale customer, and it went on paying retail

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 266
**Surface:** mypiggles + sparx workbench — Customers (the Wholesale customer field), Wholesale customers (Who can order); `@wizeworks/crm`
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on both screens and in the database
**Blocked on:** —

## Two screens, one fact, opposite answers

Setting up the buyer at Loom and Larder, the shop that had just agreed prices in
[740](740-a-wholesale-price-with-no-way-to-set-it.md).

On **her customer record**, the field says what it does:

> **Wholesale account** — Loom and Larder
> _The business this person buys on behalf of. They get its agreed prices and
> terms._

On **Loom and Larder's own screen**, one click away, about the same person:

> **Who can order**
> _No one is set up to order for this customer yet._

Both screens were saved. Both were showing what they had been told. They are
reading two different rows.

## Which row the money reads

```
Customer.companyId       the primary-account POINTER   ← the customer screen
B2bAccountContact        an ACTIVE membership row      ← the account screen
```

The pricing engine reads the **membership**, and refuses the pointer on purpose.
`pricingService.resolveActiveB2bAccountId` says so in its own comment: without
that check, somebody who left a company would keep their wholesale prices
forever, because nothing else re-validates the pointer. The cart, the checkout
and the storefront product page all resolve through it.

So a person filed under a business from the customer screen alone got the
pointer, no membership, and **full retail everywhere** — under a field whose own
words promise agreed prices.
[[feedback_a_promise_in_copy_is_a_contract]]

**MEASURED 2026-09-19, across all 43 tenants on the machine:**

```
customers filed under a wholesale business      10
of those, with NO active membership              7    ← paying retail
businesses affected                              2
```

Seven people out of ten. The three that worked were the ones added from the
account screen, which writes both rows — which is why nobody had noticed: **the
path that works is the one anybody demonstrating this feature would take.**

## And the same bug in the mirror

Pressing **Remove** on Who can order switched the membership off and left the
pointer alone. So the customer's own screen went on naming a business that had
stopped pricing them — the same disagreement, from the other end.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## And then I did it again, in the same hour

Having wired **Remove**, I pressed it on screen, watched the pointer clear, and
called it proved. Then I pressed **Restore** to put the record back:

```
membership     active
company_id     NULL      ← nobody had put it back
```

An active buyer filed under nobody, priced at retail. The same disagreement, the
same day, made by fixing only the direction I was testing. The mirror had six
steps and I wired four of them.

It cost one more function and two more tests, and the reason it was caught at all
is that the persona rule says put the record back rather than leave it deleted.

## What was done

**One invariant, in one file, called from both editors.**
`wizeworks/packages/crm/src/services/trade-membership.ts`:

```
Customer.companyId = X   ⟺   an ACTIVE B2bAccountContact on X
```

- **`pointerMoved`** — setting the field joins them (as a buyer, because the
  field says "buys on behalf of"); moving it takes them off the old business;
  clearing it takes them off. Coming back to a business they were on before
  keeps the role they had, because the row carries it.
- **`membershipDeactivated`** — switching a membership off clears the pointer,
  and only when it aimed at that business. Somebody removed as a viewer on a
  second account keeps the account that actually prices them.
- **`membershipRestored`** — switching one back on points them here again, and
  only when they are filed under nobody. Same guard, other direction.

All three run inside the caller's own transaction, so a customer can never be
saved pointing at a business it is not a member of.

**And the two panes tell each other.** `useInvalidateMembership` drops the
customer queries as well as the account's, because adding or removing a member
writes on the customer too. The invariant fixed the DATA; without this, a
customer pane open beside the account went on naming a business it had just been
taken off until somebody pressed refresh. A pane showing a fact another pane just
changed is the workbench's own version of the same disagreement.

**The field now says both things it does**, and in this console's word for the
screen it names:

> **Wholesale customer** — Loom and Larder
> _The business this person buys for. They get its agreed prices and terms, and
> they are listed under Who can order on that business._

## What was NOT changed, and why

**The schema keeps both rows.** They are genuinely different facts: which
business prices someone, and whether they are a real buyer there. The defect was
never that two rows exist; it was that one editor wrote one of them and promised
the outcome of the other.

## Files

- `wizeworks/packages/crm/src/services/trade-membership.ts` — new
- `wizeworks/packages/crm/src/services/trade-membership.test.ts` — new
- `wizeworks/packages/crm/src/services/customer-service.ts` — create + update
- `wizeworks/packages/crm/src/services/b2b-account-contact-service.ts` — both
  mirrors, and the header comment that said the pointer was left alone
- `piggles|sparx/apps/workbench/surfaces/b2b/accounts-data.ts` — `useInvalidateMembership`
- `piggles|sparx/apps/workbench/surfaces/crm/customer-detail.tsx` — the copy

## Proof

Eleven tests, each half proved red before it was believed:

- Stopping `pointerMoved` taking somebody off the business they left: **2 of 11
  failed**, including the one that says a save which changes a phone number must
  not quietly re-admit a person who was removed.
- Removing the call from `customerService.create`, leaving `update`: **1 of 11
  failed** — the count assertion, which is exactly the half-fixed shape this
  issue was.
- Unwiring **Restore** and leaving Remove: **1 of 11 failed** — the assertion
  that both directions are handled, which exists because that is the mistake
  that was actually made.

The test also reads `pricing-service.ts` and asserts it still requires
`isActive: true`. Delete that and the invariant is dead weight; delete the
invariant and that line starts charging people retail. Neither is safe to change
without seeing the other.

On screen, driven end to end:

| what P03 did                                                              | what happened                                                        |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| filed Orla Beaumont under Loom and Larder from her own record, saved once | she appears under **Who can order** with no second visit, as a buyer |
| pressed **Remove** on the account                                         | her record stops naming the business, live                           |
| pressed **Restore**                                                       | it names it again, live                                              |
| took the Marlow Knit to the till for her colleague Tamsin                 | **$52.00**, the shop's agreed price                                  |
