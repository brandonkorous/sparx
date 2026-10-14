# 972 — Searching a title cared about capitals

**Status:** fixed (standing checks)
**Severity:** minor
**Found by:** P09 · The Marrow Review · standing checks
**Surface:** mypiggles › Content › the search box; the Link box (971); anything that lists content with `q`
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · standing checks
**Blocked on:** —

## What happened

In the Link box she typed **a correction**. Nothing came up, though her note is called
"A correction to ...". "correction" found it. The content list's own search box did
the same.

## Why

`GET /v1/content/entries?q=` searched the title with Prisma's JSON `string_contains`,
which has no way to ignore capitals. The slug half of the search did ignore them, so
one-word searches often worked by luck.

## The fix

`api-rest/src/lib/entry-title-search.ts` (new): one ILIKE over `body->>'title'` and
`body->>'name'` (authors and some kinds are named, not titled), with a typed `%` or
`_` taken literally. The list route uses it inside the same transaction.

## Proof

`entry-title-search.test.ts`: the pattern, and the route using it (red on the old
route). On screen: "a correction" finds the note in the Link box and in the content
list. API lib tests 486 pass.
