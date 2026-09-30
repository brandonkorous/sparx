# 858 — A list of messages with none of the message

**Status:** fixed
**Severity:** **moderate** — the inbox for everything customers send her through
her own website, showing a name and a Read chip and nothing else at the width the
dock actually opens it at
**Found by:** P03 · act 302, opening My Site because the nav said 2 things were
waiting
**Surface:** mypiggles › My Site › Form replies
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** the pane's own DOM, before and after, at its real width and
again at 360px

## What the pane gave her

```
From                              Status
Rosalind Achebe                   Read
rosalind.achebe@example.com
Hanne Sorensen                    New
hanne.sorensen@example.com
```

Two new messages from her own website, and nothing at all about either one. Not
what they asked, not when they asked it.

What was actually in the first row, hidden:

> I am between a S and an M in the Ash Overshirt and I wear it over a jumper…

A sizing question about a real garment, from somebody deciding whether to buy.

## The column order, measured

Six columns, five of them hidden until the pane is wide enough:

| column         | appears at | what it is                    |
| -------------- | ---------- | ----------------------------- |
| From           | always     | who                           |
| **Form**       | **32rem**  | which form it arrived through |
| Received       | 36rem      | when                          |
| What they sent | **42rem**  | **the message**               |
| Site           | 48rem      | which of her sites            |
| Status         | always     | New / Read                    |

Her pane is **374px**. So she got From and Status.

And between 32rem and 42rem — a perfectly ordinary pane width — the screen adds
**which form it came through** before it adds the message.

## The argument was already written down, one column over

The file's own header said:

> SITE only appears when there is more than one, because on the single site most
> owners have it is their own business name written down the page — the repeat
> RULE #4 says to demote, **costing width that "What they sent" would rather
> have**.

Somebody worked out exactly this, named the right column as the one that matters,
and applied it to Site. **Form sat next to it, had the same problem, and kept its
place ahead of the message.**

Measured 2026-09-28: every tenant on the platform with anything in this inbox has
exactly **one** form. The Form column is the same string written down the page
for all of them, which is the precise condition the comment gives for demoting.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## And sparx never got the Site demotion at all

The two consoles hold the same table. Piggles had demoted Site to "only when
there is more than one"; sparx renders it unconditionally. The same habit, one
level up: a fix landed in one console and not its twin.

Both now do both.

## What it does instead

```
From              always
What they sent    32rem      ← was 42rem
Received          36rem
Form              42rem      ← was 32rem, and only when there is more than one
Site              48rem      ← only when there is more than one
Status            always
```

**And below 32rem the message does not disappear, it moves.** The From cell
already stacks a name over an email; the preview becomes a third line there,
hidden exactly where the real column takes over so it is never shown twice.

That is the part worth keeping. Re-ordering columns only moves which width is the
bad one. There is now no width at all where this screen lists messages without
any of the message.

## On screen, read from the live DOM

```
before   Rosalind Achebe · rosalind.achebe@example.com                          Read
after    Rosalind Achebe · rosalind.achebe@example.com · I am between a S and   Read
         an M in the Ash Overshirt and I wear it o…
```

And at **360px**, with the pane forced narrow: `What they sent` hidden as a
column, the preview still on screen in the From cell.

**Checks:** typecheck 0 on both workbenches. 7 files / 57 tests across
`surfaces/builder`. Guards `console-parity`, `american-spelling`, `em-dashes`,
`plain-words` green. ESLint and prettier clean.

## Files

- `piggles/apps/workbench/surfaces/builder/form-submissions-table.tsx`
- `piggles/apps/workbench/surfaces/builder/form-submissions-list.tsx`
- `sparx/apps/workbench/surfaces/builder/form-submissions-list.tsx`

## The thing to remember

**A responsive table decides what matters, and nobody reviews that decision.**
Column order looks like markup. It is really a ranking of what the screen is for,
written as six breakpoints, and the only person who ever sees the ranking tested
is somebody with a narrow pane. Every check was green: the column existed, the
data was fetched, the value was correct, and it was three CSS classes away from
being read.

The tell here is that **the reasoning was in the file and stopped one line
short.** Somebody had already asked "which column would `What they sent` rather
have the width from", answered it for Site, and did not look left.
