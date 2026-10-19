# 314 — Traffic counted people as visits

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Dashboards › Traffic, and the site traffic page; api-rest site analytics
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17, in part
**Blocked on:** —

## What happened

On the Traffic dashboard, Visits read 15 and "Where visits came from" added up to 8. The breakdown counted people per source and called them visits. "Pages per visit" divided page views by people, so it read 5.33 instead of 2.13. A visit can touch more than one source, so counting visits per source would not add up either.

## What should have happened

Each visit counts once, under the source it arrived from, so the parts sum to the Visits figure. Pages per visit divides by visits.

## How to reproduce

1. Open Dashboards › Traffic.
2. Compare Visits with the total under "Where visits came from".

## Why it matters

Two numbers on one screen that cannot both be true make an owner distrust all of them.

## Where it lives

`wizeworks/services/api-rest/src/lib/site-analytics-reports.ts` (`summary`, `sources`, `emailCampaigns`).

## The fix

- `sources` takes each visit’s first page view (`DISTINCT ON (session_hash)`) and counts visits by its source.
- `emailCampaigns`, the email row one level down, counts the same way.
- `pagesPerVisit` divides by visits.

No test: these queries have no test, and the database-backed suites do not run here. The new count was run against the local database first: 12 typed in, 3 from other websites, 15 in all.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. Traffic reads "Visits 15", "Pages per visit 2.13", and "Where visits came from / 15 visits / Typed in or bookmarked 80% 12 / Other websites 20% 3".

Not checked: the email campaign breakdown (no email visits in the data).

## Rating effect

See the pane's row in `rating.md`.
