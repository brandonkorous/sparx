# 158 — A calendar campaign could not say "they booked"

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 10 (a campaign)
**Surface:** workbench › Campaigns › New campaign › "What counts as success"; the same condition editor in Automations
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08 (starting goal; the picker's words on a saved goal)
**Blocked on:** —

## What happened

Doty started a campaign, "Winter fleet readiness, 2026", for "Filling the calendar" ("Somebody looks at your times and books one."). It came with three steps, the last being "Booked it in", "Recorded on its own when the success rule below comes true". The success rule was empty, and the campaign said it "cannot be turned on" without one.

- The rule's first box is a type-ahead whose hint is `customer.type`. Typing "book" showed "No results." Its whole list is raw code names: `customer.lifecycleStage`, `b2bAccount.hasOverdueInvoices`, `approval.asksBusiness`, `form.pageSlug`, and so on. Nothing about bookings.
- The server can check a booking. The library's own booking campaigns finish on `booking.status` is one of requested, confirmed. The picker just does not offer it, and an owner has no way to know the code name.

So a "Filling the calendar" campaign made from the "New campaign" screen could never be turned on.

## What should have happened

A new campaign of a kind starts with the goal that kind waits for, and the picker speaks in words an owner uses ("Booking status"), not code names.

## Why it matters

The campaign's own purpose could not be measured, and the screen it asked him to use spoke a language no business owner reads.

## Where it lives

- `wizeworks/packages/funnels/src/index.ts`, `createFunnel`: stamps the kind's starter steps (`DEFAULT_STAGES`) but no goal.
- `sparx/apps/workbench/surfaces/automations/automations-catalog.ts`, `COMMON_CONDITION_FIELDS`: the picker's list, raw code names, no `booking.*`, no `order.paymentStatus`, no `quote.stageName`. Shared by every automation's "only if…" filter. silicaui's `Autocomplete` takes plain strings, so showing words while storing a code name needs a different control.

## The fix

Fixed: the starting goal. `startingGoal` in `wizeworks/packages/funnels/src/library.ts` gives each kind the goal it waits for, from the same goals the library's recipes use: booking, booked (requested or confirmed); purchase and recovery, paid; lead, became a customer; winback, ordered again. `createFunnel` stamps it in like the starter steps, and it is the owner's to change. A custom campaign starts with none.

Test, proved red: `wizeworks/packages/funnels/src/starting-goal.test.ts`. Every kind but custom starts with a goal its own success event meets and a bare contact does not; custom starts with none. Against the library before, all 6 fail. Funnels: 90 tests pass, typecheck clean.

Fixed: the picker's words, in both consoles.

- `surfaces/automations/condition-fields.ts` (sparx and Piggles) lists the details a condition can check, each with a group and a plain name ("Booking · Status", "Order · Payment", "Quote · Stage"), a kind, and, for a detail with a known set of values, those values in the console's own words (the bookings list's "Awaiting confirmation", the orders list's "To pack"). It replaces `COMMON_CONDITION_FIELDS`, which is gone.
- The list holds 67 details. It adds `booking.*`, `order.paymentStatus`, `quote.stageName` and the rest of what the resolvers fill. It drops `customer.lifetimeOrders`, `deal.stage` and `order.itemCount`: no resolver fills them, so a rule on them could never come true.
- `condition-editor.tsx`: the detail box is a `Combobox` that shows the name and stores the code name. The comparison list fits the detail (no "is more than" on a status). The value box fits too: a pick list for a status, a several-pick list for "is one of", Yes or No for a yes-or-no, a number box for a number. A stored rule on a detail the list does not know keeps its place under its own name, with the free-text box it always had.
- `conditionFieldMatches` lets a detail answer to its values and a few owner words ("paid", "booked", "accepted"), not only its name. Typing "paid" showed "No detail matches that", because the payment detail is named "Order · Payment". The picker needs silicaui's Combobox to accept a `filter` to use it; that is added in silicaui PR #109 (`@wizeworks/silicaui-react` minor, `verify-combobox-filter.mjs`, proved red without the pass-through). silicaui 0.59.0 shipped it; sparx's catalog is raised to ^0.59.0, and both editors now pass `filter={conditionFieldMatches}` (typecheck and lint clean in both, 7/7 tests).

Tests, proved red: `surfaces/automations/condition-fields.test.ts` in both consoles. It reads the resolvers' source and the campaign library. Against the old list, 3 checks fail: 3 offered details no resolver fills, 6 goal details missing (`order.paymentStatus`, `customer.orderCount`, `booking.status`, `quote.stageName`, `customer.hasOrdered`, `customer.daysSinceLastOrder`), and code names shown. The search check fails with name-only matching ("paid" finds nothing). All 7 pass now, in both. Typecheck and lint clean in both consoles.

## Confirmed by

P01 on screen, 2026-10-08, after silicaui 0.59.0: in "Winter fleet readiness, 2026",
"Add a condition", then typing "paid" offers exactly "Order · Payment"; picking it
gives "is exactly" and a pick list of Not paid, Part paid, Paid, Refunded. "booked"
offers "Booking · Status" and "Booking · Who or what is booked". "ordered" offers
"Customer · Number of orders" and "Customer · Has ever ordered"; picking the second
gives only "is exactly" and a Yes value. The test row was removed unsaved, and the
campaign read clean again (the "1 unsaved change" note clears on the status bar's
next 1.5-second check).

P01 on screen, 2026-10-08, the picker's words: "Winter fleet readiness, 2026" opened with its goal reading "Booking · Status", "is one of", "Awaiting confirmation, Confirmed", from the stored `booking.status` in [requested, confirmed]. A new empty row's picker showed "Pick a detail, like Booking · Status". Typing "paid" showed "No detail matches that. Try another word.", which is the search gap above. Not checked on screen: the rest of the new row, because the dev stack stopped answering (workbench, API and account app all down) part way through.

P01 on screen, 2026-10-08 (starting goal). The first "Winter fleet readiness, 2026" had no goal and was deleted. Made again as "Filling the calendar", its "What counts as success" arrived holding `booking.status` "is one of" "requested, confirmed". After Doty added its purpose and `/book` as the page for "Looked at the times", it saved, and "Turn it on" is available. A "Finding new customers" campaign made on the way arrived with `customer.lifecycleStage` "is exactly" "customer".

## Rating effect

—
