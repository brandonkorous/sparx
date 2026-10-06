# 036 — "new discount", "invoice template", "product page" found nothing

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Search everything (both consoles)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** sparx: "new discount" puts Discounts first; "invoice template" Print templates; "product page" Editor; "new social post" New post first. Piggles (signed in as Juniper Row, read-only): the first three phrases give the same results
**Blocked on:** —

## What happened

Doty typed what he wanted to do. Four phrases failed:

| Typed            | Got                                     |
| ---------------- | --------------------------------------- |
| new discount     | nothing                                 |
| invoice template | nothing                                 |
| product page     | nothing                                 |
| new social post  | New post third, under Posts and Cadence |

## Why

- Every word of a phrase had to match one row, and no screen is called "new".
- "Print templates" carried no "invoice" word ("invoicing" does not contain "invoice").
- The Editor carried "pages" but no page names.
- A `+` row knew only its screen's title, not the screen's search words, so the
  list ("social") beat the row that makes one.

## The fix (both consoles)

- `components/launcher-match.ts`: "new", "add", "create", "make" and "start" are
  intent, not words to match, when a noun is left; a phrase that asks to make one
  lifts the matching `create:` row above its list.
- `components/launcher-create.ts`: a `+` row carries its screen's keywords.
- Catalog keywords: Print templates (invoice, quote and receipt template; invoice
  design), Editor / Page (product, home, contact and about page).
- New test `components/launcher-owner-phrases.test.ts`: ranks the REAL catalog
  (parsed with the TypeScript parser, create rows built as the launcher builds
  them) and pins each phrase to the screen it must put first. Proved red three
  ways: without the verb list (2 fail), without the template keywords (1),
  without keyword carry-over (1).

## Seen, not settled

Typing straight after opening the search box loses the first keystrokes when the
browser tool types instantly. A person types slower. **Not checked** with a real
keyboard (same family as [032]).

## Rating effect

Search: the Ease deduction for these phrases is removed.
