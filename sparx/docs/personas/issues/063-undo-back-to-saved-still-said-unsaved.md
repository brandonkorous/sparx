# 063 — Undo back to the saved page still said "Unsaved changes"

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 3 (proving [045] in the Editor)
**Surface:** workbench › Editor
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** On screen, 2026-10-01 (sparx): swapped the homepage photo for the Banks gauge → "Unsaved changes", Save lit; Undo → photo and its description back, Save reads "Saved", status "Published"; Redo → "Unsaved changes" again; Undo → saved. The builder's "unknown icon heart" warning: fixed in the catalog, **not re-checked on screen**.
**Blocked on:** —

## What happened

Doty swapped his homepage photo to try one, did not like it, and pressed Undo. The
page was exactly what he had saved. The Editor still said "Unsaved changes", Save
stayed lit, and leaving the page asked whether to throw away his changes. He had
none. A non-technical owner reads that as "I broke something", and the only way out
was to press Save on a page he had not changed.

The cause: "unsaved" was a flag any edit set and only Save cleared. Undo is an edit
too.

On the same load the Editor warned that the "Save for later" block asked for an icon
named "heart", which the builder's icon set does not have, so its palette tile showed
the default plug. The comment beside it said the name came from "the curated icon
set", which is the set the PAGE draws from, not the palette's.

## Fix

- `surfaces/builder/studio/same-document.ts` (new): whether two site documents say
  the same thing. Key order is ignored; array order is not; an empty collection
  equals a missing one (the editor hands back `symbols: {}` for a site loaded with
  none, which was the one difference measured on his site).
- `studio-surface.tsx`: keeps the last loaded or saved document. After an undo or
  redo that lands on it, the page is saved again, and the buffered edit and its
  reverse are dropped rather than sent to co-editors on the next Save.
- `same-document.test.ts`: 5 tests. A plain text comparison (key order matters)
  reddens 1.
- `silica-catalog/src/host-nodes.ts`: the palette icon is `saved` (the builder's
  bookmark), with the comment corrected.
