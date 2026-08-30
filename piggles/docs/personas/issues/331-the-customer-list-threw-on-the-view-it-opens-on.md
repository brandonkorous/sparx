# 331 — The customer list threw on the view it opens on

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · running the DB-backed tests after applying [323]'s migration
**Surface:** mypiggles › Customers (and sparx's, and every caller of the CRM list)
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** the CRM suite, 73 failures → 0, including every integration test that lists a customer

## What happened

`customerService.list` asked Prisma to sort with NULLS LAST on **every** field it
can sort by. Prisma accepts that form only for a column that can actually hold a
null, and refuses it outright on a required one:

```
PrismaClientValidationError
  Argument `updatedAt`: Invalid value provided. Expected SortOrder, provided Object.
```

`updatedAt` is the **default** sort. So the failure was not an edge of an
unusual sort order — it was the list, on the view it opens on, for every caller:
both consoles' Customers panes, the API, and the MCP tools that page through
customers.

## What should have happened

The list lists.

## Where it lives

[customer-service.ts](../../../../wizeworks/packages/crm/src/services/customer-service.ts),
in the fix for [322]:

```ts
const sortField = filter.sortBy ?? 'updatedAt';
orderBy: { [sortField]: { sort: 'desc', nulls: 'last' } },
```

[322] was right about the problem and too broad in the remedy. Postgres really
does sort a null as the largest value, so "Recent order" really did list
everybody who had never ordered ahead of Devi's only buyer. But `lastOrderAt` is
the ONE nullable field in that set — the comment directly above the line says so,
in those words — and the fix was applied to all five anyway.

## Why it matters

**It is uncommitted work from earlier in this same run**, so it never shipped.
That is the whole of the good news.

**It was invisible to every check that ran.** Typecheck passes: Prisma's
`orderBy` accepts the object shape at the type level, because it is valid for
SOME fields. Lint passes. And the unit test written alongside [322] passed too —
this one:

```ts
it('carries nulls-last on every sort, so a field that becomes nullable is safe', ...)
  expect(args().orderBy).toEqual({ [sortBy]: { sort: 'desc', nulls: 'last' } });
```

It asserts the query SHAPE against a **mocked** Prisma client, which validates
nothing. The test and the bug agreed with each other exactly, so the test
defended the defect: it asserted that the wrong thing was being asked for, and
went green because that is precisely what was being asked for. Its own comment
said the blanket form was deliberate future-proofing.

**Only the real client says no**, and the tests holding the real client are the
DB-backed integration suites — which are excluded from CI, excluded from the
pre-push guard, and had not been runnable in this session until the [323]
migration was applied and the client regenerated. The moment they could run, 73
of them failed; 67 were the ungenerated column, and these 6 were this.

That is the shape worth keeping: **a check that cannot reach the real thing will
confirm whatever the code already believes.**

## The fix

The nulls form only where the column is nullable, which is the pattern the
sibling service in this same package already uses (`orderByFor` in
`billing-document-service.ts` keeps a `nullable` constant precisely so it can be
applied selectively):

```ts
const orderBy =
  sortField === 'lastOrderAt'
    ? { lastOrderAt: { sort: 'desc', nulls: 'last' } as const }
    : { [sortField]: 'desc' as const };
```

[322]'s actual finding is untouched: sorting by recent order still puts the
never-ordered last, which is the whole point of that issue.

**The test now asserts the opposite of what it did**, and says why — that the
blanket form throws, and that a mocked client is why nobody found out.

## Checked, and not the same mistake

Every other `nulls: 'last'` in the repo is on a genuinely nullable column and is
correct: `propertyId` in the scoring, meeting-link, lead-clock and redirect
lookups; `lastMessageAt` on conversations; `firstResponseDueAt` and
`resolutionDueAt` on tickets. `billing-document-service` was already doing it
selectively. `customer-service` was the only blanket application, and the only
one where the field is a variable.

## Confirmed by

`@wizeworks/crm`: **477 tests, 50 files, all passing** — including
`customer-service.test.ts`, `rls-isolation.test.ts` and
`segment-fills-itself.test.ts`, the three that list customers against a real
database. Before the fix those six failed with the validation error above.

## And the reason nobody had run them

Finding this needed the DB-backed suites, and those were not trustworthy locally:
`api-rest`'s run had **four failures of its own**, all in `crm-cron.test.ts`, all
`expected 401 to be 200`.

Not a defect in the endpoints. `test/setup.ts` sets the internal cron token with
`??=`, deliberately — its header calls the fallbacks "a floor for environments
with no .env at all (CI), not a silent override of the developer's". The cron
test then sent a **hardcoded literal** in its header. On CI, where there is no
`.env`, the floor applies and the two agree. On any machine that has one, the app
runs with the developer's token and the literal can never match.

Two deliberate decisions in direct contradiction, and the test is the one that
was wrong: it now READS the token instead of assuming it, which respects the
setup file's stated intent and works on either machine.

**`api-rest` is now 428 tests across 75 files, all passing** — the first fully
green local run. A suite that cries wolf four times is a suite people stop
running, and this one was hiding a blocker.

## Rating effect

Against `Customers › list`. Nothing to re-score: the defect never reached a
published build, and the pane's own behaviour is unchanged from what [322] left
it — it just no longer throws before rendering it.
