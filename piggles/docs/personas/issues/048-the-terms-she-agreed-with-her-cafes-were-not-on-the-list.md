# 048 — The terms she agreed with her cafés were not on the list

**Status:** fixed
**Severity:** major (a wrong due date on every invoice to either café, and one screen reporting no agreement where another had recorded one)
**Found by:** P01 · Thistle & Rye · act 10 — adding the two wholesale cafés
**Surface:** mypiggles › Customers › Companies › Trade terms, and B2B › the trade account
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 10 — both cafés saved on **14 days to pay**

## What happened

Marisol supplies two cafés and invoices them monthly on **Net 14**. She opened
Payment terms:

> No agreed terms · Pay before dispatch · 15 days to pay · 30 days to pay ·
> 60 days to pay · 90 days to pay

Fourteen is not there. Her options were to record 15 — a day she did not agree —
or 30, which is twice what she agreed.

## Why it matters

Terms are not a preference, they are what two businesses agreed. The stored value
drives the invoice's **due date** and the aging buckets behind "what am I owed",
so rounding 14 up to 15 puts a wrong date in front of a customer and mis-ages a
real debt. Nothing on the screen admits it happened, because from the software's
point of view nothing did.

Net 14 is not exotic. Neither is Net 7, Net 21 or Net 45 — none of which were
offered either.

## And the same field disagreed with itself

The same column (`Company.paymentTerms`) is edited by **two** panes, each with its
own hardcoded list:

|        | Customers › Companies | B2B › trade account  |
| ------ | --------------------- | -------------------- |
| prepay | Pay before dispatch   | Pays before you ship |
| net15  | 15 days to pay        | **— missing —**      |
| net30  | 30 days to pay        | Pays within 30 days  |

So a company set to 15 days in one screen read back in the other as **"No terms
set"** — its `switch` fell through to a default for every value it did not list.
That is not a display quirk. It is one screen reporting that no agreement exists
about money somebody owes, while another screen holds the agreement.

A third copy of the list sat in the segment builder, so a segment could only ever
be built on four of the terms a business can hold.

## Why it happened

`crm-schemas` declared `PaymentTerms` as `z.enum(['prepay','net15','net30',
'net60','net90'])`, and each surface hand-copied a subset of it into a menu.

Nothing downstream ever needed the enum. The column is `VarChar(20)` and
`netTermsDays()` in `@wizeworks/crm` has always parsed whatever digits it finds
(`"net30"`, `"net 15"`, `"due on receipt"`), so **every `netN` already worked end
to end.** The only things in the way were one zod enum and three menus.

## The fix

**The schema describes a shape, not a list:**

```ts
export const PaymentTerms = z
  .string()
  .regex(/^(prepay|net(?:[1-9]|[1-9]\d|[12]\d\d|3[0-5]\d|36[0-5]))$/, '…');
```

1–365 days. The bound is a typo guard — a year of credit is a mistake, and a
four-digit day count is a due date in 2031.

**One source for the words and the presets** — `lib/payment-terms.ts`, with
`paymentTermsLabel()` **derived** rather than looked up, so any agreed number of
days reads as itself. A lookup that falls through to "No terms set" is the exact
bug this file exists to stop. All three copies now import it.

**One control** — `PaymentTermsField`. Presets first (prepay, 7, 14, 15, 30, 45,
60, 90) so the usual case stays one click, then **"A different number of days…"**,
which reveals a days box. It opens ALREADY OPEN on a company whose stored terms
are not a preset — otherwise editing anything else on the form would silently
re-round their agreement to the nearest option.

Choosing "a different number" writes nothing until a number is typed: nothing has
been agreed yet, and `net0` would record "due immediately".

## Confirmed

Ferrous Coffee Bar and The Reading Room both saved on **14 days to pay**, and the
Companies list's Terms column reads it back. The B2B trade pane now shows the same
words for the same record.

## Found alongside

Both cafés were unrecordable for a second reason at the same moment: no dropdown
in the console could be clicked at all
([047](047-every-dropdown-in-the-console-ignored-the-mouse.md)). Two independent
blockers standing between a bakery and a payment term.
