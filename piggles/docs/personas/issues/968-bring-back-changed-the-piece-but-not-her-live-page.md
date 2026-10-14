# 968 — "Bring back" changed the piece but not her live page

**Status:** fixed (act 11)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 11
**Surface:** mypiggles › Content › a piece › History › Bring back; the assistant's restore tool
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 11, "The last mill on the Nene"
**Blocked on:** —

## What happened

She corrected a fact in a published piece (the miller taught in Corby, not Kettering)
and saved. The live page changed at once, at the same address.

To check the old version was recoverable she brought version 3 back. The editor showed
"Kettering", the history read **"Version 5 · Restored from revision #3"**, and the
database now served "Kettering". Her live page went on saying "Corby". Had she brought a
version back to undo a mistake, readers would have kept the mistake.

The note also named the version a second way: the list says "Version 3", the note said
"revision #3".

## Why

`restoreRevisionTx` (cms `entries-service.ts`) returned no events. A save returns
`content.entry.updated`, which the cache-refresh worker reads to refresh the site, the
feed and the lists. A restore told nobody.

## The fix

- `entries-service.ts`: `restoredEvents` gives a restore the same `content.entry.updated`
  a save sends; `restoreNote` writes "Brought back from version 3".
- api-rest `routes/v1/content/revisions.ts` publishes those events. The assistant's
  `restore_content_revision` tool already published whatever restore returned, so it is
  fixed by the same change.

## Proof

- `entries-service.test.ts`: the event, the note, and that `restoreRevisionTx` returns and
  writes them; with `events: []` it reddens. cms 20 pass.
- On screen: brought back version 5 ("Kettering"): the live page said Kettering at the
  first check. Brought back version 6 ("Corby"): live again, same address, 200. History:
  "Version 8 · Oct 9, 2026, 8:36 AM British Summer Time · Brought back from version 6".
