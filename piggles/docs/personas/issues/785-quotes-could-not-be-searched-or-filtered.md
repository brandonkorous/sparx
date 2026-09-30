# 785 — Quotes could not be searched, or filtered, at all

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 277
**Surface:** mypiggles + sparx workbench — `b2b.quotes.list`
**Filed:** 2026-09-23
**Blocked on:** —

## What happened

Trade has three lists side by side. Two of them open like this:

```
Wholesale orders   [ search ]  All · Not paid · To pack · Packed · They have it · Canceled
Wholesale invoices [ search ]  All · Owed · Overdue · Part paid · Paid
Quotes             Quotes
```

The third had no search box and no filter chips. Its toolbar held one word,
**Quotes**, repeating the tab directly above it. The pane's own header comment
says what the screen is for:

> This list is the queue you scan: who asked, for how much, and where each one
> stands right now.

A queue you scan, with no way to narrow it and nothing to search. At two rows
that is merely odd. At fifty it is a screen that cannot answer the question it
was built for.

## It had been deferred, in writing

`saved-view-presets.ts` carried the reason, and the size of the job:

> No quotes view. "Awaiting review" filtered `stage: 'Under Review'`, and the
> stage filter does not exist anywhere in the chain: the quotes pane has no
> filters at all (only paging), `useQuotes` sends `account_id`, `take` and
> `skip`, and `GET /v1/b2b/quotes` takes no stage. So the preset named a filter
> three layers could not apply, on a target no pane registers. **Filtering
> quotes by stage is a real capability and belongs in its own change, front to
> back; a seeded row cannot stand in for it.**

`/b2b/quotes` was one of eight seeded saved-view targets that
`check-saved-view-targets.mjs` found reaching nothing at all.

The route had since grown a `stage` parameter. Nothing called it.

## What was done

Front to back, all three layers.

**The route.** `GET /v1/b2b/quotes` takes `q` and `state`.

`q` searches the quote number, the business that asked, and the person who
asked, including their email — a quote from someone with no trade account is
stored against the person, and the address is often the only thing on it.

`state` is `open | accepted | closed`, and asks the stage's **type**, not its
name. Stages are the tenant's to rename. A filter keyed on a name is a filter
that quietly returns nothing the day someone edits their own workflow, which is
exactly the bargain that got the old preset deleted. One bucket gathers several
stages: `open` is Draft, Submitted, Under Review and Quoted at once.

`stage` (by name) stays, and the two now MERGE into one clause. Spreading them
as two `stage:` keys drops the first silently — proved against the live server,
not only in a test:

```
stage=Draft & state=accepted   before → Q-000017   (matches neither filter)
stage=Draft & state=accepted   after  → nothing
stage=Draft & state=open       after  → Q-000016
```

**The pane.** A search box and four chips — All, Not answered, Accepted,
Closed — plus the Views control the two lists beside it already carry.

**The preset.** `{ target: '/b2b/quotes', name: 'Not answered', state: 'open' }`
is back, and now resolves: `check:saved-view-targets` reports
`/b2b/quotes (1) → 2 pane(s)`.

## Proof

Driven as Devi, in the console:

```
All            Q-000017, Q-000016
Not answered   Q-000016
Accepted       Q-000017
Closed         nothing, with advice naming only the filter
q=000017       Q-000017
q="   "        both rows — spaces are not a search
q=loom         both rows, correctly: tamsin@loomandlarder.com is on each
```

Then saved as a view called "Waiting to hear back", switched away to All, and
re-applied from the menu: the chip came back on and the list narrowed to one.

## Files

- `wizeworks/services/api-rest/src/routes/v1/b2b/quotes.ts`
- `wizeworks/services/api-rest/src/lib/saved-view-presets.ts`
- `wizeworks/services/api-rest/test/unit/b2b-quote-filter.test.ts` (new, 9)
- `piggles|sparx/apps/workbench/surfaces/b2b/quotes-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/b2b/quotes-data.ts`
- `piggles|sparx/apps/workbench/surfaces/b2b/quotes-data.test.ts` (new, 14 each)
