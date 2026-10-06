# 055 — Importing the same file again doubled every product picture

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 3
**Surface:** workbench › Move in (any products file); every product gallery
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** database after the repair: 0 products hold the same picture twice (was 643). A third import of his file (2026-10-01, 777 versions updated, 0 errors): still 0 doubled pictures; the photos swapped from links in [056] hang once
**Blocked on:** —

## What happened

After importing his file a second time (to bring in the 17 rows [054] had
refused), every one of the 643 products that already existed showed its photo
twice. Move in tells the owner that bringing the same file in again "updates
what is here rather than duplicating it". For pictures it duplicated.

## What should have happened

A second run of the same file changes nothing that is already right.

## Where it lives

`import-worker/src/processors/products.ts`: the gallery loop attached every
picture without asking what the product already had. The media library
de-duplicated the FILE, so the same asset was hung twice.

## The fix

- The importer reads the product's existing placements (picture × version) and
  skips one already in place; new ones continue after the existing positions.
  Test: a re-run adds only the new picture (red with the check off).
- Migration `20270530000002_a_picture_hangs_once_per_product` removes copies
  already made, keeping the main picture, then the lowest position; 643 removed
  here.

## Rating effect

Move in: Ease deduction removed.
