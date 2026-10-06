# 045 — A new picture kept the old picture's description

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Editor › any image › Settings › Accessibility › "Alt text"
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** On screen, 2026-10-01 (sparx, silicaui 0.58.0): homepage photo ("The Gillett Diesel Service shop…") swapped for the Banks Derringer picture from the library; Alt text became "Banks Derringer Tuner for 20…", that picture's own description. Undone, not saved. Piggles: not checked.
**Blocked on:** —

## What happened

Doty replaced the homepage hero's stock photo (two people at laptops) with his own
photo of the shop and its trucks. The picture changed. The description a screen
reader speaks still said "A laptop and notebook on a…". The pre-publish check
counts an image with alt text as fine, so nothing would ever have told him.

## What should have happened

A new picture arrives with its own description, or with none, so the check asks
for one. Never with the previous picture's.

## Where it lives

- silicaui `Inspector.tsx` (the image's Source picker) wrote the new `alt` only
  `if (asset.alt)`, so the old one stayed whenever the host gave none.
- sparx `studio-surface.tsx` `pickAsset` returned only the URL, dropping the
  `altText` the owner may have written on the picture in the library: fetched,
  never passed.

## The fix

- silicaui (source, not released): a new picture sets `alt` to the host's alt or
  clears it. The alt box reseeds on the value, so it empties too. Typing a new
  address in Source is a new picture too and clears it the same way.
- sparx: `pickAsset` passes the library picture's own alt text when it has one.
  Still never the filename (the existing rule).

On his site the hero and the shop-bay photo now carry true descriptions, typed by
hand ("The Gillett Diesel Service shop in Bluffdale, Utah, with diesel pickups
parked out front").

## Rating effect

Editor: Ease deduction until re-scored after the release.
