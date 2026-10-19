# 282 — "Warehouse (Concord Park)" as a heading over the box that holds it (eight forms)

**Status:** fixed (sparx); Piggles' content type listed as debt
**Severity:** design
**Found by:** P01 · Gillett Diesel Service · rating Stock › Locations › Warehouse (Concord Park)
**Surface:** eight sparx detail screens: a stock location, a content type, a shipping group, a delivery region, and in Scheduling a place, a rule set, a person or equipment, and a service
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

The location opened on a heading "Warehouse (Concord Park)", then a "Location name" box
holding "Warehouse (Concord Park)". Issue 233 fixed the same shape on a wholesale account
and a markup rule, but its guard named those two files only.

## What should have happened

A record's name shows once, in its own box (CLAUDE.md, "Detail surfaces show identity
once"). The pane opens on what the record is: its code, its place, its stock.

## How to reproduce

1. Sign in as Doty. Open Stock › Locations › Warehouse (Concord Park).

Every time, and on a content type, a shipping group and a delivery region.

## Why it matters

Two copies of one name, and while it is being edited they disagree.

## Where it lives

A scan of every sparx detail screen for a heading that prints a name the same screen
edits in a box found: `inventory/location-detail.tsx`, `cms/content-type-detail.tsx`,
`commerce/shipping-profile-detail.tsx`, `commerce/shipping-zone-detail.tsx`. Also found
and left: `sites/site-detail.tsx` (its comment says a website opens by naming which one
and where it lives, on purpose), translations (they show the source title, which is not
edited there), a sent broadcast (read-only), and a webhook's "is set up" sentence.

## The fix

- The four screens open on their summary line (code and place; key and kind; where the
  region covers) and keep the name in its box and the tab.
- `surfaces/identity-once.test.ts` gains the four files. Its first location check named
  the wrong field and passed against the defect; corrected, all four were red, then green.
- Found later while rating "Diesel oil change": the four scheduling forms (place, rule
  set, person or equipment, service) did the same with an icon before the name, which the
  first scan's pattern did not reach. A wider scan found them; they get the same fix, and
  the guard gains four more cases (red, then green).
- Piggles has the heading on its content type only (`content-type-detail.tsx`, 1,834
  lines, over its 250-line rule), so it waits on that split.

Scoped type check and lint clean.

## Confirmed by

sparx as Doty: Warehouse (Concord Park) opens on "WH-CP · Bluffdale, UT, US · 3,466 units
· 1 shelf" with its two buttons, then the "Location name" box.

sparx as Doty: the service "Diesel oil change" opens on "Appointment", then its "Service
name" box.

## Rating effect

inventory.warehouses.detail and three more: one name, once.
