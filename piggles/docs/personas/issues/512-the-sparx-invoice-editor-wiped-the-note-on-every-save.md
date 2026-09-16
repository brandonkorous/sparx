# 512 — The sparx invoice editor wiped the customer's note on every save

**Status:** both halves fixed and proven
**Severity:** major
**Found by:** porting [507](507-undo-your-edits-and-it-still-says-unsaved.md) to
the sparx console, where the same patch would not apply
**Surface:** invoice editor, sparx console only
**Filed:** 2026-09-14

## How it was found

The 507 fix went into both consoles' invoice editors. It matched in Piggles and
failed in sparx, on a block Piggles had already rewritten. Reading why turned up
a live defect that had nothing to do with 507.

## What is wrong

The sparx editor seeded its notes box from a hardcoded empty string:

```ts
taxRate: doc.taxRate,
notes: '',
lines,
```

and its save sends the box back over whatever is stored:

```ts
notes: header.notes || null,
```

So on sparx: **a note written on an invoice, saved, disappears the moment the
pane reloads, and the next save deletes it from the record.** Both saves report
success. The note is the text the customer reads on the document itself, which
`billing-document-html` renders under a "Notes" heading, so the loss is visible
to the person being billed and to nobody on this side of the screen.

The typecheck error that exposed it was the whole story:

```
invoice-editor.tsx(174,18): Property 'notes' does not exist on type 'BillingDocument'
```

The console's own type never modeled the field. The server stores it, returns
it, and accepts it; only sparx's copy of the interface had a hole where it
should be. This is [[feedback_absent_behaves_like_fine]] exactly: a missing
field renders identically to an empty one.

Piggles hit the same defect and fixed it, and the comment it left behind reads
like a note to whoever came next:

> It used to be hardcoded to `''`, which made the box look empty on every load
> AND wiped the stored note on the next save.

The neighbour was never brought along.

## What changed

`notes: string | null` added to sparx's `BillingDocument`, and the editor seeds
from `doc.notes ?? ''` like its twin. One field and one line, but the field was
the reason the line could not be written.

## The second half, also fixed

The same comparison turned up a second gap, a missing capability rather than a
data loss: **sparx had no way to SET an invoice's due date.** Piggles carries
`dueAt` through the draft, the form and the save body, with the reason spelled
out:

> Midday UTC, not midnight: a due date is a DAY, and midnight lands on the day
> before for anyone west of UTC, so the invoice would read as due a day early
> for them and go late a day early with it.

Sparx had `dueAt` on the document type and showed it read-only ("No due date",
"Was due Sep 7"), while its `DraftShape`, its form and its `headerBody` had no
due date at all. So a sparx operator could see that an invoice was overdue and
could not say when it was due.

Its receivables list has a Due column, an overdue tone and day-counting
phrasing, all reading `dueAt`, and nothing anywhere could set it. The date
arrived only when a document was ADVANCED into a payable stage, so an invoice
raised straight into one never got a date and could never be chased.

Ported into all four places Piggles has it: the draft shape, the seed, the form
field, and the save body with the midday rule intact.

**Proven on screen.** INV-000005 in the sparx console now shows "When it should
be paid" with the empty-state sentence under it. Setting 15 October 2026 and
saving stored:

```
due_at = 2026-10-15 12:00:00+00
```

Midday UTC, not midnight, so the date survives a reader west of UTC. That is the
rule this was filed rather than swept for, and it is the reason: a careless copy
would have stored midnight and made every invoice read as due a day early for
half the world.

## Worth keeping in mind

Both halves were found by a TYPE ERROR while porting an unrelated fix, not by
looking for them. A console-parity check exists and passes, because it compares
which SURFACES the two consoles carry, not what those surfaces can do.
