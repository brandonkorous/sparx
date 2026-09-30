# 715 — A limit of 200 and a limit of $200.00

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 250
**Surface:** mypiggles + sparx — Stock › Spending limits, and three more money screens
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: the field reads 200.00
**Blocked on:** —

## What happened

Devi opened her one spending limit. The list behind it:

| Limit              | Holds from  | Signed off by | State    |
| ------------------ | ----------- | ------------- | -------- |
| Anything over $200 | **$200.00** | The owner     | In force |

The form in front of it:

> **Hold orders of this much or more**
> `200`
>
> The order's total, including freight. An order for exactly this much is held
> too, so a limit of **$200** catches a $200 order.

Same number, two spellings, one screen apart, and a third in the sentence
underneath.

## Why it matters

`MoneyTextInput` settles itself on **blur**, and only on blur:

```tsx
onBlur={() => { onTextChange(settleMoney(text, { allowZero: true })); }}
```

So whatever a screen seeds it with is what a person reads until they click into
it. This one seeded `(existing.minAmountCents / 100).toString()`.

On a bill it is worse than untidy. `(123450 / 100).toString()` is **`"1234.5"`** —
one decimal place, beside a piece of paper that says 1,234.50. Somebody checking
a supplier bill against its invoice reads that as a truncated number and goes
looking for the missing digit.

**MEASURED 2026-09-19** across both consoles: 18 places seed a money field from a
stored amount. **10 settled it. 8 did not** — and they were the same four files on
each side. The rule was already the house pattern; four screens were the
exception. [[feedback_a_fix_leaves_its_neighbour_behind]]

| file                          | what it holds                   |
| ----------------------------- | ------------------------------- |
| `po-approval-rule-detail.tsx` | the spending limit              |
| `supplier-bill-detail.tsx`    | what you paid a supplier's bill |
| `supplier-bill-new.tsx`       | a cost per unit on a bill line  |
| `supplier-return-detail.tsx`  | the credit you expect back      |

## What was done

One definition, in `lib/read-money.ts` beside `settleMoney`:

```ts
export function moneyText(cents: number): string {
  return (Number.isFinite(cents) ? cents / 100 : 0).toFixed(2);
}
```

All eight seeds call it. It lives in the `.ts` module rather than beside the
component because the guard below is a `.ts` test, and a `.ts` file importing a
`.tsx` one is a transform error that reports as **"no tests found"** — which is
the quietest way a guard can fail. Same reason `provenance-copy.ts` sits apart
from its pane.

The guard reads the surfaces and asserts no money field is handed a shape it
would not leave, plus the denominator so it cannot go green over an empty scan.

## Files

- `piggles|sparx/apps/workbench/lib/read-money.ts` — `moneyText`
- `piggles|sparx/apps/workbench/components/money-input.tsx` — re-export
- `piggles|sparx/apps/workbench/components/money-seed.test.ts` — new
- the four surfaces above, in both consoles

## Also on this pane

The footer said "Orders waiting on a limit appear under **Sign-offs**" and left
her to find it. It names a screen, so it now opens it — the same `ctx.open` the
purchase order pane already uses for the same destination.

## Proof

Put `.toString()` back on the spending limit: the test fails naming the file and
line. Restored: 5 pass, both consoles. On screen the field reads **200.00**,
matching the list beside it.
