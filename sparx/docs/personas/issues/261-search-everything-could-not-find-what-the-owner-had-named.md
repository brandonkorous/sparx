# 261 — "Search everything" could not find what the owner had named

**Status:** open
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming issue 032 (searching "Monday" for the "Monday numbers" board)
**Surface:** the top bar's "Search everything", sparx console and Piggles (they share the index and the routing)
**Filed:** 2026-10-13
**Fixed:** —
**Confirmed by:** —
**Blocked on:** —

## What happened

Doty typed "Monday" into "Search everything". Gillett has a board called "Monday
numbers". The answer was "Nothing in your records matches 'Monday'."

Search finds a thing only when the indexer has a projector for its kind. 34 kinds have
one. Many things an owner creates and names on their own screen have none, so search can
never find them. Three of them are worse: the routing already knows how to open them
(`report`, `dashboard`, `ticket` have routes and group labels in
`@wizeworks/links/src/routes.ts`), but nothing ever puts them in the index.

Owner-named things with their own screen and no projector (traced 2026-10-13):

- Customers: reports, boards (dashboards), requests (tickets), record types, records of
  a custom type.
- Stock: shelves (bins), counting schedules, recipes (bills of materials), spending
  limits (order approval rules), scheduled reports, stock sources.
- Selling: price lists, markup rules, shipping profiles, shipping zones, fitment lists,
  configurator templates, product types, price tiers (B2B).
- Bookings: services, people and equipment, places, booking rules.
- Content: content types, tag lists (taxonomies), webhooks.
- Billing: print templates, document workflows.
- Others: campaigns (funnels), AI instructions, people (staff), dropship suppliers,
  saved pieces (builder).

## What should have happened

Anything an owner names on its own screen can be found by that name.

## How to reproduce

1. Make a board called "Monday numbers".
2. Search everything › "Monday". Nothing.

## Why it matters

The search box says "everything". An owner who cannot find the board they made by its
name concludes it is gone.

## Where it lives

- Projectors: `wizeworks/packages/commerce/src/universal-projection.ts`,
  `wizeworks/packages/commerce-indexer/src/messaging-projection.ts`, walked by
  `commerce-indexer/src/registry.ts`.
- Write-time signals: `indexEntity(...)` from `@wizeworks/events`, or a CRM event mapped
  in `pubsub-bridge.ts`.
- Routing and group words: `wizeworks/packages/links/src/routes.ts`.
- Guard: `scripts/check-search-entities.mjs`.

## The fix

33 kinds made findable, end to end: the search index went from 34 kinds to 67.

- **Projectors** in four new files under `wizeworks/packages/commerce/src/`
  (`universal-projection-crm.ts`, `-stock.ts`, `-selling.ts`, `-setup.ts`, gathered in
  `universal-projection-owner-named.ts`) and added to the indexer's registry. Each
  title is the owner's name for the thing; the line under it says something new in
  plain words ("#42 from …", "Every month at …", "Sends to <host>": a webhook's full
  address and secret are never indexed).
- **Signals on every write** (create, change, rename, archive), so a new or renamed thing
  is findable at once: in the crm, inventory, commerce, b2b, cms, builder, funnels and
  invoicing services, the api-rest routes and presets, the blueprint installer, both
  sync workers and the scheduling MCP tools. Ready-made reports are signaled after they
  are seeded. Renames that change another row's line re-signal it (a renamed report
  re-signals the boards that show it; a renamed item, the recipes that make it).
- **Routes:** 30 new bindings with the owner's group word ("Shelves", "Counting
  schedules", "Delivery regions", "Tracked campaigns"…). `recordDestination` in
  `wizeworks/packages/links/src/resolve.ts` now puts the id under the route's own
  parameter name (`:key`, `:variantId`), and reads a two-part address
  (`/crm/records/:objectKey/:id`) from the stored address. Before, keyed screens opened
  blank.
- **Guard:** `scripts/check-search-entities.mjs` now reads the new files. It was red
  ("35 of 67 cannot be found or opened") before the routes and signals, then green
  ("67 projectors, all routed; 67 signalled on write").

Tests: links `record-destination.test.ts` (3 new, red then green; 79/79), commerce
`owner-named-search.test.ts` (12, red then green), api-mcp
`scheduling-search-tools.test.ts` (4, red then green).

Found on the way and filed: boards and reports "kept to you" were open to everyone
([264]); search must respect that, so 264 changes these two projectors.

Known limits: a renamed platform-wide product type, and rows written outside the
services (SQL migrations, cascade deletes, the dev seed), reach search only on a
rebuild of the index.

## Confirmed by

—

## Rating effect

—
