# 132 — Two rows in the editor's Insert list shared one key

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 9 (searching Insert for "location" to build the Locations page)
**Surface:** workbench › Editor › Insert; `@wizeworks/silica-catalog` sections
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Searching Insert for "location" put a red "1 Issue" badge on the console: "Encountered two children with the same key, `timeline`." silica's built-in Timeline (Data) and sparx's "How it works › Timeline" section both used the key `timeline`.

The key is more than a list key. A drag carries only the key, and the drop looks up the first row with that key (`paletteItemByKey`). silica's Data group comes before sparx's groups, so dragging sparx's Timeline section would place silica's bare Timeline instead. This part is from reading the code; drags are not reliable in the test browser.

## What should have happened

Every row in Insert has its own key, so what is dragged is what lands.

## Why it matters

An owner who drags a section and gets a different one thinks the editor is broken. React can also drop or repeat a row whose key is not unique.

## The fix

- `silica-catalog/src/sections/index.ts`: the section's key is `process_timeline`. Its name in the list stays "Timeline". Keys are not stored on the page, so nothing already built changes.
- Measured before the change: of 82 sparx rows against 123 silica keys, this was the only collision.

Test, proved red:

- `workbench/surfaces/builder/studio/insert-keys.test.ts`: merges silica's built-in list with sparx's, as the editor does, and asserts no key has two rows (and that there are more than 150 rows, so an empty list cannot pass). With the old key back, it fails naming `timeline`.

## Confirmed by

On screen, 2026-10-06, as Doty: a fresh editor, Insert, "timeline": "Timeline · Data" and "Timeline · How it works" are both listed, and the console has no duplicate-key error.

## Rating effect

—
