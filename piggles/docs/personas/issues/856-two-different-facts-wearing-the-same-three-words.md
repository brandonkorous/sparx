# 856 — Two different facts wearing the same three words, four inches apart

**Status:** fixed
**Severity:** **moderate** — the band tells her never-counted stock is not in the
list, and a row in the list is badged never counted, so one of them has to be
wrong and she cannot tell which
**Found by:** P03 · act 299, opening Stock because the nav said 4 things were
waiting
**Surface:** mypiggles › Stock
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** her own stock list, read back from the live screen before and
after

## On one screen, at one time

```
1 version you sell has never been counted
This list only holds what you have counted, so they are not below.
Until somebody counts it, your website sells it without limit. WEEKEND-SET.
                                                            [ Count them ]

Item                                                              To sell
Linen, natural, 200gsm   LINEN-NAT-200   In stock   Never counted      45
```

The band says never-counted versions **are not below**. Four inches below it is
a row badged **Never counted**, with 45 to sell.

Both sentences are true and they are about different things.

| words         | where    | what it actually means                                                                |
| ------------- | -------- | ------------------------------------------------------------------------------------- |
| never counted | the band | no stock number exists at all, so there is no row, and the website sells it unlimited |
| Never counted | the row  | there IS a number, 45 of it, and nobody has ever looked at the shelf to check it      |

The first is dangerous. The second is mildly stale. She has no way to tell them
apart, because they are spelled identically.

## The right word was already in the file

`countVerdict` draws the row badge. Its own doc comment opens:

> When this stock was last **CHECKED** against the shelf, and whether that is a
> problem yet.

And its detail sentence, the one on hover, says the schedule out loud: _"You
count this every 30 days, and nobody has counted it yet."_ Everything around the
label knew the difference. The label did not.

It now reads **Never checked**, with _"nobody has checked it against the shelf
yet"_ under it. "Never counted" stays where it belongs, in the band, where it
means there is nothing to check.

This is the same shape as the last three fixes on this run: the answer was
already written down next to the mistake.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## And the band could not count to one

Reading it properly turned up a second thing in the same three lines:

```
1 version you sell has never been counted       singular
so THEY are not below                           plural
until somebody counts IT                        singular
[ Count them ]                                  plural
```

Four sentences, three different numbers, about one shirt.

Two of the four had a singular and a plural form, carefully written. Two did not
— and they are exactly the two nobody thinks of as sentences: **a clause in the
middle of another sentence**, and **a button label**.

So all four moved into `uncounted-words.ts` and are chosen together. A fifth
sentence added to the band without a singular form now fails a test rather than
shipping.

## Proved

| file                         | tests | proved red by                        | went red |
| ---------------------------- | ----- | ------------------------------------ | -------- |
| `integrity-verdicts.test.ts` | 22    | restoring the old label and detail   | 3 of 22  |
| `uncounted-words.test.ts`    | 10    | restoring the two original sentences | 5 of 10  |

`countVerdict` had **no test at all** in either console before this, though the
file it lives in has one covering its neighbours.

The sharpest test is the blunt one, and it is the assertion the shipped code
failed: **for one version, nothing the band says may be plural.**
[[feedback_a_test_that_cannot_go_red]]

**On screen**, her own stock list, read from the live DOM:

```
before   so THEY are not below   ·   [ Count them ]   ·   LINEN-NAT-200  Never counted  45
after    so it is not below      ·   [ Count it ]     ·   LINEN-NAT-200  Never checked  45
```

**Checks:** typecheck 0 on both workbenches. 22 files / 207 tests across
`surfaces/inventory`, `surfaces/migration` and the console spelling guard. Guards
`american-spelling`, `console-parity`, `em-dashes`, `plain-words` green. The four
changed files are byte-identical across the two consoles. ESLint and prettier
clean.

## Files

- `{piggles,sparx}/apps/workbench/surfaces/inventory/integrity-data.ts` (the row badge)
- `{piggles,sparx}/apps/workbench/surfaces/inventory/uncounted-words.ts` (new, the band's four sentences)
- `piggles/apps/workbench/surfaces/inventory/uncounted-words.test.ts` (new)
- `{piggles,sparx}/apps/workbench/surfaces/inventory/stock-uncounted-band.tsx`
- `{piggles,sparx}/apps/workbench/surfaces/inventory/integrity-verdicts.test.ts`

## The thing to remember

**Two components can each be right and still lie together.** Nothing was wrong
with the band on its own, nothing was wrong with the badge on its own, and both
were written by somebody who understood the distinction perfectly — the proof is
that the function header says "checked" and the band says "counted". Neither
author was ever looking at the other's words, because nothing in the code puts
them side by side. Only the screen does.

So the test worth having is not "is this sentence right" but **"what else is on
the screen when it says this"** — which is a question no unit test asks and only
opening the page does.
