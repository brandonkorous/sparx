# 183 — The customer picker only knows the first hundred

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · [026] walk-through
**Surface:** mypiggles › Sell › Take a sale, Invoicing, B2B contacts, Customers ›
Details, Bookings — every picker that searches a list
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Juniper Row · 2026-08-24
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

[customer-picker.tsx](../../../apps/workbench/surfaces/invoicing/customer-picker.tsx),
used by Take a sale, the invoicing surfaces and the B2B contacts panel.

Looking for its callers turned up **a second picker with exactly the same
ceiling**: [record-picker.tsx](../../../apps/workbench/surfaces/crm/record-picker.tsx),
which the associations panel uses to connect a record to a person, a company, a
deal or a custom object. It preloaded `take: 100` and filtered in the browser
too — across four record kinds — and its own header comment claimed the
opposite: "each kind reads from its own list endpoint, because each has its own
search." It read from those endpoints and never passed a search term to any of
them.

A third, [bookings-customer-picker.tsx](../../../apps/workbench/surfaces/scheduling/bookings-customer-picker.tsx),
already searched on the server and was the pattern the other two should have
followed.

## The fix

**Search on the server, in one control that all three pickers use.**

The blocker was the control, not the route. Silica's `<Combobox>` takes the whole
option set and filters it internally with Base UI; it exposes no `inputValue` or
`onInputValueChange`, so there is no way to learn what was typed and no way to
ask the server for it. Preloading a window was not a shortcut somebody took —
it is the only thing that component can do. Silica ships from npm (0.55.0) and is
not editable here, so adding the prop upstream was not available either.

So the two Combobox pickers were rebuilt on the shape the bookings picker already
proved: a `SearchInput`, a debounced term, and a result list drawn from what the
server sent back. That is now **one shared control** —
[search-picker.tsx](../../../apps/workbench/components/search-picker.tsx) — and
all three pickers render through it. It holds no list of its own: it shows what
it is handed and reports what was typed. Building a fourth near-identical picker
was the alternative, and three had already drifted apart.

Per picker:

- **Customers** (`customer-picker.tsx`, 101 → 83 lines + a 59-line data file)
  searches `/v1/crm/customers?q=`, twenty rows at a time.
- **Records** (`record-picker.tsx`) passes `q` to all four endpoints. Each one
  already accepted it — `customers`, `b2b-accounts`, `deals` and the generic
  `objects/:key/records` — which is what made the stale comment so easy to
  believe.
- **Bookings** (`bookings-customer-picker.tsx`) kept its behavior and lost its
  hand-rolled markup, along with a `color="neutral"` on its clear button that
  had never been approved.

**Naming whoever is already on the record.** A picker that only knows its search
results cannot name the customer on an invoice reopened months later, because
that person may be nowhere near the first page of anything. So the customer
picker reads them by id (`useCustomerOnRecord`) rather than hunting for them in a
list. Picking someone seeds that cache with the row just chosen, so the field
names them immediately instead of blinking through "Loading" on every pick.

**The advice can stay.** "No customer matches that. Add them in Customers first"
was unsafe only because the search was not authoritative. Now that it covers the
whole address book, the sentence is true and the two halves belong together.

One copy bug of my own, caught on screen and fixed before it was recorded as
done: the record picker's new prompt read "Type at least two letters to find a
**people**" — `objectLabel` returns plurals ("People", "Companies", "Deals",
"Requests"), so the article was wrong for every kind. It now reads "…to search
people."

## Confirmed on screen

As Devi, in one window, light and dark, desktop and 360px.

**Take a sale.** Typing `naid` returns Ravi Naidoo; `an` returns Priya Anand and
not Ravi; `zzqx` gives "No customer matches that. Add them in Customers first."
Choosing Ravi puts him in the field with his name and a clear button, with no
loading flash. Clearing returns the search box.

**Customers › Details › Who they are connected to.** "Link someone else" →
`an` → Priya Anand, correctly **excluding Ravi himself** (the record doing the
picking). Chose her, "Link them" enabled, saved: "Related — Priya Anand ·
People", and the status bar said _Saved just now_.

**Bookings › Take a booking › Who it is for.** `naid` → Ravi Naidoo; choosing him
replaces the box with his name and hides the walk-in "Or just their name" field,
which is the caller's own rule and survived the migration.

**Dark and 360px** (RULE #6): checked in a 360px iframe rather than by resizing
the window. The search box fills the width, the hint sits under it, the result
list and the chosen row both fit with no horizontal overflow. In dark the field
takes the module focus ring and the clear button inverts to a light square with a
dark glyph — both themes readable.

Typecheck, lint and prettier clean; every file under the 250-line rule.

## What is still not proven, and cannot be here

The failure this issue is named for — customer 101 being unfindable — was never
reproduced on screen and still has not been. Juniper Row has two customers. The
walk-through proves the search reaches the server and that the miss and hit
messages are right; it does not prove the ceiling is gone, because there is no
ceiling to hit on this tenant. That is the same limitation the reproduction
steps recorded when this was filed, and it is worth keeping rather than dressing
up: what changed is the code path, and the code path is now `q` on the server
with no client-side filtering anywhere in it.

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

That invalidation still works after the fix. The picker's keys are now
`['crm','customers','picker','search',q]` and `['crm','customers','picker','one',id]`
— both deliberately kept under `['crm','customers']`, which is the prefix
`useInvalidateCustomers` invalidates, so a customer added anywhere is findable
here straight away.

## Rating effect

None recorded. Take a sale has no row of its own in [rating.md](../rating.md) —
it is reached from `commerce.orders.list`, which is scored on its own
walk-through. Three pickers changing how they search is not a score for any of
the surfaces that host them, and inventing one would be putting a number on
something nobody measured.
