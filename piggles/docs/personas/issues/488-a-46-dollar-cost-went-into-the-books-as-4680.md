# 488 — A $46.80 cost went into her books as $4,680.00

**Status:** fixed
**Severity:** critical
**Found by:** Devi recording thread, interfacing and buttons
**Surface:** `finance.expense.detail` and every money field in Money (both consoles)
**Filed:** 2026-09-09

## What was wrong

She typed `46,80` into Amount on a new cost and pressed **Record cost**. The
console said "Cost recorded". The row in the database says:

```
Thread, interfacing and buttons, local haberdashery |  468000
```

**Four thousand six hundred and eighty dollars**, against a business whose whole
month of spending was $2,090. It is worse than a wrong price on a form: this is
her accounts. It feeds Profit, it feeds the category totals, and nothing on any
screen would ever say it was a hundred times too big.

## Why

`parseMoneyToCents` threw every comma away before it looked at the number:

```ts
const trimmed = input.trim().replace(/[,\s]/g, '');
```

That reads `1,250` as twelve hundred and fifty, which is right, and `46,80` as
four thousand six hundred and eighty, which is not. The parser never asked WHICH
comma it had.

## Both halves of the answer already existed, in two different parsers

- `read-money.ts` knows which of `.` and `,` separates the cents — `decimalMark`
  is a documented function whose whole job is that question — and then finished
  with `Math.round(Number(x) * 100)`, which reads three decimals LOW:
  `Number('0.145') * 100` is 14.499999999999998, so $0.145 rounds down to 14¢.
- `parseMoneyToCents` did that arithmetic exactly, on a string it had already
  ruined.

Each had the half the other was missing, and a docblock explaining why its half
mattered.

## The fix

The exact string arithmetic moved into `read-money.ts` as `exactCents`, so
`readMoney` now reads every spelling AND rounds every third decimal correctly.
`parseMoneyToCents` asks it. There is one money parser.

Money's Amount and Tax boxes became `MoneyTextInput` at the same time, so what
she typed settles into two decimals when she leaves the field — `46,80` reads
back as `46.80` before she saves, which is the moment to catch it.

## Proven

Sixteen new tests, both consoles. Two of them are the ones that were red:

- removing `exactCents` reddens **"rounds a third decimal UP rather than down
  through a float"** — exactly one test
- putting `.replace(/[,\s]/g, '')` back reddens **"reads a comma as the cents
  when two digits follow it"** — exactly one test

On screen: re-typed `46,80`, watched it settle to `46.80` on blur, saved, and the
row now reads `4680`. Her books are right.
