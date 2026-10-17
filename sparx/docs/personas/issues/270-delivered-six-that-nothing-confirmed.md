# 270 — A newsletter said "Delivered 6" while nothing had confirmed one

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating Email › "Fleet winter readiness, November 2026"
**Surface:** a sent broadcast's "How it did", sparx console and Piggles
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

The first tile under "How it did" read:

> Delivered
> 6
> These went out. Nothing has come back since to confirm they landed.

The title says delivered; the sentence under it says nobody knows. The sentence was
right (issue 251 wrote it), and the title above it was fixed text.

## What should have happened

"Sent 6" until a receiving mail server confirms delivery, then "Delivered".

## How to reproduce

1. Sign in as Doty. Open Email › Broadcasts › "Fleet winter readiness, November 2026".
2. Scroll to "How it did".

Every time no delivery confirmation has come back (always in dev; in production when
the mail service does not report).

## Why it matters

A number nobody measured, shown as one. Doty would read "Delivered 6" and think six
inboxes got it.

## Where it lives

`surfaces/email/broadcast-stats-words.ts` (`deliveredTile`) chose the number, the
sentence and the color, but not the title. The title was typed into
`broadcast-detail.tsx` (sparx) and `broadcast-stats.tsx` (Piggles).

## The fix

`deliveredTile` now returns the title too: "Delivered" only when `delivered > 0`,
"Sent" otherwise. Both screens draw `delivered.label`. Both consoles.

Tests: `broadcast-stats-words.test.ts` in both consoles (2 new), red then green; email
50/50 (sparx) and 44/44 (Piggles). Scoped type checks and lint clean.

## Confirmed by

sparx as Doty: "How it did" reads "Sent 6" over "These went out. Nothing has come
back since to confirm they landed."

## Rating effect

email.broadcasts.detail: no measurement where there is none.
