# 970 — Putting a piece back made it today's news

**Status:** fixed (standing checks)
**Severity:** major
**Found by:** P09 · The Marrow Review · standing checks (unpublish and republish)
**Surface:** mypiggles › Content › a piece › Unpublish, then Publish; the assistant's publish tool
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · standing checks, "Price, weather, war: reading a commodity chart badly"
**Blocked on:** —

## What happened

She took down "Price, weather, war", live since Oct 8. The question was clear: "Visitors
will no longer be able to read this ... Nothing is deleted, and you can publish it back
at any time." She took it down. The address answered 404, and it left the Journal and
the sitemap. All correct.

She pressed **Publish**. The piece came back dated **Oct 9**, the moment of the click.
A week-old piece would now lead her home page and her Journal as that day's news, and
readers who had read it would see a new date on it. No screen lets her set a date, so
she could not put it right.

Her first press of Publish also answered "Could not publish. Nothing was changed." with
no reason. The second press worked. It did not happen again in three more rounds, so its
cause is **not found**.

## Why

`publishEntryTx` (cms `entries-service.ts`) wrote `publishedAt: now` on every publish.
The rest of the platform already keeps the first date: `publishTimestamp` exists for
exactly this, and its own note said "the date a post went live is a fact about the
post". Taking a piece down kept the date; only putting it back lost it.

## The fix

`publishEntryTx` uses `publishTimestamp('published', existing.publishedAt, now)`. A
piece that was never live gets the moment of publishing; a piece that was live keeps
its first date. The assistant's publish tool calls the same function.

## Proof

- `entries-service.test.ts` "publishing a piece again"; with `now` back it reddens. cms
  21 pass, type-check and lint clean.
- Her piece had already been re-dated by the test. Its first date was put back in the
  database (Oct 8, 08:35:37 UTC) and the round was run again from the screen, three
  times: "Live since Oct 8, 2026, 9:35 AM British Summer Time" before and after, the
  live page's Article facts say 2026-10-08, and her home page still leads with the
  barley piece.
