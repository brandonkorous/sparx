# 086 — She priced a cut at sixty-five, and it came out six thousand five hundred

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · act 4 (money at the edges)
**Surface:** mypiggles › Bookings › Services, and nine other money fields
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P02 · Nia · on screen 2026-08-21

## What happened

Nia added **Cut and finish**, 60 minutes, and typed the price the way she writes
it on the board by the mirror:

```
65,00
```

The field accepted it and read back **6500**.

Not zero. Not a refusal. Not a squiggle under the field. **Six thousand five
hundred dollars for a haircut**, on the price list her clients book from.

## Why this is a blocker and [075](075-a-price-typed-with-a-comma-became-free.md) was a major

[075](075-a-price-typed-with-a-comma-became-free.md) — the same comma, on the
invoice line editor — turned `8,50` into **0.00**. A free line is wrong and
obvious: the total is visibly missing money and she fixes it.

This one multiplies by a hundred and looks plausible in a column of numbers. She
is not billing anybody at the moment she types it, so nothing reconciles. The
first person to notice is a client on the public booking page.

It is the same root cause and the fix already exists in this codebase — it just
never reached here.

## What should have happened

`65,00` is sixty-five dollars. So is `$65`, `65.00`, and `1 250,75` for the
matinée package. `lib/read-money.ts` already reads all of them, and
`surfaces/invoicing/money-input.tsx` already wraps it in a field that stays
editable while you type. Neither is used outside invoicing and one commerce
screen.

## How to reproduce

Every time.

1. Bookings › Setting it up › Services › **New service**.
2. Name `Cut and finish`, length `60`.
3. Click **Price** and type `65,00`.

Read the field back: `6500`.

`8,50` → `850`. `1,250.00` → the browser keeps only what it can parse. The comma
is dropped and the digits close up behind it.

## Why it matters

Wrong money, silently, on a field a customer reads. It is also the second time
this exact defect has been found in this project by typing a comma, which is how
a large part of the world writes cents — the first fix was made where it was
found rather than where it propagates, and that is the thing root RULE #1 exists
to stop.

## Where it lives

`surfaces/scheduling/service-detail.tsx` — the Price field is a raw
`<Input type="number">` feeding `Number(event.target.value) || 0`.

Nine more money fields are still the same shape, found by looking for a
`type="number"` under a money label:

| File                                        | Field                     |
| ------------------------------------------- | ------------------------- |
| `scheduling/service-detail.tsx`             | Price                     |
| `scheduling/policy-detail.tsx`              | Deposit amount            |
| `commerce/discount-detail.tsx`              | Amount off                |
| `commerce/giftcard-detail.tsx`              | Amount                    |
| `commerce/price-list-detail.tsx`            | Price per row             |
| `commerce/return-actions.tsx`               | Amount to give back       |
| `commerce/configurator-template-detail.tsx` | Adds to price             |
| `commerce/product-configurator.tsx`         | Adds to price             |
| `inventory/purchase-order-detail.tsx`       | Cost each · Shipping cost |
| `invoicing/line-editor-modal.tsx`           | Cost                      |

`partner/bootcamp-detail.tsx` (Price per seat) is a WizeWorks-staff surface, not
a tenant one; listed for completeness, not fixed with the rest.

## The fix

**One money field, in one place, used everywhere money is typed.**

- `surfaces/invoicing/money-input.tsx` → **`components/money-input.tsx`**. It was
  already used by thirteen files across b2b, commerce and invoicing; living under
  `invoicing/` is what made it look like an invoicing idea, and why the next
  money field was written from scratch as a number input.
- A second export, **`MoneyTextInput`**, for an amount that can be left blank and
  mean "none". `MoneyInput` takes a number and cannot express that — a blank
  would report 0, and "free" and "not set" are different answers. With it,
  `moneyProblem(text)` (the sentence to show) and `moneyCents(text)` (cents, or
  null when unreadable).
- **Ten money fields swapped** off `type="number"`:
  `scheduling/service-detail` (Price), `scheduling/policy-detail` (deposit,
  no-show fee, late-cancel fee), `commerce/discount-detail`,
  `commerce/giftcard-detail` (×2), `commerce/return-actions` (amount back,
  restocking fee), `commerce/configurator-template-detail`,
  `commerce/product-configurator`, `inventory/purchase-order-detail` (cost each,
  shipping), `invoicing/line-editor-modal` (cost), `partner/bootcamp-detail`.
- **Save waits.** `priceToCents` used to read "empty or unparseable" as free; now
  unreadable is `null`, `canSave` is false, and the field says why. The same on
  booking rules.

Quantity and percentage fields were left as `type="number"` on purpose — they
are counts, not money, and `readMoney` would be the wrong reader for them.

## Confirmed by

Re-run as Nia on 2026-08-21. Bookings › Services › New service, name
`Cut and finish`, length `60`, and `65,00` typed into **Price**:

- The field settles to **`65.00`** when she leaves it, not `6500`.
- Created, and the Services list reads **Cut and finish · 1 hr · $65.00**.

`8,50` → `8.50`. `$65` → `65.00`. Text that is not an amount at all is refused
with "That does not look like an amount. Try something like 8.50." and Save stays
off until it is fixed — rather than being written down as free.
