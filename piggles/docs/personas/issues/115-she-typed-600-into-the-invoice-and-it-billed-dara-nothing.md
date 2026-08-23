# 115 — She typed 600 into the invoice and it billed Dara nothing

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 8
**Surface:** mypiggles › Invoices › New invoice › Add a line
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Nia raised an invoice for Dara's chair rent. She clicked **Add a line**, chose
type **Fee**, typed "Chair rent, September 2026", and the numbers row appeared:

> **Qty** · **Unit price** · **Cost** · **Discount**

She typed `600` into **Cost** — the word a hairdresser reads as "what this
costs" — and pressed Add line. The line landed on the invoice as:

> Chair rent, September 2026 · Qty 1 · Unit price 0.00 · Amount **$0.00**

The six hundred dollars was gone. The invoice's line table has no Cost column, so
the number she had just typed was nowhere on the screen. The Summary read
Subtotal $0.00, Total $0.00. Nothing warned her, and a $0.00 invoice can be saved
and sent.

The Summary also asked for the tax rate **"As a decimal — 0.0875 is 8.75%"**,
which is a request to divide by a hundred in your head, put to somebody who came
here to send an invoice.

## What should have happened

Two money boxes side by side, one of which bills the customer and one of which
does not, must each say which they are. And the tax rate should be asked for in
the units everybody knows theirs in.

The design was coherent for a trade contractor invoicing materials — `Cost` feeds
markup, `Unit price` is charged. It is not coherent for anybody else, and Piggles
is written for people with no trade-pricing vocabulary at all
([RULE #3](../../../CLAUDE.md), the non-technical audience rule).

## How to reproduce

1. Invoices › New invoice, pick a customer, **Add a line**.
2. Type a description and put `600` in **Cost**. Add line.
3. Every time: the line reads $0.00 and the 600 is not shown anywhere.

## Why it matters

Wrong money, and the customer sees it. An invoice for $0.00 goes out under her
name; she finds out when the rent does not arrive.

## Where it lives

- [surfaces/invoicing/line-editor-modal.tsx](../../../apps/workbench/surfaces/invoicing/line-editor-modal.tsx) — the numbers row
- [surfaces/invoicing/invoice-summary.tsx](../../../apps/workbench/surfaces/invoicing/invoice-summary.tsx) — the tax rate

## The fix

**One number, one name, and both boxes explain themselves.**

- `Unit price` → **Price each**, described as _"What they are charged."_
- `Cost` → **Cost to you**, described as _"Optional, and never shown to them. It
  is how you see your margin."_ (and, in markup mode, _"What it cost you. The
  price is worked out from this."_)
- The line-item row heading and the markup preview were both called "Unit price";
  all three now say **Price each**, so the field and the column that shows it
  cannot read as different numbers.
- The tax rate is asked for **out of a hundred** and converted on the way in, so
  8.75 means 8.75%.

The numbers row moved to its own file
([line-editor-numbers.tsx](../../../apps/workbench/surfaces/invoicing/line-editor-numbers.tsx)),
and the row's shape and badges to
[line-row-parts.tsx](../../../apps/workbench/surfaces/invoicing/line-row-parts.tsx),
per piggles RULE #0.5. Two badges naming `neutral` became colourless while those
lines were being moved (root RULE #4).

Not fixed here, and worth its own decision: nothing stops a document totalling
$0.00 from being sent.

## Confirmed by

> Re-ran P02 act 8 as Nia. Opened INV-000001's line: the boxes now read
> **Price each** (600.00) with "What they are charged." under it, and **Cost to
> you** (0.00) with "Optional, and never shown to them." The Summary reads "Out
> of a hundred — type 8.75 for eight and three-quarter percent", the column
> heading reads Price each, and the invoice still totals $600.00.

## Rating effect

`Invoices › Invoice editor — Ease 6 → 8`. Recorded in [rating.md](../rating.md).
