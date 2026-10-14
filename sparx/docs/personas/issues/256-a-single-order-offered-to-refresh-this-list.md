# 256 — A single order offered to "Refresh this list"

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · confirming issue 254 (Piggles as The Marrow Review, PO-000001)
**Surface:** the ≡ menu and refresh button on every pane, list or record, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** Piggles as The Marrow Review and sparx as Doty, 2026-10-13
**Blocked on:** —

## What happened

Rosalind had one order open, PO-000001, in a narrow pane. She opened ≡. One row said
"Refresh this list · 9 seconds ago". There was no list on the screen. It was one order.

The refresh control is one shared button. Its words were written for list panes, but
record panes use it too: 37 in sparx, 83 in Piggles (orders, invoices, suppliers,
records). The icon's spoken name, "Refresh this list", is wrong on all of them too.

## What should have happened

The row names the action in a word that is true on every pane: "Refresh".

## How to reproduce

1. Open one purchase order in a pane under 672px wide.
2. Open ≡. Read the refresh row.

## Why it matters

A word that names the wrong thing makes the owner stop and wonder what list it means.

## Where it lives

`components/refresh-button.tsx` in both consoles: the one refresh control every pane uses.

## The fix

`components/refresh-button.tsx` in both consoles: the menu row says "Refresh" and the
icon's spoken name is "Refresh". The tooltip already said "Refresh · updated …". Nothing
else read the old words (checked with a search; two structural checks quote them only in
history notes). The Piggles file's long comments were cut to the 3-line rule while it was
open.

Tests: `components/refresh-button-words.test.ts` in both consoles, red 2 of 2, then green.

## Confirmed by

- Piggles, Rosalind, PO-000001 in a narrow pane: ≡ shows "Refresh · 3 minutes ago".
- sparx, Doty, PO-000002 in a wide pane: the refresh icon's name is "Refresh".

## Rating effect

Every record pane: the refresh row no longer names a list that is not there.
