# 065 — Her invoices were labelled in the database's words

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Thistle & Rye · standing checks
**Surface:** mypiggles › Money › Invoices, and the same chip on a customer and a company
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P01 · Marisol · on screen 2026-08-21

## What happened

The invoice list showed a status chip on every row reading **`unpaid`** — lower
case, the column value, straight out of Postgres. A part-paid invoice read
**`partial`**. The colour beside the word was already right: `unpaid` came up
amber, `partial` blue, `paid` green. So the pane had worked out what the row
_meant_ and then printed what the database _called_ it.

The filter above the list said **"Unpaid"**, so filtering for Unpaid returned
rows labelled `unpaid`, and there was no way to tell whether that was the same
thing or a coincidence of spelling.

The wholesale invoice list, two clicks away, had the words the whole time:
**Owed**, **Part paid**, **Overdue 6 days**, **Written off**.

## What should have happened

The chip says what the invoice is doing, in her words, the way the wholesale one
already did. Non-technical audience is a CORE rule: a business owner should never
have to learn that `partial` is this product's word for _part paid_.

## How to reproduce

1. Sign in as `p01.marisol@piggles.test`, open **Money › Invoices**.
2. Look at the Status column on any unpaid row. Every time.
3. Open **Customers › a company › Invoices** — the same raw chip.

## Why it matters

It is the column a person scans to answer "who still owes me". Reading it in the
API's vocabulary is a small, constant tax on the one screen about money owed —
and it is the tell that two panes for the same records were written twice.

## Where it lives

- [surfaces/invoicing/invoice-list.tsx](../../../apps/workbench/surfaces/invoicing/invoice-list.tsx) — the chip, and `STATUS_FILTERS`
- [surfaces/crm/company-detail.tsx](../../../apps/workbench/surfaces/crm/company-detail.tsx), [surfaces/crm/customer-related.tsx](../../../apps/workbench/surfaces/crm/customer-related.tsx) — two more copies of the same raw chip
- [surfaces/invoicing/types.ts](../../../apps/workbench/surfaces/invoicing/types.ts) `statusTone` — the tone, with no label beside it
- [surfaces/b2b/invoices-data.ts](../../../apps/workbench/surfaces/b2b/invoices-data.ts) `invoiceState` — the words, in the other pane

## The fix

The two panes carried the same five-value union under two names (`ArStatus`,
`InvoiceStatus`) and had drifted, so the fix is one module rather than a second
copy of the words: **[lib/invoice-status.ts](../../../apps/workbench/lib/invoice-status.ts)**
owns the union, the tone and the label together, and both panes re-export from it.
Label and tone come back from one call, so they cannot drift apart again.

Two decisions inside it:

- **`overdueDays` is optional.** Only the wholesale projection counts them. Where
  it knows, the badge says _Late by 6 days_ — the thing somebody chasing money
  needs; where it does not, "Late" is the whole truth available, and inventing a
  day count would be worse than none (RULE #4 of the persona rules).
- **`void` returns no colour at all**, not `'neutral'`. A written-off invoice is
  a real outcome carrying no semantic tone, and a colourless badge resolves to
  base ink in both themes — where `color="neutral"` is a choice that needs
  Brandon's approval every time (root RULE #4). The badge drops `variant` with
  it, since a variant is how a colour is applied and there is no colour.

`STATUS_FILTERS` now takes its words from the same function, so the filter and
the rows say the same thing.

Checked the siblings: three call sites rendered the raw value (invoicing list,
company detail, customer detail), and all three now go through `invoiceState`.

## Confirmed by

Re-run as Marisol on 2026-08-21, Money › Invoices. The Status column reads
**Owed**, **Owed**, **Part paid** — not `unpaid` / `partial` — and the badge
classes resolve to `badge-warning badge-soft` and `badge-info badge-soft`, so the
tone the pane had already worked out now has the matching word beside it.

The filter above the rows reads **All · Owed · Late · Part paid · Paid**, the same
vocabulary as the chips, so filtering for Owed and reading back "Owed" is now one
idea instead of two.

The same chip on Customers › a company › Invoices reads the same way.
