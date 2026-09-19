# 653 — Two of the three numbers were shouting about nothing

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 228
**Surface:** Stock — "Things that do not add up", "How it is performing", "Import from a spreadsheet"
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 228 (on screen, both themes)

## What she saw

"Things that do not add up" is the screen that tells a shop owner whether her
stock numbers can be trusted, and its top half is unimpeachable: a green tick
over "Every change ever recorded was added back up and compared with 74 stock
records", **0** that do not add up, **$0.00** in question.

Then, below it, three figures in a row:

> **1** Sales refused &nbsp;&nbsp;&nbsp; **0** Promised anyway &nbsp;&nbsp;&nbsp; **0** Sold below zero
> _amber_ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; _blue_ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; _red_

The red one is the zero. Scanning that row, the eye goes to the loudest color,
and the loudest color is on the number saying nothing went wrong.

## The cause

The tone was pinned to the KIND of event, not to whether any had happened:

```tsx
<Text className="text-warning …">{summary.blocked}</Text>
<Text className="text-info …">{summary.allowed}</Text>
<Text className="text-danger …">{summary.negativeOnHand}</Text>
```

**The rule was already written down, twice.** On the receivables card:

> The one figure allowed to shout. Everything else on this surface stays neutral
> so that this reads as urgent rather than decorative.

And 150 lines above those three stats, **in the same file**, a fourth count
already guarded itself:

```tsx
openDrifts > 0 ? 'text-danger text-2xl tabular-nums' : 'text-2xl tabular-nums';
```

Six screens never got the message. [[feedback_a_fix_leaves_its_neighbour_behind]]

## Measured

37 big colored figures across the two consoles. Sorted by what the color is
actually doing:

| what it is                                                             | count |
| :--------------------------------------------------------------------- | ----: |
| already guarded, or only rendered when there is something to report    |    24 |
| a **legend** — one slice of a partition, or a word rather than a count |     6 |
| **an alarm on a figure that can be zero**                              | **7** |

The seven: three on "Things that do not add up", two on "How it is performing"
(lines short, lines that ran out), one on the spreadsheet import, and one that
turned out to be a legend on inspection.

## The fix

`count-ink.ts`, a leaf module holding the rule once:

```ts
export function countInk(count: number, ink: string): string {
  return count > 0 ? ink : '';
}
```

It returns the EMPTY string, not a muted or faded class. A zero is still a figure
she is meant to read, and fading it would break RULE #3 to fix RULE #4.

The spreadsheet import is the same fault inverted: **0 matched an item** was
painted success green, so a file that matched nothing reported a failure in the
color of success.

## Guard

`pnpm check:count-ink` fails on an alarm ink written as a literal class beside
`text-2xl`.

It cannot tell a problem counter from a **partition** — "Healthy / Running low /
Sold out" are three slices of one total and their colors are a legend — so those
six are named in `ALLOWED` with their reason rather than guessed at. A check that
guesses reports working code as broken, and a false positive has been swept here
before. [[feedback_codemod_diff_your_own_sweep]]

Proved red five ways:

1. a call site goes back to a fixed alarm color → names the file and the class
2. `countInk` stops dropping the color at zero → dies, because then every call
   site still reads as fixed and every screen shouts again
   [[feedback_a_test_that_cannot_go_red]]
3. it fades the zero instead → dies with the RULE #3 reason, proved separately
   because the first assertion was catching break 3 and hiding it
4. a scan root moves → exits 1 rather than passing over nothing
   [[feedback_structural_checks_go_blind]]
5. plus 6 unit tests, including one that the helper leaves no trailing space

## Also fixed: a note nobody could read

**Every change** shows a reason and, under it, the note the system wrote:

> Sold
> _Replacement sent for retur…_

Clipped, with nothing to hover. The cap on that column is load-bearing (issue
557 measured it holding the whole table at 752px inside a 400px pane), so the
note HAS to clip — but the note is a sentence that appears on no other list.

[558](558-a-database-id-printed-on-the-ledger-i-read-every-week.md) changed that
sentence to name the order: **"Replacement sent for the return on order
O-000016"**. At this column width the order number is exactly the part that gets
cut off, so the fix would have landed in the database and never reached the
screen.

It now carries a `title`, matching the only three other truncated sentences in
the console. The full note is also on "Where this number came from", untruncated,
behind the shield on the row.

## Files

- `piggles|sparx/apps/workbench/lib/count-ink.ts` + `.test.ts` (new)
- `piggles|sparx/apps/workbench/surfaces/inventory/{integrity,performance,stock-import,movements-list}.tsx`
- `scripts/check-count-ink.mjs` (new), `package.json`, `.githooks/pre-push`
