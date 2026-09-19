# 592 — It tells me to click a row when there are no rows

**Status:** fixed
**Severity:** design
**Found by:** P03 · Juniper Row · act 200
**Surface:** mypiggles › every list pane in the console
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 201 (seen on screen)

## What happened

I opened Repeat orders. Juniper Row has never set one up, so the pane said so,
kindly:

> **No repeat orders yet**
> When a customer sets up a product to be delivered on a schedule, their repeat
> order shows up here with what it's worth each month.

And then, underneath the empty box, in its own line across the bottom of the
pane:

> Click to open · Shift-click alongside · Alt-click in a new window

Click what. There is nothing there. I read the empty message again to check I
had not missed a list somewhere below it.

It is worst when I have just searched. On Gift cards, which I DO have two of, I
typed a code I had misremembered. The pane said "Nothing matches that search",
and directly under it told me how to open one of the things that do not match.

## What should have happened

The line teaches three gestures for opening a row. It belongs to the rows. When
there are no rows it should not be there, the same way the table above it is
not there.

Sixty-nine of the console's eighty-seven lists already did exactly that. So the
console already knew the rule. It had just been applied to a fifth of the places
it applies to.

## How to reproduce

Every time, on any list with nothing in it.

1. Sign in as Devi, open **Sell › Repeat orders**. Juniper Row has none.
2. The empty state reads "No repeat orders yet".
3. The hint line sat under it anyway.

Or with a search, on a list that does have rows:

1. Open **Sell › Gift cards**. Juniper Row has two.
2. Search for `zzzz`.
3. The pane says "Nothing matches that search", and the hint line stayed.

## Why it matters

It is not wrong data and it costs no money. It makes an empty screen read as a
screen that has failed to load, which is the one thing an empty state exists to
rule out. A first-time owner opening a module she has not used yet meets this on
almost every pane, on the day she is deciding whether the thing works.

## Where it lives

`components/row-open-hint.tsx` in both consoles renders the line. The defect was
never in that file — it was in who called it without a condition.

|                             | piggles | sparx  |
| --------------------------- | ------- | ------ |
| hint call sites             | 87      | 88     |
| already guarded before this | 18      | 18     |
| **guarded by this fix**     | **69**  | **70** |
| unguarded after             | 0       | 0      |

**The count had to come from somewhere, and the first place I looked was
wrong.** My first pass picked the array each file maps over most often. That
resolved 47 of the 61 automatically and I nearly ran it. Reading two of its
answers back by hand caught this, in `cms/authors-list.tsx`:

```tsx
const matches = useMemo(() => (needle ? authors.filter(...) : authors), [authors, needle]);
…
<AuthorsTable authors={matches} />
<RowOpenHint what="an author to edit" />   // it proposed: authors.length > 0
```

`authors` is everything fetched; `matches` is what the table is handed. Guarding
on `authors` would have kept the hint up over an empty SEARCH — the same defect,
moved, in the file most likely to show it. A wrong answer here is invisible:
nothing goes red, nothing fails to build, and the line looks guarded.

So the count came from two things already written down in each file:

1. **Where the pane pages its rows** (64 sites) — `<ListPagination shown={X}>`,
   whose prop is documented as _"Rows currently on screen."_ That is the same
   question the hint needs answered, already answered, a few lines above it.
2. **Where the pane holds every row in memory** (41 sites) — the array its own
   empty state already tests. If the pane says "nothing here" when `groups` is
   empty, then `groups` is what is on screen.

Neither is a guess about what the author meant. Both were cross-checked against
what the pane actually renders (every `.map()` in its JSX, every rows-ish prop):
41 of 42 agreed, and the one disagreement was `rows as LotRow[]` — the same array
wearing a cast, on a site that was already guarded.

Eighteen sites matched neither rule and were read one at a time. Two needed a
judgement no scan makes: `commerce/shipping.tsx` draws two tables under one
hint, so either one having rows earns it; `entity-list.tsx` already carried
`config.detailSurface`, so the count is ANDed onto it rather than nested.

**A divergence turned up while doing it.** `cms/authors-list.tsx` is a plain
`<tbody>` in sparx and a separate `<AuthorsTable>` component in piggles. Same
screen, same fix, but only one of them is readable by a scan that looks for a
table body. Worth knowing the next time a check reports different numbers for
the two consoles: it may be the consoles differing, not the check.

## Guard

`lib/console/row-hint-hidden-when-empty.test.ts` in both consoles. It parses
every hint, reads the condition controlling it AND which branch it sits in
(`cond ? <Empty/> : <Hint/>` and `cond ? <Hint/> : <Empty/>` share a condition
and mean opposite things), and fails on any hint whose guard it cannot read as
"there are rows". **A condition it cannot classify counts as unguarded** — an
unreadable guard and a missing one look identical from here, and treating
"cannot tell" as "fine" is how the other 61 stayed broken.

Proven red: removing the guard from `commerce/orders-list.tsx` and
`chat/inbox.tsx` fails it, naming both files and no others.

It also asserts it scanned more than 150 files and found more than 60 hints, so
it cannot go blind and print green.

## Still open

Nothing from this issue. The hint is guarded at all 175 call sites across both
consoles.

**Seen on screen, both ways** (2026-09-16, after the dev stack came back):

| pane                               | state                 | hint line        |
| ---------------------------------- | --------------------- | ---------------- |
| Sell › Repeat orders               | no rows, ever         | gone             |
| Sell › Gift cards, searched `zzzz` | 2 rows, none matching | gone             |
| Sell › Gift cards, unsearched      | 2 rows                | shown, correctly |

The third row is the one worth having: the fix hides the line when the list is
empty and does NOT hide it when there are rows, which a guard on the wrong array
would have got backwards.
