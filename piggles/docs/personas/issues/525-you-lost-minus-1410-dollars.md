# 525 — "You lost −$1,410.80"

**Status:** fixed and proven
**Severity:** major
**Found by:** Devi, opening the money screen for the first time
**Surface:** `surfaces/finance/profit.tsx`, `surfaces/finance/job-profit.tsx`, both trees
**Filed:** 2026-09-15

## What she saw

**What you kept**, on her main site. The first thing on the card, in the largest
type on the screen, in red:

```
You lost
−$1,410.80
About the same as last month    [ -194.3% of everything that came in ]
```

and again at the foot of the working, where the lines add up:

```
What you lost      −$1,410.80
```

## Why it is wrong

Three separate things on that card say the figure is negative:

1. the word **lost**,
2. the **red**,
3. the **minus sign**.

The first two agree with each other. The third argues with them, because in
plain English **losing a negative amount is a gain**. "You lost minus fourteen
hundred dollars" is either nonsense or the opposite of what happened, and it is
set in the largest type on the page, which is the part read fastest and least
carefully.

A bank statement does not say "overdrawn by −$1,410.80". It says "overdrawn by
$1,410.80", because the word already did that job.

The code had the label and the number as two independent decisions sitting next
to each other:

```tsx
<Text>{lost ? 'You lost' : 'You kept'}</Text>
<Heading>{formatCentsSigned(current.netProfitCents, currency)}</Heading>
```

`formatCentsSigned` is not the problem and has not changed. It is right
everywhere the sign is the **only** thing carrying the direction, which on this
same screen is the line **What the work made** and, one pane over, the margin
column in the job list. It was simply reached for in the three places where a
word had already said it.

## What changed

The word and the size are now one decision, so they cannot drift apart:

```ts
export function profitOutcome(
  cents: number,
  currency: string,
  words: { kept: string; lost: string }
): { label: string; amount: string; lost: boolean } {
  const lost = cents < 0;
  return {
    lost,
    label: lost ? words.lost : words.kept,
    amount: formatCentsUnsigned(cents, currency),
  };
}
```

Three places print a size rather than a sign, because a word beside each of them
already names the direction:

| where                   | the word beside it               |
| ----------------------- | -------------------------------- |
| the profit headline     | You lost / You kept              |
| the profit bottom line  | What you lost / What you kept    |
| the job-profit headline | Work that cost more than it made |

The margin badge goes with the headline for the same reason: under **You lost**,
`194.3% of everything that came in` reads as "the loss was 194.3% of what came
in", which is what it is. It was also mixing its minus glyphs with the headline
— a true minus sign above an ASCII hyphen below.

## Left signed, deliberately

- **What the work made** — a neutral label. A negative gross profit has nothing
  else announcing it, so the sign is the only thing carrying it.
- **The job list's margin column and badge** — a column header, not a sentence.
  Rows of mixed profit and loss need the sign per row.

That contrast is the fifth guard, and it is the one that stays green under every
break below. It exists so this is not read as "never print a minus".

## Proven

Six guards in `profit-words.test.ts`, in both trees. Five go red, three ways:

| break                                  | reddens |
| -------------------------------------- | ------- |
| `formatCentsUnsigned` signs its answer | 3       |
| the two words are swapped              | 3       |
| a break-even counts as a loss (`<= 0`) | 1       |

Breaking even is its own guard because zero is not a loss, and `<= 0` would tell
a shop that came out exactly level that it lost money.

On Devi's own screen afterwards, September, her main site:

```
You lost
$1,410.80
About the same as last month    194.3% of everything that came in
...
What you lost      $1,410.80
```

Minus signs left on that card: **0**. The arithmetic is unchanged and still adds
up: $726.00 in, less $286.80 cost of the work, is $439.20 made; less $1,850.00
running costs is $1,410.80 lost.
