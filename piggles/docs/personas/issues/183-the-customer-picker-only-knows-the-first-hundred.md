# 183 — The customer picker only knows the first hundred

**Status:** open
**Severity:** major
**Found by:** P03 · Juniper Row · [026] walk-through
**Surface:** mypiggles › Sell › Take a sale, and Invoicing — "Who it was for"
**Filed:** 2026-08-24
**Fixed:** —
**Confirmed by:** —
**Blocked on:** —

## What happened

The picker fetches a fixed window of customers once and searches it in the
browser:

```ts
const { data, isLoading } = useQuery({
  queryKey: ['crm', 'customers', 'picker'],
  queryFn: () => api.get<CustomerSummary[]>('/v1/crm/customers', { take: 100 }),
  staleTime: 60_000,
});
```

`<Combobox>` then filters `data` client-side. So the picker's idea of "every
customer" is **the first hundred rows the server happened to return**, ordered by
whatever the list route defaults to — and typing a name searches only those.

For customer 101 and beyond, the result is:

> No customer matches that. **Add them in Customers first.**

about somebody who is already in Customers.

## Why it matters

The sentence is not just unhelpful, it is instruction to do the wrong thing. A
person at a counter, told the customer does not exist, adds them — and now the
business has two records for one person, their spend is split across both, and
"what they have spent with you stays true" (this pane's own promise, three lines
above the picker) is no longer true.

It fails silently and it fails late: fine for the first hundred customers, then
wrong forever, with nothing on screen marking the transition. A business does not
notice the day it crosses the line.

`/v1/crm/customers` already takes a `q` parameter and the list route already
passes it through to `customerService.list`. The capability exists; the picker
just does not use it.

## Where it lives

[customer-picker.tsx](../../../apps/workbench/surfaces/invoicing/customer-picker.tsx).
Used by Take a sale and by the invoicing surfaces, so the fix lands on both.

## The fix

- **Search on the server.** Debounce the typed term into `q` and let the route do
  what it is already built to do. The hundred-row window then stops being the
  universe.
- **Say which case it is.** "No customer matches that" is true; "Add them in
  Customers first" is advice, and advice is only safe once the search is
  authoritative. Until it is, the two sentences should not be printed together.

## How to reproduce

Needs a tenant with more than 100 customers, which is why this was reasoned from
the code rather than observed on Juniper Row (which has two).

1. Any tenant with >100 customers.
2. Sell › Take a sale, search for somebody sorted outside the first hundred.

## A correction, recorded on purpose

This issue was first filed as something else: "it told her to add the customer,
then could not see them" — that adding a customer mid-sale left the picker
blind to them until the pane was reopened.

**That does not reproduce, and it was a testing artifact.** It was observed with
the two panes in two separate browser tabs, which hold two separate React Query
caches, so of course no invalidation crossed between them. Re-run properly — both
panes in one window, the way a person actually works — a customer created in the
Customers pane appears in the open Take a sale picker immediately.
`useInvalidateCustomers` invalidates `['crm','customers']`, which prefix-matches
the picker's `['crm','customers','picker']`, and it does its job.

The `take: 100` finding above was noticed while diagnosing the wrong thing and is
independent of it.

## Rating effect

`Sell › Take a sale` is scored in [rating.md](../rating.md).
