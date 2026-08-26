# 235 — She imported twenty-five people and they joined nothing

**Status:** fixed and confirmed
**Severity:** high
**Found by:** P03 · Juniper Row · act 8 — after the mailing-list import landed
**Surface:** mypiggles › Customers › Groups of customers
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** integration test through the real bus — a contact created after a
group exists joins it with nobody editing them; red without the subscription

## What happened

Devi imported her mailing list. Twenty-five contacts landed, nine new and sixteen
matched to people already on file. Then she opened Groups of customers, and no
group had gained anybody.

This is a **separate cause** from [234], and fixing that one alone would not have
helped her: even with the bridge repaired, twenty-five arrivals would still have
joined nothing.

## What should have happened

Somebody added to the business is checked against the groups that already exist.

## Why it matters

Adding a customer is the commonest reason a group should change — it is most of
what ever happens to a customer list. An import is that event twenty-five times in
a row.

And the shape of the failure is the bad one: the groups are correctly configured,
the contacts are correctly imported, and nothing connects them. Every screen
involved looks right on its own.

## Where it lives

[segment-evaluator.ts](../../../../wizeworks/packages/crm/src/consumers/segment-evaluator.ts)
watched the events that could change a customer's projection:

```ts
'order.created',
'order.cancelled',
'order.refunded',
'crm.activity.recorded',
'crm.customer.updated',      // ← updated
'crm.customer.subscribed',
'crm.b2b.account_updated',
```

`crm.customer.created` is **published** by `customerService.create` and appears in
the CRM event union. Nothing subscribed to it. So a person joined a group only once
something later edited them — and a freshly imported contact is never edited.

The scoring evaluator's list, whose own comment says it "mirrors the segment
evaluator's list", had the same hole: a brand-new lead had no score until something
happened to them, which is the moment a lead score is least useful.

## The fix

`crm.customer.created` is watched, in both evaluators, kept identical on purpose —
two lists that are meant to agree are exactly what went wrong one layer below them
([234](234-every-group-of-customers-was-empty-and-the-bridge-said-nobody-wanted-these.md)).

The cost is one evaluation per created contact, and it is the evaluation that makes
the import mean anything.

## What it looked like once fixed

A test that walks it, and fails when the one line is removed:

```
a segment fills itself
  ✓ takes in a person who is added after it, without anyone editing them
```

## Related

[234](234-every-group-of-customers-was-empty-and-the-bridge-said-nobody-wanted-these.md)
is the other cause of the same empty group. The import that produced the twenty-five
is [233](233-ten-contacts-refused-because-market-stall-has-a-space-in-it.md), and
what it failed to record about them is
[238](238-she-imported-a-mailing-list-and-got-contacts-instead.md).

## Rating effect

`Customers › Groups` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
