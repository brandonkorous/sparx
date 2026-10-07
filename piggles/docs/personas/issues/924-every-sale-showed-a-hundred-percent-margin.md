# 924 — Every sale showed a 100% margin, and today's sales were not there

**Status:** fixed (act 325)
**Severity:** major
**Found by:** P02 · Halo & Hem and P03 · Juniper Row · act 325, opening Money › By job
**Surface:** mypiggles › Money › By job, and Money › Profit (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row · act 325, a $72.00 belt sold at the till reading Cost $29.00, Kept $43.00, 59.7%
**Blocked on:** —

## What happened

By job's rating said its score "stays at 4 until a persona opens it on a shop
with real bookings". So Nia opened it at Halo & Hem, then Devi at Juniper Row.

1. **Every order's goods cost was $0.00**, so every order read a 100% margin.
   Measured across dev: 127 orders sold goods, and finance found a stock
   movement for none of them.
2. **Today's sales were missing.** Devi sold a $72.00 leather belt at the till.
   "This month" did not list it.
3. **Once it did, the warning vanished.** Her belt has a cost ($29.00). With it
   listed, the card said "Every job in this period made money" and her two
   uncosted dress orders went back to $0.00 and 100%, with no warning. "Worst
   first" put the only honest row, the belt, at the top as the worst job.

## Where it lives

1. The inventory sell path files a sale's stock movement under
   `reference_type = 'Order'`, capital O, and every inventory report reads it
   that way. Finance asked for `'order'`. Postgres compares case-sensitively,
   so `jobs.ts` matched nothing. `rollup.ts` had the same word, so the daily
   profit filed ALL goods cost under "no site": a site's Profit took nothing off
   for goods.
2. The range's `to` is a calendar day; `jobs.ts` compared it as an instant
   (`lte`), which is midnight at the START of that day. Spending had this exact
   bug as issue 462 and got `endOfDayExclusive`; By job never did.
3. The pane decided "measured or not" from totals: "no goods cost in the
   period AND uncosted stock on the shelves". One costed sale broke the guess.
   Underneath, the ledger stamps an uncosted sale with 0, not null
   (`costOfGoods` falls back to zero), so the cost alone cannot tell "cost
   nothing" from "nobody said".

## The fix

- `finance/src/stock-movements.ts`: `ORDER_MOVEMENT_REFERENCE = 'Order'`, used
  by both `jobs.ts` and `rollup.ts`. A schema comment that listed `'order'` as a
  value now says `'Order'`.
- `jobs.ts`: `lt: endOfDayExclusive(to)` for orders and appointments.
- `jobs.ts`: each order row carries `uncostedLines`: goods lines whose sale has
  no recorded cost, or no stock movement at all. A product the owner costed at
  exactly 0 counts as recorded; a service or written-in line has no goods. Such
  a row has no margin rate and sorts after every measured row, either way round.
- Both consoles: such a row reads **Not recorded**, **Not known**, **Not
  measured**. The card counts measured jobs only ("1 job", then "2 more jobs sold
  things with no cost recorded…"), the note says which rows are blank and why,
  and a **Put in what they cost** button opens Stock's "What your stock cost
  you", in the Stock app's color.
- Dev: the stored daily profit was rebuilt for all 64 finance businesses over
  the worker's 400-day limit. **Production needs the same once**: the nightly
  run only redoes 2 days, so run `/internal/finance/profit-rollup?days=400`
  (ops) after this ships.

## Proof

- `goods-cost.integration.test.ts` (4 tests): a sale filed the way the sell
  path files it shows its cost on By job and on the site's daily profit; a sale
  at 3 PM on the range's last day is listed; an uncosted dress is "not
  recorded", a service is a real 100%, and the dress ranks last. Each red on the
  code before it: 2, then 1, then 1.
- `jobs.test.ts`: the sort puts the unmeasured row last both ways (red before).
- `job-margin-words.test.ts`, both consoles: 11 tests, 5 red on the old module.
- On screen, as Devi: O-000033 (belt, cash) reads Made $72.00, Cost $29.00, Kept
  $43.00, 59.7%, at the top; O-000031 and O-000032 read Not recorded / Not known
  / Not measured at the bottom; the button opens What your stock cost you.

## What is still true

A line typed in by hand at the till carries no product, only the word `ITEM`,
so nothing says whether it was goods or a service. It counts as no goods. Halo &
Hem's "Bond repair take-home kit", typed in on August 22, therefore reads 100%
on By job. Picking the product from the list, which the till offers first,
records its cost.

## Rating effect

By job: Ease 4 → 7. It now tells measured from unmeasured row by row; the gap is
that most of Devi's stock has no cost, which the screen now says and links to.
