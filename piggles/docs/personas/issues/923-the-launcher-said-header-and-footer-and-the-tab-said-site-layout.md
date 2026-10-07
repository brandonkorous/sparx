# 923 — The launcher said Header & footer, and the tab said Site layout

**Status:** fixed (act 325)
**Severity:** copy
**Found by:** P03 · Juniper Row · act 325
**Surface:** mypiggles › My Site › Header & footer, and its editor's Settings tab
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row · act 325, the tab reading Header & footer and the link box reading opening-hours
**Blocked on:** —

## What happened

Two small things on one screen.

1. Devi typed "Header & footer" into the launcher and pressed Enter. The tab
   that opened said **Site layout**. Every other place calls this screen Header
   & footer: the launcher, the My Site rail, the page list.
2. She selected a block in her footer and opened Settings. The box **Link
   straight to this part** showed the example **cakes**, and the line under it
   said "like #cakes". She sells clothes. An empty box that already holds a word
   reads as if it were filled in.

## What should have happened

One name for one screen ([743](743-the-rail-and-the-pane-name-one-action-twice.md)
is the same rule). And an example that fits any business, or none.

## Where it lives

1. `piggles/apps/workbench/surfaces/studio/layout-pane.tsx` set the tab to the
   layout row's stored name. Nobody types that name: 43 businesses have "Site
   layout" from the starter, others "Tempo layout" or "Forge layout" from a
   design, and no screen renames it.
2. `wizeworks/packages/studio/src/react/inspector/settings-tab.tsx`, the shared
   editor for every business type.

## The fix

1. The tab is always **Header & footer**. Set rather than left to the registry,
   so a tab saved earlier with the old word is put right when it opens.
2. The example is **opening-hours**, which every business has and which the same
   panel's Name box already uses ("Hero, Prices, Opening hours…").

On the way: the Look & feel launcher keywords listed "colors" twice, left over
from the spelling sweep. Once now.

## Proof

Seen in her console: the tab beside Look & feel reads Header & footer. After
dev came back, her footer paragraph's Settings show **opening-hours** in the
link box and "like #opening-hours" under it.

## Rating effect

Not scored. Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md).
