# 600 — It said I have no costs, the day after I recorded five

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 203
**Surface:** mypiggles › Money › Your accounting package
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 203 (seen on screen)

## What happened

I opened **Your accounting package** to send my spending over. The panel:

> **Send your spending to your accountant**
> A file with every cost in the period, one row each…
>
> Period: **Last month**
> Aug 1, 2026 to Aug 31, 2026 · **no costs recorded**

I recorded five costs this month. Two of them today and yesterday. The screen
told me there are none.

Nothing on the panel said the period was last month by default, or that my costs
are in a month it was not showing me. I would have gone back through Spending to
check they were still there.

## Why it matters

"No costs recorded" is one sentence covering two situations that want opposite
reactions:

| what is true                       | what she should do |
| ---------------------------------- | ------------------ |
| she has never recorded a cost      | record one         |
| her costs are in a different month | change the period  |

Only the second is alarming, and it is the common one — it is what every shop
sees for the first two weeks of every month, because a finished month is the one
an accountant wants and that is correctly the default.

## Where it lives

`workbench/surfaces/finance/accounting.tsx`. **The screen already did the hard
part and stopped one sentence short.** The comment above the line says so:

> The default period is LAST month, so on the 9th it is perfectly normal for the
> answer to be no — and better said here than discovered in a spreadsheet.
> Counting costs is free…

The count was fetched. The reassurance in that comment never made it into the
copy the reader sees.

**Fixed:** a second count, and two sentences instead of one.

| in the period | ever recorded | what it says now                                           |
| ------------: | ------------: | ---------------------------------------------------------- |
|             5 |             5 | `5 costs`                                                  |
|             0 |             5 | `nothing in this period, though you have 5 costs recorded` |
|             0 |             0 | `no costs recorded yet`                                    |
|       loading |       loading | nothing at all                                             |

and, only in the middle row, the reason:

> Last month is what an accountant usually wants, because it is finished. Change
> the period above to send a different one.

The second count is the same cheap trick the first one already used: ask the
list endpoint for one row and read `totalCount`, which is the whole filter's and
not the page's.

**Three things it deliberately does not say.** It drops the bit about the default
when she picked the period herself (explaining a default she is not looking at is
explaining something that did not happen). It says nothing when the period has
costs in it. And it says nothing when she has never recorded a cost anywhere,
because changing the period will not help her and the panel above already tells
her what will.

**And it says nothing while the counts are loading.** The old line rendered
`inPeriod.data ? … : ''`, so the alarming reading was not shown before the
answer arrived — that part was already right, and keeping it right is why the
words module takes `null` rather than a number.

## Guard

`workbench/surfaces/finance/export-period-words.test.ts`, 9 tests in each
console. Proven red by collapsing the two cases back into `'no costs recorded'`,
which fails exactly one:

```
× tells an empty period apart from an empty business
```

That is the right one to fail and the right number to fail: a guard that
reddened on all nine would be testing that the function returns a string.

## Still open

Nothing from this issue.
