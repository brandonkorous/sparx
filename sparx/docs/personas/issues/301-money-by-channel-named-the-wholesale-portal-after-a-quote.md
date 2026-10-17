# 301 — Money by channel named the wholesale portal after a quote

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Finance › Where money came from; api-rest
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17
**Blocked on:** —

## What happened

Orders from the wholesale portal were filed under the source of the quote they came from, so the channel table showed a row named after a quote instead of "Wholesale portal".

## What should have happened

Only a marketplace order carries its marketplace as the source. Everything else is grouped by its channel.

## How to reproduce

1. Convert a wholesale quote to an order.
2. Open Finance › Where money came from.

## Why it matters

The point of the table is to compare channels. A row per quote is noise, and the portal’s real total is split.

## Where it lives

`wizeworks/services/api-rest/src/routes/v1/finance/channels-fold.ts`.

## The fix

`source: o.channel === 'marketplace' ? o.source : null`.

Test: a case in the fold test. Removing the channel check turns it red.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. Finance › Where money came from lists "Added by hand", "Your website" and "Wholesale portal" as rows, and no row named after a quote.

## Rating effect

See the pane's row in `rating.md`.
