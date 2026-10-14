# 973 — Deleting a piece said nothing about the links to it

**Status:** fixed (standing checks)
**Severity:** major
**Found by:** P09 · The Marrow Review · standing checks (delete a published piece other pieces link to)
**Surface:** mypiggles › Content › a piece › Delete, and Unpublish (both consoles)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · standing checks, the correction note
**Blocked on:** —

## What happened

Her mill piece links to her correction note. She pressed **Delete** on the note. The
question said "This removes it for good ... This cannot be undone", and nothing about
the mill piece. Had she gone on, the mill piece would have sent every reader to a page
that is not there, and nothing would have told her. **Unpublish** said the same
nothing.

## The fix

- API: `GET /v1/content/entries/:id/linked-from` (`lib/entry-links.ts`). It finds
  links to the piece's real address in every other piece, in her site's pages and in
  her header and footer, plus reference fields. `/articles/a` never matches
  `/articles/a-b`.
- Both consoles (`surfaces/cms/linked-from.ts`): Delete and Unpublish read it first and
  add one sentence naming what links here, such as **"“The last mill on the Nene”
  links to this. After you delete it, that link will lead readers to a page that is
  not there."** For several, it counts them and names three. If the check fails, the
  question shows its usual words and claims nothing.

## Proof

`entry-links.test.ts` (the patterns) and `linked-from.test.ts` (the sentence), both
consoles. On screen: Delete on the note named the mill piece, from the live API
(`200`, one entry). She chose **Keep it**; the note is still live.
