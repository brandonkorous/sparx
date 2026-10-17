# 315 — Forty-four panes blamed the server for every failure

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › 44 lists and panes across selling, customers, dropshipping, email, finance, invoicing, scheduling, automations and stock; sparx console (and one Piggles pane)
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17, in part
**Blocked on:** —

## What happened

Opening `/finance/payouts/new` showed "Could not load this deposit. Something went wrong reaching the server." The server had been reached. It answered that there is no such deposit. The pane drew its own failure box with fixed words, so a deleted record, a refused account and a server fault all read "reaching the server", over a Try again that could only fail. Counting the panes that do this found 44 in sparx. Piggles had moved its twins to the shared screen already. A shipment notice opened as "new" (it has no create step) waited on "Loading the shipment…" for ever, in both consoles.

## What should have happened

Every failed first load uses the shared screen, which reads the answer: "That deposit is no longer here" for a record that is not there, a refusal for an account that cannot open it, and the server fault for a fault.

## How to reproduce

1. Open `/finance/payouts/new`.
2. Open `/inventory/advance-ship-notices/new`.

## Why it matters

One outcome with two causes needs two messages. "Try again in a moment" sends the owner to wait on something that will never work.

## Where it lives

`sparx/apps/workbench/components/pane-load-error.tsx` (the shared screen) and the 44 panes that bypassed it; `surfaces/inventory/asn-detail.tsx` in both consoles.

## The fix

- Each hand-built box is now `<PaneLoadError error={…} icon title description onRetry />` in the same place, inside the pane's own card. The words for the unreachable case are kept. The shared screen swaps them when the answer says otherwise.
- Panes with no Try again before now have one; the shared screen hides it when retrying cannot help.
- The payout pane names its noun ("deposit"). The customer page's related tabs, bookings included, pass their error.
- A shipment opened as "new" or with no id reads "There is no shipment at this address" and says notices come from what a supplier sends.
- Two more panes with their own wording ("may have been canceled, or the server is unreachable"), what is owed and a consignment settlement, use the shared screen too.
- Four save-failure toasts that matched the search were left alone: they are not load failures.

Tests: the 8 suites that cover load-failure wording passed (47 tests). The console parity check fails only on the 3 known wizelens items.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. `/finance/payouts/new` reads "That deposit is no longer here. It has been deleted, or the address points at something that is not in this business." with a way back to Payouts. `/inventory/advance-ship-notices/new` reads "There is no shipment at this address" with a way to the list. An unknown item owed and an unknown settlement read "That item owed is no longer here" and "That settlement is no longer here". Bundles, Customers, Invoices, Where money came from, Bookings, Dropship orders, Email broadcasts and Automations all still load.

Not checked: a refusal or a server fault on screen (none can be caused from the console).

## Rating effect

See the pane's row in `rating.md`.
