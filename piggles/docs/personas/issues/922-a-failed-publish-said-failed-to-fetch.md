# 922 — A failed publish said "Failed to fetch"

**Status:** fixed (act 325)
**Severity:** minor
**Found by:** P03 · Juniper Row · act 325, while proving [921](921-she-published-her-footer-and-her-site-took-five-minutes.md)
**Surface:** mypiggles › My Site › Header & footer, and 38 other places in both consoles
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row · act 325, the same Publish with the call dropped, now in plain words
**Blocked on:** —

## What happened

Devi pressed **Publish** on her header and footer while the server was
restarting. Under the button, in small red letters:

> Failed to fetch

That is the browser's own phrase for a request that never arrived. It does not
say the publish did not happen, whose fault it is, or what to do.

## What should have happened

The console already has the sentence. Its shared failure wording says, for
exactly this case: "We couldn't reach Piggles just then. Your connection looks
fine, so this is probably us: wait a moment and try again. What you typed is
still here." The pane never asked for it.

## Why it matters

A business owner reads "Failed to fetch" as "something is broken" and has no
next step. It is the most likely failure there is: a phone on bad signal, or a
deploy.

## Where it lives

`lib/api/write-failure.ts` words failures, but only the global toast used it.
Panes that show their own failure printed `error instanceof Error ? error.message
: fallback`. A dropped connection is a `TypeError("Failed to fetch")`, and a
server error is an `ApiError` whose message can be "Internal Server Error". 49
places in the two consoles had that shape.

## The fix

Two helpers beside `describeWriteFailure`, in both consoles:

- `failureMessage(error, fallback)` for a write. A dropped connection, being
  offline, or any server answer gets the shared wording; a sentence a call site
  threw itself is kept word for word.
- `readFailureMessage(error, fallback)` for opening something: a report, a
  download, a print view. The same, but it never says "what you typed is still
  here" when nothing was typed.

Swapped at 39 call sites by a script with an explicit table, which refused any
match it was not told about; the diff was read back line by line. Left alone on
purpose: a support report that quotes the screen word for word, a barcode drawn
in the browser, a file read in the browser, the b2b files another session is
editing, and the sparx `migration-run.tsx` another session has open.

Also: the shared network sentence said "wait a moment and **save** again". Here
she had pressed Publish, and Save was greyed out, so the advice named a step she
could not take. It says "try again" now, in both consoles.

The security cards' own calls already threw plain sentences, so their words are
unchanged.

## Proof

Drove the same Publish with the browser told to drop that one call. The pane now
reads: "We couldn't reach Piggles just then. Your connection looks fine, so this
is probably us: wait a moment and try again. What you typed is still here."
Eight new tests across the two helpers, in both consoles (22 each).

## Rating effect

Not scored. Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md).
