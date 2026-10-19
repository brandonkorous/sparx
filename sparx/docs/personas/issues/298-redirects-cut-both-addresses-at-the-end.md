# 298 — Redirects cut both addresses at the end

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Content › Redirects; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17
**Blocked on:** —

## What happened

Long product addresses were cut short with "…". Two redirects that differ only at the end (`…-83601-3` and `…-04zonf3`) looked the same, so the owner could not tell which old address went where.

## What should have happened

Both addresses read in full, wrapping where they must.

## How to reproduce

1. Open Content › Redirects on a business with long product addresses.

## Why it matters

A redirect is all about the exact address. Hiding the end hides the only part that differs.

## Where it lives

`surfaces/cms/redirects-list.tsx` (sparx), `redirects-table.tsx` (Piggles).

## The fix

Both cells wrap with `[overflow-wrap:anywhere]` instead of truncating.

No test: layout only.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. Redirects shows both long addresses to their last characters ("…-in-cab-monitor-83601-3" and "…-in-04zonf3"), wide and at 360px with no sideways scroll.

## Rating effect

See the pane's row in `rating.md`.
