# 464 — "By job" answered 500 for every shop, and TypeScript could not see it

**Status:** fixed
**Severity:** blocker
**Found by:** Devi opening "By job", the last unopened screen in Money
**Surface:** `finance.jobs` (both consoles) · `GET /v1/finance/jobs`
**Filed:** 2026-09-09

## What was wrong

The pane sat on **"Just a moment…"**. Not for a second: for about
twenty-five, and then it gave up.

Every request it makes in its DEFAULT filter — "Everything" — answered **500**.

```
GET /v1/finance/jobs?…&types=order    → 200
GET /v1/finance/jobs?…&types=booking  → 500
GET /v1/finance/jobs?…               → 500   ← the default
```

So the screen had never worked for anybody, on first open, since it shipped.

## Why

`jobProfitability` asked for a booking's customer:

```ts
select: {
  id: true,
  service: { select: { name: true, priceCents: true } },
  customer: { select: { firstName: true, lastName: true, email: true } },
}
```

`Booking` has **no `customer` relation**, deliberately, and its own schema says
so in a comment two fields away:

> _"who — appointment: customerId/companyId on the row"_ … _"A plain indexed UUID
> with no Prisma relation, following this file's own convention for cross-module
> references — scheduling stays unaware that CRM exists."_

A booking carries a bare `customerId`. There is nothing to join.

## The part that matters more than the bug

**TypeScript does not check the contents of a Prisma `select`.** Measured, in
this tree, on a file that typechecks clean:

```ts
tx.booking.findMany({ where: { notAColumn: true } })   // TS2353 ✓ caught
tx.booking.findMany({ select: { customer: { … } } })   // compiles ✗
```

The reason is structural rather than a setting anybody can flip. A generated
`<Model>Select` is `$Extensions.GetSelect<{…}, ExtArgs['result'][…]>` — a mapped
type over a TYPE PARAMETER. TypeScript defers such a type, and excess-property
checking only runs against a resolved set of keys. `where` has no such wrapper,
which is exactly what makes the gap invisible: the clause one line above the
mistake fails loudly.

I proved tsc covers the file first, by breaking something else in it and watching
four errors appear. It covers it. It simply cannot see this.

## So how many more were there

A new check, `pnpm check:prisma-selects`, reads the field list from
`prisma/schema/*.prisma` (the source of truth, in the repo, so it needs no
`prisma generate`) and validates every `select` and `include` key with the
TypeScript parser, following relations as it descends.

**6,213 fields checked across 422 models. Six were wrong, in four files:**

| where                             | named                        | truth                               |
| --------------------------------- | ---------------------------- | ----------------------------------- |
| `finance/jobs.ts`                 | `Booking.customer`           | no relation; read `customerId`      |
| `automation-actions/resolvers.ts` | `Ticket.resolveDueAt`        | it is `resolutionDueAt`             |
| `automation-actions/resolvers.ts` | `Ticket.respondDueAt`        | it is `firstResponseDueAt`          |
| `commerce/offer-service.ts`       | `ProductVariant.isAvailable` | no such column at all               |
| `commerce/offer-service.ts`       | `Product.currency`           | currency is on the VARIANT          |
| `commerce/upsell-service.ts`      | `Order.email`                | the address belongs to the customer |

Every one of them throws the moment its query runs. So:

- **the ticket resolver** threw before it read a single field, which means every
  automation rule keyed on a ticket has been dead;
- **the checkout bump** and **the post-purchase offer** both threw whenever an
  offer was picked, so the whole offer stack never showed anything.

Three shipped features, none of them mine to find, all discovered by asking one
question of the whole repo instead of one file.

## The fix

The four call sites now name real fields. `jobs.ts` reads `customerId` and looks
the people up in one extra query, so a booking row still shows who it was for.

The check is wired into `pnpm check:prisma-selects`, the pre-push guard and CI.

| breaking                                      | reddens                                                 |
| --------------------------------------------- | ------------------------------------------------------- |
| putting `customer` back in the booking select | 1 — and the denominator moves 6217 → 6218               |
| renaming a scan root                          | throws, rather than scanning nothing and printing green |

## On screen

Before: `GET /v1/finance/jobs?from=…&sort=margin_asc&limit=100` → **500**, and
"Just a moment…".
After: the same request → **200**, and the pane draws its two jobs.

## Two things it also exposed, filed separately

The screen showed the PREVIOUS filter's rows while the failing one retried —
"Appointments" listed two orders — and when it finally gave up it said "the
server could not be reached", which was not true. See
[467](467-a-500-that-told-her-to-check-her-internet.md).
