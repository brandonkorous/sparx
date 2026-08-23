# 121 — Rent is due every month and the invoice can only be raised once

**Status:** open
**Severity:** minor
**Found by:** P02 · Halo & Hem · act 8
**Surface:** mypiggles › Invoices › New invoice
**Filed:** 2026-08-22
**Fixed:** —
**Confirmed by:** —
**Blocked on:** scope — a repeating charge is a feature, not a repair.

## What happened

Dara rents a chair for **$600 a month**. Nia raised INV-000001 for September and
looked for the place to say "and every month after that". There is no such
control anywhere on the invoice: document type, customer, due date, billing name
and address, line items, notes. That is the whole editor.

So she wrote it into the note instead — "Chair rent is due on the first of each
month" — which tells Dara but tells the product nothing. In October she will
re-key the same invoice from scratch, and in November again.

Money has **Repeating costs** for money going out. There is no counterpart under
Money coming in.

## What should have happened

A charge that repeats should be sayable once. It is the single most common shape
of B2B-ish income a small business has: rent, a retainer, a maintenance
agreement, a chair.

## How to reproduce

1. Invoices › New invoice. Every time: nothing about repetition.
2. Money › Money coming in. Every time: no repeating-income equivalent to
   "Repeating costs".

## Why it matters

She retypes it twelve times a year and one of those times she will forget. It is
not wrong money today; it is money that quietly stops being asked for.

## Where it lives

- [surfaces/invoicing/invoice-editor.tsx](../../../apps/workbench/surfaces/invoicing/invoice-editor.tsx)
- [surfaces/finance/recurring-costs.tsx](../../../apps/workbench/surfaces/finance/recurring-costs.tsx) — the shape that exists for the other direction

## Worth checking before building anything

Commerce has subscriptions (`commerce_subscriptions`, and a Subscriptions
surface), which is a recurring charge against a product on a schedule. Whether a
repeating invoice is that machinery pointed at a billing document, or a
`recurring` field on the document itself, is the first question — and this repo's
habit is that the capability usually already exists somewhere and has simply
never been surfaced.
