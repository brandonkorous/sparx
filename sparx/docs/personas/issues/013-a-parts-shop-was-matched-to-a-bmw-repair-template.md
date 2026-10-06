# 013 — A parts shop was matched to a BMW repair template

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › "Your starting point" (story and step-by-step)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — "Your starting point — Garage", first in the gallery and selected
**Blocked on:** —

## What happened

Doty's story: a diesel parts and repair business that sells online, ships,
wholesales to fleets and books service. Setup picked **Auto (European
Specialist)**: "BMW, Mercedes, Audi, Porsche and VW", a booking-only site with no
shop (0 products). Right beside it in the catalog sat **Garage**: "a faceted
shop, a journal, a booking page, and a wholesale page … tuned for vehicle service,
repair, and parts".

## What should have happened

A parts shop that sells online starts from the template with a shop: Garage.

## Why it matters

Gillett does not touch European cars; it services diesel pickups. The template
becomes the first website, and this one had nowhere to sell a single part. Doty
would have rebuilt the site, or not noticed and launched a BMW shop.

## Where it lives

`pickBlueprint` in `wizeworks/packages/story-schemas/src/blueprints.ts` (shared
by both consoles since issue 003). Inside the industry's templates it ranked by
vertical (all three are `services`), then by LEAST content, so the thinnest
template won: the booking-only one.

## The fix

- New step 3 in `pickBlueprint`: the template that uses more of the owner's
  modules wins (every module it needs is already on, so more of them is more of
  what he asked for). Then vertical, then least content, then key.
- `blueprints.test.ts`: new test with the real catalog rows (`sparx-auto-euro`,
  `sparx-auto-neighborhood`, `sparx-garage`) and Gillett's modules. Removing the
  new step turns it red; the other 4 stay green.

Piggles uses the same shared function, so it gets the same fix.

## Confirmed by

> Re-ran P01 act 1. Modules step: "Your starting point — Garage. A complete
> multi-module starter in the Garage look, for vehicle service, repair, and
> parts." Starting point step: Garage is the first card, "Fits your story",
> Selected.

Checks: story-schemas 12/12 tests, tsc 0, prettier clean.

## Rating effect

Recorded with the first-run setup row.
