# 596 — The screen told me twice that I have no payouts

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 203
**Surface:** mypiggles › Money › Money paid to you (and every empty list in the console)
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 203 (seen on screen)

## What happened

**Money › Money paid to you**, which has nothing in it yet. The whole pane:

> **No payouts yet**
> When card sales settle, the deposits that land in your bank will be listed
> here, each one broken down by the sales it's made of. Cash, checks and account
> payments don't appear here: they're money you've received, not a deposit that
> arrives.
>
> Nothing to show

The first two are good. The heading tells me the state and the paragraph tells
me what would be here and what deliberately never will be — that last sentence
about cash and checks is the kind of thing I would otherwise have filed a
question about.

Then the screen says it a third time, in grey, worse: **"Nothing to show."**

## What should have happened

Say it once, in the voice that says it best.

## Why it matters

Small on its own. It is on **every empty list in the console**, which is where a
new business spends its first week.

An empty screen is the one a person is most likely to misread as broken, so the
empty state is doing real work. Undercutting it with a second, blanker sentence
is the screen hedging its own answer.

## Where it lives

`workbench/components/list-pagination.tsx`, shared by every paged list in both
consoles.

**The guard was three quarters written already.** When there are no rows, the
component hides the "Load 1 more" button and hides the rows-per-page picker, and
the comments on both say why in almost these words:

> How many rows to show is a question about rows. With none on screen it is a
> control over nothing, beside the words "Nothing to show" …

So the row it leaves behind holds **one grey sentence and nothing else**. The
component walked right up to the answer and stopped.

**Fixed:** the row renders nothing when it has nothing in it.

**The two exceptions are real and are kept.** This is a guard, not a blanket
hide:

| case                                        | rows | keep it? | why                                    |
| ------------------------------------------- | ---: | -------- | -------------------------------------- |
| a list with rows                            |  > 0 | yes      | the readout is worth reading           |
| an empty list, one page                     |    0 | **no**   | the empty state already said it        |
| paged to 5 of a list that shrank to 2 pages |    0 | yes      | the page numbers are the way back      |
| a cursor feed walked into a quiet window    |    0 | yes      | "Newer" is the way back and lives here |

Hide those last two and a reader is stranded on an empty screen with no way off
it. That is the whole reason this is four lines and not one.

## Guard

`workbench/components/list-pagination-words.test.ts`, 7 tests in each console.
`rangeLabel` and `pagerHasContent` moved into a plain `.ts` module beside the
component, because the console's test seat runs TypeScript and no React — the
sentence a business owner reads is a pure function and gets a test; the component
that places it is checked by driving the screen.

Proven red: `pagerHasContent` → `return true` — the state this replaced — fails
**1 of 7**, and it is the right one:

```
× stays out of the way of an empty state
  expected true to be false
```

The three stranding cases keep passing under that break, which is the point: a
guard that reddened on all four would be testing "it returns false", not "it
returns false for the right reason".

## Still open

Nothing from this issue.
