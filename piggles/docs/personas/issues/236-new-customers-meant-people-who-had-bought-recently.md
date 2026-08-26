# 236 — "New Customers" meant people who had bought recently, under a description promising the opposite

**Status:** fixed; the repair of existing tenants ships as a migration
**Severity:** medium
**Found by:** P03 · Juniper Row · act 8 — reading the built-in groups
**Surface:** mypiggles › Customers › Groups of customers › New Customers
**Filed:** 2026-08-25
**Fixed:** 2026-08-25

## What happened

Devi opened the built-in **New Customers** group the day after importing
twenty-nine contacts. Its description read:

> Created in the last 30 days, regardless of order activity.

Its rule was:

```
Days since last order  is at most  30
```

Those are different questions, and the rule is the exact negation of the phrase
"regardless of order activity" — it depends on nothing else, and it excludes
everyone who has never bought. Of twenty-nine people added that week, it found
**two**: the only two who had placed an order.

Nothing on the screen suggested the other twenty-seven had been ruled out. By the
group's own description they should not have been.

## What should have happened

Everyone added in the last thirty days, buyers or not.

## Why it matters

"New Customers" is the group a shop reaches for to welcome people. Aiming a welcome
message at it sends to the two who already bought and to none of the twenty-seven
who have not — which is precisely backwards, and the group's own description is
what tells you it is safe to use.

The rule was also **not visible** on the list: every row's Rules column read the
same three words, so there was nothing to notice ([237]).

## Where it lives

[builtins/segments.ts](../../../../wizeworks/packages/crm-schemas/src/builtins/segments.ts):

```ts
description: 'Created in the last 30 days, regardless of order activity.',
rules: { kind: 'predicate', field: 'customer.daysSinceLastOrder', op: 'lte', value: 30 },
```

**The rule could not say what the description said.** Date fields take absolute
values — `customer.createdAt` compares against `'2026-01-01'` — so "in the last 30
days" freezes on the day it is written. There was no relative form of "added
recently", and `daysSinceLastOrder` was the nearest number to hand.

That is why `daysSinceLastOrder` exists at all, sitting beside `lastOrderAt` for the
same reason.

## The fix

**`customer.daysSinceCreated`** — the missing counterpart, added the same way its
sibling was: to the addressable field list, to the projection, and to the rule
builder as a labelled, hinted field an owner can pick.

```
Days since they were added
E.g. at most 30 for "people who joined this month".
```

It is never null: everyone has a day they were added. That is the point of it.

The built-in now reads what it always claimed:

```
Added in the last 30 days, whether or not they have bought yet.
customer.daysSinceCreated  lte  30
```

**Existing tenants are repaired by migration**
`20270419000000_new_customers_are_the_people_who_just_arrived`, scoped to rows still
holding the exact seeded rule — so a tenant who deliberately set this group to order
recency keeps what they chose. At the time of writing that is all 29 seeded rows and
no edited ones. Membership is re-cut by the nightly recompute or by **Update
membership**, since a rule engine's output is not expressible in SQL.

## Related

Nobody could see the mismatch because of
[237](237-nine-groups-and-the-same-three-words-beside-every-one.md). The group was
empty for two further reasons at the same time —
[234](234-every-group-of-customers-was-empty-and-the-bridge-said-nobody-wanted-these.md)
and [235](235-she-imported-twenty-five-people-and-they-joined-nothing.md).

## Rating effect

`Customers › Groups` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
