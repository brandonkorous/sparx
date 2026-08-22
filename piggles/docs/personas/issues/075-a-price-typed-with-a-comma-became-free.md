# 075 — A price typed with a comma became free, and the payment box just went grey

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · standing checks — money edges
**Surface:** mypiggles › every money field: the order's Money in box, and the
shared amount field behind ~20 panes (prices, invoice lines, trade pricing,
credit limits, purchase orders, shipping rates)
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P01 · Marisol · on screen 2026-08-21

## What happened

Two money fields, two different failures, one cause: both read an amount with
`Number()`, which knows exactly one spelling of money.

**The order's Money in box** (`How much they paid`, a text field). Typed against
her $8.00 collection order, watching the Write it down button:

| she types  | before           | what she is told                        |
| ---------- | ---------------- | --------------------------------------- |
| `8,50`     | button greys out | **nothing**                             |
| `$8.00`    | button greys out | **nothing**                             |
| `1,250.00` | button greys out | **nothing**                             |
| `abc`      | button greys out | **nothing**                             |
| `0`        | button greys out | **nothing**                             |
| `-5`       | button greys out | **nothing**                             |
| `0.001`    | button stays on  | — a payment of a tenth of a cent        |
| `8.999`    | button stays on  | — sub-cent money                        |
| `1e9`      | button stays on  | — a billion dollars against an $8 order |

A comma for the cents is how most of the world writes money, and a dollar sign
is what the rest of her screen shows her. Both kill the button with no word said
and nothing to read. There is no example in the field, no placeholder, no
message — the control simply stops working and she has no way to learn why.

**The shared amount field is worse**, because it is `<input type="number">` and a
browser number field answers text it cannot parse with the EMPTY STRING. Traced
on the live page:

```
'8,50'     → value ""  valueAsNumber NaN
'$8.00'    → value ""  valueAsNumber NaN
'1,250.00' → value ""  valueAsNumber NaN
```

The component then did `onValueChange(Number('') || 0)` and, on blur,
`setText((Number(text) || 0).toFixed(2))`. So a price typed `8,50` was reported
upward as **0** and settled in the box as **"0.00"** — a number she never typed,
on a product she is about to sell. It is used by roughly twenty panes: product
prices, invoice lines, trade pricing tiers, account credit limits, purchase order
lines, shipping rates, collection rules.

## Why it matters

Silence on the refusal and silence on the acceptance, in the same field.

The payment box refuses her and explains nothing, which for a non-technical
owner is a dead end — [[feedback_non_technical_audience]]. The shared field does
the opposite and is the dangerous one: it accepts, invents a zero, and shows it
back as though she wrote it. Nothing about "0.00" says "we could not read what
you typed", so the only way to catch it is to notice a price you did not set.

That is the shape [[feedback_never_present_absence_as_measurement]] is about — a
value nobody entered rendering exactly like one somebody did.

## The fix

New [lib/read-money.ts](../../../apps/workbench/lib/read-money.ts) — one reader
for how a person writes an amount, and one sentence for when it cannot be read.

- **Currency marks and spaces come off first** — `$`, `£`, `€`, `¥`, `₹`, `₽`,
  ordinary and non-breaking spaces. `$ 1 250,75` reads as 1250.75.
- **Which of `.` and `,` is the decimal point is decided, not assumed.** Both
  present: the last one separates the cents, so `1,250.00` and `1.250,00` both
  read 1250. One present: two digits after it is cents (`8,50`), three is a
  thousands group (`1,250`).
- **Exponent form is refused on purpose.** `1e9` is a slip on a keyboard, never a
  price, and the alternative is a billion dollars going in without a word.
- **Rounded to the cent**, so `8.999` is $9.00 and `0.001` is nothing at all.
- **Zero is the caller's decision.** A price of zero is real (a free item, a
  discount not set yet); a payment of zero is not. Refusing is the default and a
  field that prices things opts in.

Applied in two places:

**The Money in box** now says what is wrong under the field instead of greying
out in silence, and **settles the amount when she leaves it** — she types `8,50`,
tabs on, and the box reads `8.50`, which is the amount that will be written down.
Nothing is guessed: text that cannot be read at all is handed back unchanged.

**The shared amount field** is `type="text"` with `inputMode="decimal"` (so a
phone still gets the number pad) and reports upward only amounts it could
actually read. Half-typed text on the way to a real number — `8,` heading for
`8,50` — holds the last readable amount rather than dropping the total to zero
mid-word. Clearing the field still means zero, as it always did.

The `type="number"` spinner goes with it, which is no loss on a money field: its
other habit is changing a price when somebody scrolls the page with the pointer
over it.

## Confirmed on screen — 2026-08-21

Driven on her order pane, typing into the real field and reading the real button:

| she types  | button | what it now says                                            |
| ---------- | ------ | ----------------------------------------------------------- |
| `0`        | off    | That comes to nothing, so there is nothing to write down.   |
| `0.001`    | off    | That comes to nothing, so there is nothing to write down.   |
| `-5`       | off    | An amount cannot be less than nothing.                      |
| `abc`      | off    | That does not look like an amount. Try something like 8.50. |
| `1e9`      | off    | That does not look like an amount. Try something like 8.50. |
| `8,50`     | **on** | —                                                           |
| `$8.00`    | **on** | —                                                           |
| `1,250.00` | **on** | —                                                           |

And leaving the field settles it to what will be written down:

| typed   | settles to                                                          |
| ------- | ------------------------------------------------------------------- |
| `8,50`  | `8.50`                                                              |
| `$8.00` | `8.00`                                                              |
| `1,250` | `1250.00`                                                           |
| `8.999` | `9.00`                                                              |
| `abc`   | `abc` — unreadable text is left alone, never replaced with a number |

### What is NOT confirmed

**The submit itself.** The browser bridge in this session could not deliver a
real click or keystroke to the page (see the run log for 2026-08-21), so no
payment was actually written down through the fixed field, and the ~20 panes
behind the shared amount field were not each opened and typed into. What is
confirmed is the component's behaviour on the real screen, with real renders, on
the one pane that could be reached.
