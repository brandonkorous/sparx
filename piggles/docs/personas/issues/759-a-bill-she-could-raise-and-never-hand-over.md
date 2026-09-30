# 759 — A bill she could raise and never hand over

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 268
**Surface:** mypiggles + sparx workbench — one wholesale invoice (`b2b.invoice.detail`)
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, on screen, with the printed document opened
**Blocked on:** —

## What happened

INV-000012, $120 to Loom and Larder for stand hire at the autumn market. The
screen offers:

```
[ Owed ]                                                          [ Save ]

  The money       Invoiced $120.00 · Still owed $120.00
  Terms           Due date · Note
  The business    Loom and Larder          [ Open account ]

  [ Mark as paid ]                                      [ Write off ]
```

She can raise it, chase it, mark it paid and write it off. **She cannot give it
to the customer.** No send, no print, no PDF, no payment link, nothing to
attach to an email. The whole point of an invoice is the one thing missing.

MEASURED: `grep -n "Send\|pdf\|Print\|payment-link"` over the surface returns
**nothing**.

## The odd part

It is the same document as the one on the Invoices screen, which has all three.
`createInvoice` says so in its own header: a B2B receivable is a
`BillingDocument` on the system `net-terms-ar` workflow, and the id in this
pane's URL is that document's id. `/v1/invoicing/documents/:id/send`, `/pdf` and
`/payment-link` all answer for it already. Two lenses on one record, and only
one of them could do anything with it. [[feedback_a_fix_leaves_its_neighbour_behind]]

## What was done

Two actions on the toolbar, both against the endpoints that already existed:

**Print or save as PDF** needs only the id, so it lives here. Read on screen
2026-09-20: it opened a document titled **Invoice INV-000012**.

**Open the full bill** opens the same id on the Invoices screen, where the send
flow already lives. That flow reads `billTo.email`, `metadata.sentAt` and the
document's lines, none of which the wholesale projection carries — so a second
copy of it here would be a second copy to keep in step, and the first thing to
drift would be the sentence that tells her who the email is going to. One
document, one send. [[feedback_silicaui_single_point_of_change]]

## And the pane never said which bill it was

The number was on the TAB and nowhere in the pane. A pane can be popped into a
window of its own, and the tab strip scrolls — so the one thing she and her
customer both quote was the one thing that could leave the screen. It now
carries `Invoice INV-000012` as its heading, which is what sparx has done since
it was written, and what the house rule says a transaction detail does.

## Files

- `piggles|sparx/apps/workbench/surfaces/b2b/invoice-detail.tsx`

## Proof

Read on screen 2026-09-20: both actions draw with their words in the toolbar,
and Print opened a tab titled `Invoice INV-000012` — the right document, through
the endpoint this pane had never called.

`check:toolbar-glyph` (681 toolbars, 622 buttons, every one with a word on it)
and `check:toolbars` both stay green with the new actions, because they are
declared as `actions` values rather than bespoke `controls`: that is what makes
them fold into the overflow popover carrying their labels rather than collapsing
to bare icons on a narrow pane.

At 360px the pane's own column measures `scrollWidth === clientWidth === 343`
with **zero** overflowing elements. Dark holds.
