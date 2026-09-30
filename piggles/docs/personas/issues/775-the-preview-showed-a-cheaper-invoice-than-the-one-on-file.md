# 775 — The preview showed a cheaper invoice than the one on file

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 274
**Surface:** mypiggles + sparx workbench — `invoicing.invoice.preview`
**Filed:** 2026-09-22
**Blocked on:** —

## What happened

Opening INV-000009 in the editor and pressing **Preview**, the document read:

```
Subtotal      $42.00
Total         $42.00
Balance due   $42.00
Issued        Sep 22, 2026
(no Ship to block)
```

The invoice on file is:

```
Subtotal      $42.00
Shipping       $9.00
Total         $51.00
Balance due   $51.00
Issued        Sep 8, 2026
Ship to       Rowan Ellery, 18 Larkspur Lane, Portland, OR 97214, US
```

Same pane, same invoice, same moment. The only difference was whether the
editor was open beside it. Closing the editor and leaving the preview alone
made all four differences go away.

So the pane whose entire job is "this is what they will get" was showing a
different, cheaper document, and the editor being open was what caused it.

## Why

The preview renders from the payload the editor publishes, **and from nothing
else**. It is not a patch over the saved document and the renderer never
re-reads the database, so a field left out of that payload is not "unchanged" —
it is ABSENT, and the renderer fills it with its own default. The default is
silence.

The payload carried the fields being TYPED, plus four identity facts. Left out:
`shipTo`, `shippingTotal`, `surchargeTotal`, `depositTotal`, and the issue date.

Across the 106 documents on the account:

| left out         | documents it changes |
| ---------------- | -------------------- |
| `shipTo`         | 14                   |
| `shippingTotal`  | 6                    |
| `depositTotal`   | 4                    |
| the issue date   | 54                   |
| `surchargeTotal` | 0 today              |

## This is the second time

Issue **764** was exactly this: the payload carried only the typed fields, so
every preview fell through to a numberless "Invoice" marked Unpaid with a
balance due — over a paid invoice, and over a quote nobody had agreed to. It was
fixed by adding the number, the status, the stage and the workflow.

It added four fields. It did not change the shape that let four be missing in
the first place, so the next five stayed missing.
[[feedback_a_fix_leaves_its_neighbour_behind]]

Nothing could catch it: typecheck, lint and 1,185 tests pass on an object
literal inside a `useEffect`, because a key that is not there is not a type
error when the receiving schema marks everything optional.

## What was done

**The payload is now a function with a test.** `previewDraft()` in
`surfaces/invoicing/preview-draft.ts` takes what is being typed and what is on
file and returns the whole thing, under one rule stated at the top of the file:
a field the person is TYPING comes from the draft, a field the DOCUMENT holds
comes from the document, and nothing comes from neither.

`preview-draft.test.ts` pins the contract in a list named
`CARRIED_FROM_THE_DOCUMENT`, so a field the renderer reads that stops being
published reddens a test rather than quietly changing a document.

Two fields also had to be added to the console's own `BillingDocument` type
before they could be carried: `depositTotal` and `finalizedAt`. `depositTotal`
joined `normalizeDocument` at the same time, since Prisma sends every Decimal
over the wire as a string and a money field left out of that list is typed
`number` while holding `"30.00"`.

## Proof

Measured on INV-000009 with the editor open, before and after:

```
before   Total $42.00   Balance due $42.00   Issued Sep 22, 2026   no Ship to
after    Total $51.00   Balance due $51.00   Issued Sep  8, 2026   Ship to set
```

The "after" row is identical to what the pane draws with no editor open, which
is the saved document.

9 assertions, **6 watched going red** with the five carried facts removed.
[[feedback_a_test_that_cannot_go_red]]

## Files

- `piggles|sparx/apps/workbench/surfaces/invoicing/preview-draft.ts` (new)
- `piggles|sparx/apps/workbench/surfaces/invoicing/preview-draft.test.ts` (new)
- `piggles|sparx/apps/workbench/surfaces/invoicing/invoice-editor.tsx`
- `piggles|sparx/apps/workbench/surfaces/invoicing/types.ts`

## What was checked and was fine

**Saving does not erase the ship-to.** The editor never sends `shipTo`, and the
update writes it only when the key is present, so the stored value survives a
save. The damage was confined to what was drawn.

**The editor's own running total was already right.** It reads `shippingTotal`
and `surchargeTotal` from the document (issue 442) and takes the balance from
the server, and it even says "Not saved yet: $51.00 is what the customer would
see today" while a change is pending. The summary and the preview disagreed, and
the summary was the one telling the truth.
