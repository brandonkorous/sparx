# 352 — The repair shop for stale pages had no door, and three repairs were sitting inside it

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · wiring [350]'s heal and finding there was nothing to wire it into
**Surface:** the platform › every studio page open, on every tenant
**Filed:** 2026-08-30
**Fixed:** 2026-08-30
**Confirmed by:** six tests driving the real `load()` and `loadPage()`; the shipped state fails five of them

## What happened

[350] needed a heal-on-read repair for 29 stored contact pages, so I went to add one to
`upgrade-page.ts` — the file that exists for exactly this. Then I looked for its call
site.

**There is not one.** `upgradePageBody` is exported from `@wizeworks/silica-catalog`'s
index and imported by nothing in the repository except its own test file.

```
grep upgradePageBody  →  its definition, its index export, its test. Nothing else.
```

## What was sitting inside it

Three repairs, each written carefully, each with tests, none of which had ever run on a
tenant:

| Repair                                  | Added for                       | What a tenant still has                          |
| --------------------------------------- | ------------------------------- | ------------------------------------------------ |
| `gap-1.5` → `gap-2` on the product card | the reason the file was created | title flush against price                        |
| the product hero's `loading="lazy"`     | [345], earlier the same day     | the LCP image requested last, on 12 stored trees |
| the form routed nowhere                 | [350], this issue's sibling     | a contact form that discards messages            |

**[345] states an outcome that was not true when it was written**: _"the twelve stored
heroes correct themselves as each tenant next publishes."_ They would not have. That
doc is refreshed.

## The file describes a contract nothing implemented

Its header is 45 lines and completely specific:

> **WHY IT IS SAFE TO REWRITE SOMEONE'S TREE.** Same contract as the frame heal: it runs
> on the DRAFT at studio load, never on the published tree…

Confident, correct as a design, and describing behavior no code performed. This is
[[feedback_absent_behaves_like_fine]] in its purest form — an absent call site renders
identically to a present one, from every angle except a live tenant's page.

## The same mistake, already made once, one layer up

The sibling `upgrade-frame.ts` had precisely this problem and it was fixed. The
comment on `healFrameTx` says so in its own words:

> This is the studio-load read `upgradeFrameChrome` was written for, and **until issue
> 296 nothing called it at all** — so the legacy brand cohort and the hardcoded-legal-links
> cohort were never repaired on anybody.

Issue 296 fixed the frame half and did not ask whether the page half had the same hole.
It did.

## Two call sites, not one, and the second is the one that matters

`loadFrame` already carries the answer to this, in a comment that reads as a warning
written for exactly this moment:

> Healed here **as well as in `load`**: this is the read the header/footer pane actually
> makes, so a repair that only ran on the whole-site load would never reach the one pane
> an author opens to look at their chrome (issue 296).

Wiring only `load()` — the whole-site read — reproduced the bug: the studio opens ONE
page through `loadPage`, so the repair was still unreachable from the only screen an
author uses. **Caught by driving the real browser, not by the tests**: her Contact page
was reloaded in the studio and the database still said `"ref": "submit"`.

Both are wired now.

## The contract, kept exactly

Draft only, and PERSISTED, matching the frame:

- **Draft only** because a visitor's published page must not change under its owner.
- **Persisted** rather than healed in memory because `publish` republishes the draft
  column straight from the row — an author who opens a page and presses Publish without
  editing would push the stale tree back out and undo a repair they had just been shown.

## Why the existing tests could not have caught it

`upgrade-page.test.ts` was 29 green assertions over code that never executed in
production. That is the shape [[feedback_structural_checks_go_blind]] warns about: a
unit test of a repair function proves the repair, and says nothing about whether
anything calls it.

So the new tests drive the real entry points with a mocked `@wizeworks/db`, and assert
the repair reaches the ROW:

- `load()` routes the form, writes it back, and touches only the draft column;
- `load()` writes nothing at all for a page with nothing to repair (every studio open
  runs this — a heal that saved unconditionally would write every page of every site on
  every load);
- `loadPage()` does both as well.

**Proved red against the state the repo actually shipped in**: unwiring `load` fails
three, unwiring `loadPage` fails two, and healing in memory without persisting fails
two.

## Confirmed by

`@wizeworks/builder`: **141 tests across 12 files** (was 135). Typecheck clean on
`@wizeworks/builder`, `@wizeworks/silica-catalog` and `api-rest`; eslint and prettier
clean.

## Rating effect

Not a surface of its own. It is the reason [345]'s and [350]'s repairs reach a tenant
at all, and it is recorded against both.
