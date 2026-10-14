# 975 — Ctrl K could not find her contributors or her newsletter design

**Status:** fixed (standing checks), existing records need a search rebuild on release
**Severity:** minor
**Found by:** P09 · The Marrow Review · standing checks (reload and deep link)
**Surface:** mypiggles › the Ctrl K box
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · standing checks
**Blocked on:** —

## What happened

She typed **Tobias Frankland**, one of her contributors. The only answer was a reader
called **Tobiah Lumb**. She typed the name of her newsletter design, **Friday edition:
10 October**. It found the campaign, never the design. Authors and email designs were
not in the search index at all.

## The fix

- `commerce/src/universal-projection.ts`: two new kinds in the index. **author**
  (name, "Author", the bio) and **email_design** (name, "Email design" or "Email
  design · sent automatically", the subject line). The automatic emails are designs
  too, so "order confirmation" now finds the one to reword.
- `links/src/routes.ts`: a hit opens the author's page, or the designer on that email
  (`/builder/email-designs?emailId=`).
- The author routes and the email design routes (create, change, publish, delete,
  "customize for this site") tell the index after each save.
- The starter emails seeded the first time the list opens reach the index on the next
  search rebuild, or the first time each one is saved.

## Proof

- `check:search-entities`: 34 kinds, all opened by a route and all signalled on write.
  Without the author route it reddens, naming `author`.
- On screen, after a search rebuild from her own account: "Tobias Frankland" answers
  **Tobias Frankland · Author** first and opens his page; "Friday edition: 10"
  answers **Friday edition: 10 October · Email design** and opens the designer on it.
- Lint clean, commerce 525 and links 75 tests pass. The api-rest and commerce type
  checks **could not run** (out of memory at the default heap); the editor reports no
  problems in the three changed files.

## On release

Run **ops.yml › reindex-search** once, so every business's existing authors and email
designs are findable.
