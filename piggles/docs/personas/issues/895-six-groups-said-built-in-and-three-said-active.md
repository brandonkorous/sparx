# 895 — Six groups said "Built-in" and three said "Active"

**Status:** fixed
**Severity:** **minor** — nothing on the screen was false. One column held
answers to two different questions and showed only one per row, so reading down
it suggested that six of her nine groups were switched off. All nine were
running
**Found by:** P03 · act 317, sweeping Groups of customers by data weight
**Surface:** mypiggles › Customers › Groups of customers, both consoles
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** a source guard of 6 assertions, proved red four ways; and her
own screen, before and after

## What she saw

Nine groups, under a column headed **State**:

```
Name                          People            State
At Risk                       No members yet    Built-in
B2B Fleet                     No members yet    Built-in
Early Access                  No members yet    Built-in
High Value                    No members yet    Built-in
New Customers                 6 customers       Built-in
Newsletter Subscribers        23 customers      Built-in
Bought in the last 90 days    8 customers       Active
Email engaged                 No members yet    Active
VIP customers                 No members yet    Active
```

Six say one word, three say another, in one column, under a header asking what
state a thing is in. The obvious reading is that the six are the ones that are
NOT active — and four of those six have no members, which only confirms it.

All nine were running. Four of them are empty because nobody matches, which is
a measurement and a correct one.

## One column, two questions

"Built-in" is not a state. It says where a group came from. "Active" says
whether it is on. They are answers to different questions, and the badge could
only ever show one:

```
archived?   → "Archived"
built-in?   → "Built-in"
otherwise   → "Active"
```

So a built-in group could never say it was in use, and a group she had made
herself could never say it was hers. Whichever fact the badge showed, the other
was unavailable on that row.

And "Built-in" bought nothing with the slot it took. `isBuiltIn` is not read by
the delete path, the archive path or the edit path — a built-in group opens with
its name, its short id, its description and its rules all editable, exactly like
one she wrote. It is a sort key and a badge and nothing else.

## The answer was already next door

`crm/object-types-list.tsx`, one row down the same menu, had settled this
already. Its column is headed **Kind**, it names BOTH sides every time, and it
lets the put-away mark ride beside the **name**, where a state belongs. Its own
comment says why:

> _"Built-in vs yours is a real distinction — one can be extended, the other can
> also be put away — so it wears a real color rather than a grey chip."_

Same module, same question, one row apart, opposite answers.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What it does now

```
Name                          People            Kind
At Risk                       No members yet    Already here
…
Bought in the last 90 days    8 customers       Yours
```

- The column is headed **Kind**, and every row names its side: the one that came
  with the app, or **Yours**. Nothing is left to be inferred.
- The word for the platform's own is each console's to choose. Piggles says
  **"Already here"**, sparx says **"Comes with sparx"** — the same copy key the
  sibling list already uses, so the two cannot drift apart.
- A group that has been put away says so **beside its name**, which is where the
  neighbouring list puts it and where a state belongs.
- Colors follow the sibling exactly: `info` for the platform's, `module` for
  hers. Two different things, two different colors.

Both consoles.

## Proved

**6 assertions**, and four wrong versions:

```
the header goes back to "State"                   →  1 fail
one side renders nothing (the original shape)     →  1 fail
a state word creeps into the Kind column          →  2 fail
the badge is renamed out from under the guard     →  2 fail
```

The last one is the one worth having. A guard that reads source by a function
name goes silently blind when the function is renamed, so this one refuses with
a sentence — "KindBadge is gone from segments-list.tsx, this guard is reading
nothing" — instead of passing over an empty match.
[[feedback_structural_checks_go_blind]]

The banned words are checked INSIDE the badge function only. Both consoles are
allowed to say "Active" elsewhere in the file, and sparx's scope filter does.
Scoping the question to the region it is about is what keeps the guard from
being a nuisance that gets deleted.

## Checks

piggles console 173 files / 1619 tests, sparx workbench 142 / 1301, both fully
green. Typecheck 0 on both. ESLint and prettier clean.

## Files

- `piggles/apps/workbench/surfaces/crm/segments-list.tsx`
- `sparx/apps/workbench/surfaces/crm/segments-list.tsx`
- `piggles/apps/workbench/surfaces/crm/segment-kind-names-both-sides.test.ts` (new)
- `sparx/apps/workbench/surfaces/crm/segment-kind-names-both-sides.test.ts` (new)

## Not changed, and why

**The detail pane's two marks.** A group's own pane shows "Built-in" when it is
built-in and "Archived" when it is archived, as separate marks in a status slot.
That slot has no header claiming to answer one question, and the marks are
additive rather than exclusive, so absence means absence there rather than the
other answer. Correct as it stands.

## Measured, recorded, not acted on

**One console, two words for putting a thing away.** The piggles console says
**"Put away"** in 47 places and **"Archived"** in 12, and its own filter on this
pane says "Including put away". The CRM module is now internally consistent —
the only remaining "Archived" strings in `surfaces/crm/` are two comments, one
of them recording this same drift being fixed on the pipelines list once
already. The 12 live in **cms, dropship, funnels, inventory, invoicing and
social**, none of which this act walked, and at least one of them (a message
thread in the social inbox) may want "Archived" on its own terms. Deciding that
from here would be guessing at six screens I have not read.

Worth naming as its own sweep rather than as a line in this one.

## The thing to remember

**A column header is a question, and every row under it has to answer THAT
question.** Both badges were true. The header was reasonable. What was wrong was
the pairing: the header asked one thing and the column answered two, so the
reader had to work out which question each row had chosen, and the natural
reading of two words side by side is that they are opposites.

The measurement that finds it is **"read the column top to bottom and say what
the header asked."** Six "Built-in" over three "Active" does not read as two
facts. It reads as six off and three on.
