# 664 — The search box had never read my records

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 235
**Surface:** Console chrome — the search box at the top of every screen
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 235 (blind, warned, rebuilt, and finding 13 records for one name)

## What she saw

Devi wanted the supplier pane beside the reorder list, so she typed **Ashcombe**
into the box at the top of the console. It answered:

> **Nothing matches that. Try a different word.**
> Nothing in your records matches “Ashcombe”. Everything below is a screen.

Ashcombe Mills is one of her two suppliers. She had opened their page four
minutes earlier.

She tried **Marlow** — a knit she sells in ten sizes. Same answer.

## What was actually true

Counted the same afternoon, Juniper Row:

| Records         | In her business | The box could see |
| :-------------- | --------------: | ----------------: |
| Products        |              34 |             **3** |
| Customers       |              36 |             **0** |
| Orders          |              16 |             **0** |
| Everything else |             314 |             **5** |

The three products it could see were the three she had edited that morning
during this walk. The five others were the batch, the transfer, the delivery and
the stock check made during it.

Indexing rides on `search.entity.changed`. Anything seeded, imported, or written
while the indexer was down never enters and never will on its own. So the box
could reach **3 of 86** of her records, and told her the other 83 did not exist.

A box that has read nothing must not report "nothing matches". That sentence is
a claim about her business, and it was a claim it had no standing to make.
[[feedback_never_present_absence_as_measurement]]

## The warning existed on a screen she was not on

The **products list** has said this since issue 318 — "Searching your shop won't
find 31 of your products", with a **Put them back** button that works. It is on
the products list. Nobody is standing on the products list when the box at the
top of the console says it has never heard of their best seller. The screen doing
the lying carried nothing at all. [[feedback_screen_over_a_function_nobody_calls]]

And that warning only ever counted PRODUCTS. Customers and orders live only in
the palette's own two collections, so nothing on the platform was in a position
to notice that every one of them was missing.

## What it says now

`GET /v1/search/status` reports `customersMissing` and `ordersMissing` alongside
`productsMissing`, each measured the same way the route it belongs to searches —
tenant-wide for those two, because the palette has no site filter.

The line under the results stops blaming her records for what it never read:

> Nothing the box can see matches “Marlow”. 5 products, 36 customers and 16
> orders are not in this box yet, so it cannot look at them. Everything below is
> a screen. **[Put them back]**

It names each kind, because a number she can check against what she knows she
has is worth something and "some of your records" is a shrug — the same argument
the products notice already makes about its own figure.

It also fires when the search **did** find things. Two hits out of thirty-four is
as misleading as none, and an empty state never sees that case.

`null` from the status route is "the collection is not there, so we could not
look", and is silence — never a gap of everything.

## Driven end to end

```
"Marlow" → nothing, and the box says why it is blind
  → [Put them back]
  → "Asked for your records to be put back"
  → seconds later: 34 products, 36 customers, 16 orders, 314 entities
  → "Marlow Knit" → the product + its three photos · "4 records matched"
  → "Marguerite" → the customer, 4 invoices, 6 orders, reviews · 13 records
  → the warning is gone, by itself
```

The remedy took seconds and had been one button away the whole time, on a
different screen.

## The warning had to be true a second time, so it caught this

Twenty minutes after the fix went in, Devi typed "Marguerite" again and got
nothing — over a line saying 36 customers and 16 orders were missing. The index
had been full ten minutes earlier.

The collections' `created_at` was the exact second `vitest run` started in
`@wizeworks/search`. That suite's `beforeAll` calls **`dropAllSchemas()`**, and
collection names are fixed constants with no per-run namespace, so the drop takes
**every tenant's documents on that instance**, not just its own two fixtures.

Its config described it as "self-skips when Typesense isn't reachable, so it runs
locally after `pnpm db:up`", which reads as harmless. It is not: `CI=true` is
what the pre-push hook sets, and a developer with `pnpm db:up` running has a
reachable Typesense — so **every `git push` silently emptied that machine's
search index**, and nothing said so.

It now skips under `CI=true` as well, which costs no coverage (CI has no
Typesense, so it already skipped there) and takes the destruction out of the push
path. When it does run it prints what it dropped and says every tenant's
documents went with it. The header says all of this in full.

The persona finding stands on its own, but it is worth noting that the new
warning is what surfaced this at all: the box announced it had gone blind again,
about a wipe nobody had been told about.

## And the warning had to clear itself

Pressing **Put them back** returns the moment the request is accepted; the
rebuild lands seconds later. Invalidating the status on that success re-reads a
number that has not moved, so the warning sat there after the fix had worked —
which reads as the button having done nothing, and the obvious answer to that is
to press it again. (I did.)

While the box is OPEN and something is still missing, the status is re-read every
eight seconds. Closed, or once the gap is gone, nothing is asked for.

## What was good here, and was already good

- The record half states its own result the moment anything is typed, rather
  than staying silent while screen matches fill the list — the fix for typing
  "Rob" and getting three screens containing the letters of "problem".
- It no longer lists WHAT it searched, because such a list goes stale every time
  the index grows (issue 508). Extending that same reasoning is why the new
  sentence names what is MISSING rather than what was looked at.
- Both halves of the list are ranked together, so Enter lands on the best answer
  rather than on whatever the search server returned first.
- The rebuild copy promises "started", never "done", and carries no invented
  time estimate — the sentence above it IS the status, and it clears itself.

## Files

- `wizeworks/packages/search/src/admin.ts`
- `wizeworks/packages/search/{test/round-trip.test.ts,vitest.config.ts}`
- `wizeworks/services/api-rest/src/routes/v1/search.ts`
- `piggles|sparx/apps/workbench/components/launcher-search-words.ts` (new) + test
- `piggles|sparx/apps/workbench/components/{launcher.tsx,launcher-rows.tsx}`
- `piggles|sparx/apps/workbench/lib/api/search.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/products-data.ts`
