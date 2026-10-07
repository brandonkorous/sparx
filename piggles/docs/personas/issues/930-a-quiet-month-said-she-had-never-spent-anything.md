# 930 — A quiet month said she had never spent anything

**Status:** fixed (act 325)
**Severity:** major
**Found by:** P03 · Juniper Row · act 325, re-scoring Spending
**Surface:** mypiggles › Spending and Bills to pay (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row · act 325, an empty October offering September, a cost recorded as paid, and three market buys marked paid from a table that fits
**Blocked on:** —

## What happened

Devi opened Spending on October 6. It opens on This month. Her five costs were
all in September, so the list was empty, and it said **"Nothing recorded yet"**
with "Record what the business pays for (parts, wages, rent, software, fuel)".
Those are the words for a business that has never recorded a cost. The natural
answer is to type September in again.

Three more came out with it.

1. **The quick row recorded every cost as unpaid.** Its comment says it is for
   "a shoebox of receipts", and the empty state sends her to it "for a quick
   one". A receipt is proof of payment. Her horn buttons from the Saturday
   market, paid in cash, sat on Bills to pay as unpaid. Issue 465 stopped Bills
   to pay from adding those into what she owes; nothing asked whether they were
   paid.
2. **Bills to pay did not fit its own card.** At an ordinary window the table
   was 832px in a 766px card. The bill's name was a `truncate` cell, which
   asks for its whole text as the column's width (Spending fixed the same thing
   long ago). Clicking a row's button scrolled the names off the left edge:
   "ent, September", "nd cotton from A...".
3. **Its pay button said only "Paid"**, which reads as the bill's state. On a
   narrow pane the word folds away and the button had no name at all.

## The fix

- **Spending** (both consoles): an empty period on a business with costs says
  so. "Nothing recorded this month. Your last cost was Sep 16, 2026: Horn
  buttons from the Saturday market, $12.50." with **Show last month**, the
  shortest period that holds it (`spending-quiet.ts`). "Nothing recorded yet"
  is kept for a business with no costs at all, and is never shown while the
  newest cost is still loading. Its examples are now "materials, rent, wages,
  software".
- **The quick row** has a **Paid** tick, on by default. It stays as she left it,
  like the category. The toast says "Cost recorded as paid" or "as not yet
  paid".
- **Where from** is shown on Spending only when some cost came from somewhere
  other than her own typing. On her account it was an empty column.
- **Bills to pay**: the name wraps to two lines; the due day sits under "35
  days late" instead of a column of its own. The table is now 766px in 766px.
  The button reads **Mark paid** and is named "Mark Shop rent, September as
  paid" for a screen reader. The note under the total says the costs "were not
  marked paid when they were recorded".
- Three `color="neutral"` buttons on Spending are now colorless (RULE #4).

## Not changed

- A toast sits in the bottom right and pauses while the pointer is over it.
  After **Mark paid** on the last row the pointer is exactly there, so the
  toast stays and covers the next row's button until the mouse moves. That is
  the console's toaster (`components/console-shell.tsx`), which another session
  is editing. Filed here so it is not lost.

## Proof

- `spending-quiet.test.ts` (both consoles): six cases. Red when an unloaded
  newest cost is treated as none, and when the period showing can be offered
  again.
- On screen, as Devi:
  - October read "Nothing recorded this month" with the horn buttons line;
    **Show last month** showed $2,158.70 across 5 costs.
  - **Padded mailers from the post office**, $18.40, Packaging & gift wrap,
    with Paid left ticked, saved as Paid (in the database too). No Where from
    column.
  - On Bills to pay she marked the horn buttons, the chalk and pins, and the
    thread and buttons paid. The linen from Ashcombe Mills she left unpaid. The
    table measured 766px in its 766px card.
- The sparx console's half is typechecked and tested, not driven.
