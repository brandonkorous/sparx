# 049 — Everything she wrote on an invoice was thrown away when she saved it

**Status:** fixed
**Severity:** major (a field promising to reach the customer silently kept nothing)
**Found by:** P01 · Thistle & Rye · act 10 — the month-end invoice to Ferrous Coffee Bar
**Surface:** mypiggles › Invoices › the invoice editor, "Notes"
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 10 — the note survived a save and a reload

## What happened

Marisol wrote what the invoice was for:

> August standing order: four weeks. 12 sourdough, 6 rye, each week.

and hit Save. The status line said **Saved just now**. The box was empty.

She typed it again. Saved again. Empty again.

## Why it matters

The field's own help text is **"Shown on the invoice the customer receives"**, and
the placeholder invites exactly what she wrote: _"Payment terms, a thank you,
anything the customer should read."_ It is the one place on the document where a
business explains the charge — which four weeks, which order, what the delivery
reference was.

She would have sent an invoice believing that explanation was on it. Reading a
bare list of quantities, a café's bookkeeper queries the bill.

And the failure is the worst kind: **the save reports success.** There is no
error to notice and nothing to retry.

## Why it happened

Two halves that only bite together.

The editor seeds its form from the loaded document, and for this one field it
seeded a constant:

```ts
notes: '',   // ← every load, regardless of what the document holds
```

because **`notes` was missing from the console's `BillingDocument` interface** —
the field it needed did not exist in the type, so the value was hardcoded.

The write was fine. `headerBody()` sends `notes: header.notes || null`, and the
server stored it. So the note WAS saved — it was simply never read back, the box
always looked empty, and **the next save sent `null` and wiped it.**

## A comment that would have sent the fix the wrong way

The schema said the opposite of the truth:

```ts
notes: …,
// Customer-visible note — `notes` above stays staff-internal (mirrors the
// retired Quote model's internal/customer note split).
customerNote: …,
```

But `billing-document-html` renders **`notes`** under a "Notes" heading, and
`billing-snapshot` freezes `notes`. `customerNote` on a billing document is
written by nothing and rendered by nowhere — inherited from the retired Quote
model, where it is still live on Order, Return and Quote.

Two of the three agree that `notes` is what the customer reads. Following the
comment would have moved her note somewhere no customer can see, so the comment
is corrected too.

## The fix

- `notes: string | null` added to the console's `BillingDocument`.
- The editor seeds `notes: doc.notes ?? ''`.
- The stale schema comment now says which field is printed and that
  `customerNote` is inert **on this model**.

## Confirmed

Typed the note, saved, reloaded the pane: still there. Edited it, saved again:
the edit stuck. It is now on the invoice the customer receives — see
[050](050-she-could-make-an-invoice-and-had-no-way-to-give-it-to-anyone.md),
where the note is part of the email.
