# 152 — The email designer claimed unsaved changes nobody made

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (one email to the fleets)
**Surface:** workbench › Email designs (the email designer)
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08
**Blocked on:** —

## What happened

From "Write an email", Doty pressed "Design emails". The designer said "Could not load your emails" because the API was restarting at that moment. He pressed "Try again", and the "Welcome" email opened. He edited nothing. Undo was off. But "Save" was on, and pressing "+" for a new email asked "Discard unsaved changes? “Welcome” has changes you haven't saved."

## What should have happened

An email nobody edited reads "Saved", and starting a new email asks nothing.

## Why it matters

A false "unsaved changes" warning teaches an owner to press "Discard" without reading. The day it is real, they lose work.

## What was tried

- A clean load of Email designs: "Saved". Not dirty.
- Selecting a section on the canvas: still "Saved". Selection does not mark the email changed.
- The same path as the first time ("Write an email" › "Design emails") with the API up: "Saved".
- The editor's document is seeded once per email (`docRef` in `surfaces/builder/email/email-editor.tsx`), so a refetch of the email list cannot change it.
- silica's `EmailBuilder` calls `onChange` only for edit operations. The brand frame arriving late is not an edit, so it is not the cause.

- The error path itself (`if (isError)` › "Try again" › `refetch()`) renders the same editor as a clean load once the list arrives. Reading it shows no step that edits the document.
- Forcing the failure in the browser (the email requests made to fail in the page) did not get as far as the designer: "Design emails" did not open it on that try. So the first sighting stays the only one.

The one difference left is the API restart itself, which happened under the first sighting and cannot be made to happen on demand from here.

## Reproduced

2026-10-08, every time: open Site › Email designs on "Welcome (sent automatically)",
edit nothing, press Preview. The status bar said "Saved just now", the row was written
(`updated_at` 02:40:57), and the design then read "Published · Unpublished changes".

The draft it saved differed from the published email in 79 places, all of two kinds:
every brand-following color (`bgAuto`, `colorAuto`, … set) repainted from the site's
brand (`#f4f4f5` → `#e9ebee`, `#18181b` → `#0c1014`), and an `ord` (silica's ordering
key) on every node. silica's `setColorDefaults` records the repaint as a `colors.set`
op on purpose (co-editing needs it), so it reaches the designer's `onChange` like an
edit. The designer compared raw JSON, so it went dirty; Preview, Send test and Publish
each save first, so the repaint was stored. The earlier note above ("the brand frame
arriving late is not an edit, so it is not the cause") was right about the frame and
missed the colors, which arrive with the brand.

More effects of the same cause:

- The server's "Unpublished changes" compared raw JSON too, so the badge stayed on.
- The 6-hourly refresh of untouched platform defaults fingerprints the body exactly,
  so a default that was only previewed counted as edited and would never be refreshed
  again.
- Every Preview also moved the status bar's "Saved just now", saved or not.

## The fix

- `emailEditSignature` (`wizeworks/packages/builder-schemas/src/email-silica.ts`): the
  document with what nobody authored taken out: every value whose `<field>Auto` is
  true (the send repaints those from the brand anyway) and every `ord`
  (`toEmailHtml` never reads it), keys sorted. A color an author picks clears its
  Auto flag, so it still counts.
- sparx designer (`surfaces/builder/email/email-editor.tsx`): dirty compares
  signatures, and saving is skipped when the signature has not changed, so Preview,
  Send test and Publish no longer store the repaint.
- Server (`email-service.ts`, `hasUnpublishedChanges`): compares signatures. Covers
  Piggles too; its studio does not repaint on open, so its own dirty check was fine.
- Refresh (`email-default-refresh.ts`, `isUntouchedDefault`): a draft whose signature
  equals the published one is judged by the published body. The fingerprints are not
  changed: the history holds only hashes, and changing the fingerprint would have
  stopped every stored hash from matching.
- `email-data.ts`: Preview and Send test carry `meta.running`, so they no longer move
  the "Saved just now" clock.

Tests, proved red: `email-edit-signature.test.ts` (5; without the stripping, the
repaint and `ord` cases fail) and `email-default-refresh.test.ts` (2 new; without the
signature allowance the repaint-only draft is not refreshed: 1 fails). All green.
Typecheck and lint clean in builder-schemas, builder and the workbench.

## Confirmed by

P01 on screen, 2026-10-08: the same "Welcome" (its stored draft still holding the
repaint from the reproduction) now reads "Published" only, and "Saved" with nothing to
save. Preview opened; the status bar did not say "Saved just now", and the row's
`updated_at` stayed 02:40:57.

## Rating effect

—
