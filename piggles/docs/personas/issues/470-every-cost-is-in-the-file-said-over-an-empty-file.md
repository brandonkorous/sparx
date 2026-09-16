# 470 — "Every cost in that period is in the file", said over an empty file

**Status:** fixed
**Severity:** major
**Found by:** Devi opening Accounting on the 9th, with the period on its default
**Surface:** `finance.accounting` (both consoles)
**Filed:** 2026-09-09

## What was wrong

The export period defaults to **Last month**. Today is 9 September, so the screen
opened on _Aug 1, 2026 to Aug 31, 2026_ — and Devi has no costs in August. Her
two are dated the 9th.

Nothing on the screen said so. She clicks **Download the file**, "Mark these as
sent" is ticked by default, and the toast says:

> **expenses.csv downloaded**
> **Every cost in that period is in the file.**

That sentence is true. It is true of a period with nothing in it, because a
period with nothing in it has all of its nothing in there. It is also the exact
sentence somebody needs to read to believe August is filed with their accountant,
and the file that would tell them otherwise has to be opened in a spreadsheet to
find out.

Two outcomes were coded — some rows skipped, or none — and the "none" branch was
written about a full file. A file with nothing in it is a third outcome and it
wore the first one's words.

## The fix, in two places

**Before, which prevents it.** The date range now says how much is in it:

```
Aug 1, 2026 to Aug 31, 2026 · no costs recorded
Sep 1, 2026 to Sep 9, 2026 · 2 costs
```

The dates alone do not answer the question somebody is actually asking, which is
"will this file have my spending in it". Counting is free: the expenses list
endpoint already runs an aggregate for its total, so it now returns `totalCount`
off the same query and the export card asks for one row to read it.

`totalCount` describes the FILTER, not the page — the same grain as `totalCents`
beside it, and for the same reason. A page-shaped count would tell somebody a
period holds a single cost when it holds fifty.

**After, which reports it honestly.** Three outcomes, not two:

> ⚠️ **expenses-2026-08-01-to-2026-08-31.csv has nothing in it**
> No costs are recorded between Aug 1, 2026 and Aug 31, 2026, so the file holds
> only its column headings. Change the period above and download it again.

and when there is something in it, the count rather than a claim: _"2 costs are
in the file."_

That needed the server to say how many rows it wrote. It already knew —
`result.rowCount` goes into the sync-run record and the completion event — and it
now rides on `x-sparx-row-count` beside the skipped-rows header. Which was itself
unreadable until [469](469-every-warning-a-download-carried-had-never-been-shown.md);
the first version of this fix changed nothing on screen, and that is how 469 was
found.

The client reads a missing header as **-1, not 0**. An older server that does not
send it has said nothing about the row count, and reporting that as "no costs"
would invent the very claim this exists to stop.

| breaking                                                 | reddens                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| counting `rows.length` instead of the aggregate          | 1 — the page-size test, which already existed for `totalCents` |
| (new) an empty period returning the whole ledger's count | 1                                                              |

## Proven

Downloaded August with nothing in it and got the warning above, with the real
filename. Switched to This month and the range line read `· 2 costs`, which is
what the database holds.
