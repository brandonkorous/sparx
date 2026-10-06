# 059 — Eleven database queries spelled "cancelled" with one L, so they filtered nothing

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 3 (a code map made while building [057])
**Surface:** workbench › Reports (revenue), B2B reports, landing-page revenue, fill rate, GL reconciliation; the pick list, pack bench and packing slip
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** `pnpm check:cancelled-in-sql`: 0 of 419 queries (red on one broken line, proved). Dev database: 11 cancelled orders that the revenue report counted before. On screen: **not checked** (Doty has no orders yet; re-check on the Reports screen after his first orders in act 6)
**Blocked on:** —

## What happened

sparx stores the word as `cancelled`: orders, pick lists, boxes, supplier bills and
purchase orders are all limited to that spelling by the database. Eleven hand-written
queries compared against `'canceled'`, a value no row can hold. So
`status <> 'canceled'` was true for every row, and each filter did nothing:

- The revenue report (two queries) and the B2B report counted cancelled orders as
  sales. The landing-page revenue report did too.
- The fill-rate report and the GL reconciliation read cancelled rows as live.
- A cancelled pick list kept its units "claimed", so those units could never go on a
  new pick list. A cancelled box kept its units "packed elsewhere" (pack bench, pack
  scan, packing slip), so they could never be packed again.

Nothing failed. A type check cannot see inside a SQL string, and the queries returned
rows, just the wrong ones.

## What should have happened

A cancelled order is not a sale. A cancelled pick list or box gives its units back.

## The fix

- All eleven now read `'cancelled'`: `inventory/src/services/pick-lists.ts`,
  `packing.ts` (2), `pick-scan.ts`, `packing-slip.ts`, `gl-reconciliation.ts`,
  `performance-reports.ts`; `commerce/src/services/reporting-service.ts` (2);
  `api-rest/src/lib/site-analytics-reports.ts`; `api-rest/src/routes/v1/b2b/reports.ts`.
- New guard `scripts/check-cancelled-in-sql.mjs` (`pnpm check:cancelled-in-sql`),
  in pre-push and CI: reads every raw SQL template (419) and fails on `'canceled'`.
  Proved red by restoring one broken line.

## Rating effect

Reports and the pack bench: no deduction recorded before; the numbers were wrong
where nobody could see it.
