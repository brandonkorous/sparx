# 751 — The order knew which shop it was for, and no screen could ask

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 267
**Surface:** `@wizeworks/db`, `@wizeworks/crm` (orders), `@wizeworks/b2b` (approvals); both consoles
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, measured three ways against the running database
**Blocked on:** —

## What happened

The first wholesale order this platform has ever taken, on its own detail
screen:

```
Who bought it
  Tamsin Vale
  tamsin@loomandlarder.com
```

And nothing else. The line under that reads **"Wholesale customer: …"** and it
has never rendered for anybody, on any order, in either console.

## Why: one name, two things

```
20-crm-customers.prisma    company   Company?  @relation(fields: [companyId])
packages/db/src/client.ts  company   computed from `companyName`
```

The schema comment explains the first: `Customer.company` "had to be freed up
for the relation to the Company record", so the typed-employer column became
`companyName`. The client extension then publishes a computed `company` that
returns `companyName` again, because that is the key ~120 payloads have always
carried.

**The computed one wins.** A query that asks for the relation is accepted, runs,
and hands back the computed string on the way out. Nothing throws. Nothing logs.

**MEASURED 2026-09-20 against the running database:**

```
A. company read directly   { id: '9b6d…', companyName: 'Loom and Larder' }
B. relation via customer   { companyId: '9b6d…', company: null }
C. same join in raw SQL    [{ company_name: 'Loom and Larder' }]
```

The row exists (A). Raw SQL joins it (C). Prisma hands back null (B).

## What was built on it

Two screens, and neither has ever worked:

| where                                                 | what it was for                                 |
| ----------------------------------------------------- | ----------------------------------------------- |
| `order-detail-parties.tsx` / sparx `order-detail.tsx` | "Wholesale customer: … · pays on net30 terms"   |
| `b2b/approval.ts`                                     | the business on each row of the approvals queue |

`ORDER_CUSTOMER_SELECT`'s own comment said what it was for: "paymentTerms rides
along so the B2B lens can show what an order is owed under without a second
query." It rode along and arrived as null.

**Nobody had ever seen it fail**, because of the other half of act 267: there
were 4 orders on the whole machine with a wholesale business behind them, and
all 4 had an empty typed employer — so the shadowed value was null, the guard
`{order.customer?.company ? …}` was false, and the line simply did not draw.
An absent business and a dead join look exactly alike.
[[feedback_absent_behaves_like_fine]]

## What was done

**The business is fetched under a name of its own** — `b2bAccount` — which
nothing can shadow. `accountsFor` collects the distinct company ids of a page of
orders and reads them in ONE query, so the cost is one query per page rather
than one per row. `oneWithAccount` does the same for a single order, and every
write path that returns a whole order goes through it, because a shape that
differs by which door you came through is the next version of this bug.

The approvals queue does the same, in its own transaction.

**`check:shadowed` reads the extension and fails the build** on any select of a
name it computes, nested under the model it computes it on. It is wired into
`pre-push`. It found the approvals queue on its first run — one I had not
spotted by reading.

**`client.ts` says what a computed field costs.** Adding one now means adding a
name that platform queries may no longer join on, and that is written next to
the extension rather than discovered a year later.

## What was NOT done

**The schema is untouched.** Renaming the relation to `b2bAccount` in Prisma
would be the cleaner fix and needs `prisma generate` against the shared
database, which is not mine to run. This fix needs no migration and no
regeneration, and the guard makes the collision loud either way. If the rename
happens later, the guard's list empties and nothing else changes.

## Files

- `wizeworks/packages/crm/src/services/order-service.ts` — `accountsFor`, `oneWithAccount`, `b2bAccount`
- `wizeworks/packages/b2b/src/approval.ts` — the queue's own lookup
- `wizeworks/packages/db/src/client.ts` — what a computed field costs
- `scripts/check-shadowed-relations.mjs` — new
- `package.json`, `.githooks/pre-push` — wired
- `piggles|sparx/apps/workbench/surfaces/commerce/order-types.ts` | `data.ts` — the type
- `piggles/apps/workbench/surfaces/commerce/order-detail-parties.tsx`, `sparx/…/order-detail.tsx`
- `piggles/apps/workbench/surfaces/b2b/wholesale-order-row.ts` — reads `b2bAccount` ([750](750-the-business-column-on-wholesale-orders-named-the-person.md))

## Proof

The measurement above is the proof of the defect: three reads of one fact, two
of them right and the one the platform uses wrong.

`check:shadowed` went red on its first run against the tree it was written for
— one offender, named with its file and line — and green after that offender
was fixed. It prints its denominator (14 selects across 2,715 files, 1 computed
field) rather than a bare tick. [[feedback_structural_checks_go_blind]]

**Read on the screen 2026-09-20**, after the api-rest service picked up the
change, on order O-000018:

```
Who bought it
  Tamsin Vale
  tamsin@loomandlarder.com
  Wholesale customer: Loom and Larder
```

The terms clause after it stays absent, correctly: Loom and Larder has no
payment terms set, and a blank one would be a claim about the account rather
than a reading of it. [[feedback_never_present_absence_as_measurement]]

Everything below it is green: crm 241, b2b 3, commerce 225, api-rest 243,
piggles 1,172, sparx 998, and every typecheck.
