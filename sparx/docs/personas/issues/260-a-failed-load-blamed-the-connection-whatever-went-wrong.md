# 260 — A failed load blamed the connection, whatever went wrong

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · rating pass (the load-error state of many panes)
**Surface:** every pane's "could not load" state, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13 (Piggles: files within the size rule; 145 + 3 listed as debt)
**Confirmed by:** sparx as Doty (the 404 case); the rest by tests, 2026-10-13
**Blocked on:** —

## What happened

When a pane cannot load, it says why. Almost every pane says the same thing: "This is a
problem reaching the server." That sentence is written by each screen, not by the
shared load-error box, and it is only true for one cause.

The shared box, `<PaneLoadError>`, can already tell the causes apart, but only when the
screen hands it the error:

| What went wrong         | What it should say                           | What it says when it does not get the error                                       |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| No connection           | could not reach the server                   | the same: correct                                                                 |
| The server failed (5xx) | something went wrong at our end              | "a problem reaching the server"                                                   |
| The thing is gone (404) | that thing is no longer here, no "Try again" | "a problem reaching the server", with "Try again" that always fails               |
| Not allowed (403)       | your account cannot open this                | "a problem reaching the server", even WITH the error: the box has no words for it |

Counted in the code on 2026-10-13:

- sparx: 135 load-error boxes, 45 of them without the error. About 150 more places
  write the sentence by hand into a plain empty state (97) or an alert (54), outside
  the shared box.
- Piggles: 251 load-error boxes, 151 of them without the error, and a similar number of
  hand-written ones.

## What should have happened

Every load failure says the cause it actually had. One place decides the words.

## How to reproduce

1. Open a pane whose read fails with a server error (5xx), for example by an API fault.
2. It says "This is a problem reaching the server", over a connection that works.

## Why it matters

The words send the owner to check their internet or restart their router, over a fault
that is ours. For a deleted record they offer "Try again", which can never work.

## Where it lives

- `components/pane-load-error.tsx` and `lib/api-error.ts` (`paneLoadReason`) in both
  consoles: the one place the words should come from.
- Every pane that shows a load failure: the call sites listed above.

## The fix

**One place decides the words.** `lib/api-error.ts`: `paneLoadReason` reads the error
into four causes: `unreachable` (no answer), `failed` (5xx and any other answered 4xx),
`missing` (404, and 400/422 on a read) and a new `refused` (401/403). The words for each
are constants beside it (`LOAD_GONE`, `LOAD_OUR_FAULT`, `LOAD_REFUSED`), and
`loadFailureWords(error, unreachableWords)` returns the screen's own sentence only for
`unreachable`. `components/pane-load-error.tsx` uses them; a refusal gets no "Try
again" (it cannot work) and a warning glyph, not an error one. The refused sentence
names where access is given: "under Team" in sparx.

Tests: `lib/api-error.test.ts` (403 and 401 refused; 409 and 429 failed; the old case
that pinned 403 as unreachable was the bug) and `lib/load-failure-words.test.ts`, red
then green.

**sparx, every call site.** 196 places, swept with a guard:
`scripts/check-load-failure-words.mjs` (root `check:load-failure-words`, wired into
`.githooks/pre-push`). It fails when a `<PaneLoadError>` gets neither `error` nor
`reason`, or when "problem reaching the server" is written anywhere else than a
PaneLoadError's props or `loadFailureWords(...)`. It also fails if it scans no files or
finds no PaneLoadError, and if an exception no longer matches. Red at 196, then green.

| Kind                                                            | Count |
| --------------------------------------------------------------- | ----- |
| PaneLoadError given its error                                   | 35    |
| Hand-made empty state turned into PaneLoadError                 | 99    |
| Alert turned into PaneLoadError (nothing else on screen)        | 23    |
| Alert kept as a banner, words from `loadFailureWords`           | 26    |
| Other (text lines, three local copies of the box, calculations) | 14    |

Two bulk-dialog save errors also blamed the connection; they now use the shared save
words (`failureMessage`), and the guard has no exceptions left.

**Piggles.** The owner chose (2026-10-13): the shared part, plus every call site in
files already within the 250-line rule.

- The shared part is the same as sparx. The refused sentence names Piggles' own screen:
  "in Team, under Your business" ("My Team" there is the staff app, not access).
  `components/pane-load-error.tsx` went from 246 to 116 lines under RULE #0.5.
- 76 files fixed: 39 boxes given the error, about 30 hand-written failures turned into
  the box, about 11 banners given `loadFailureWords`. Every touched file now meets the
  size rule (131 files changed or created, splits included).
- The guard scans both consoles. Red at 80 Piggles offenses, then green. `PIGGLES_DEBT`
  lists 145 files over 250 lines; `PIGGLES_DEBT_HELD_BY_PARENT` lists 3 small files whose
  error lives only in a large parent. Both lists fail when an entry stops offending.
- The console-parity check pins the one field sparx carries and Piggles cannot yet read
  (`CustomerVisits.error`, its reader is in the debt list) as `SHAPE_DEBT`, with its harm.
- All 2,518 Piggles workbench tests pass.

**Calculations are not reads.** A tax quote or a price preview refused with 400, 404 or
422 was about to read "It has been deleted". New `workFailureWords` in both consoles'
`lib/api-error.ts` says "The server could not work this out from what is entered here"
for those, and keeps the other causes. Used by the sale's tax (both consoles) and the two
sparx price previews (the Piggles previews are in large files, in the debt list). Tests
in `lib/load-failure-words.test.ts`, red then green.

**No exceptions left.** The Piggles bulk-category save error now uses the shared save
words too, so the guard's exception list is empty.

## Confirmed by

- sparx, Doty: a board address that does not exist says "That dashboard is no longer
  here" with the shared words, a warning glyph and no "Try again"; "Show my dashboards"
  is offered.
- The other causes, on screen 2026-10-19, produced in the browser's network layer (which a
  page-side fake could not reach): Dashboards answered 500 read "Could not load your
  dashboards · Something went wrong at our end, not yours. Nothing you have recorded has
  changed. Trying again may work, and if it keeps failing the fault is ours to fix." with
  "Try again"; answered 403, "Your account is not allowed to open this. Nothing has been
  changed. The business owner can change what you can open under Team.", with no "Try
  again".

## Rating effect

—
