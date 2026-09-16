# 511 — Querying an invoice was a one-way door with no record of why

**Status:** fixed and proven
**Severity:** major
**Found by:** Devi, querying a duplicate invoice and then reading the screen she was left on
**Surface:** supplier bill detail + the bill service, both consoles
**Filed:** 2026-09-14

## How it was found

Not by looking for it. Fixing [510](510-a-partial-invoice-reads-as-a-disagreement.md)
needed a proof that the match still catches a real overcharge, so Ashcombe Mills
invoiced the same 38-metre drop twice. The check caught it. Devi queried it, as
anyone would, and the screen she was left on was wrong in three ways.

## What she saw

After querying, the pane still read:

> **Before this can be approved**
> 1 line does not agree with what was ordered and received. Either accept the
> difference, which is recorded against your name, or query it with the
> supplier, which stops it being paid.
>
> **Why** _[empty]_
>
> Required either way. **An override that leaves no trace looks exactly like
> nobody noticing.**
>
> [Accept the difference] [Query it with them]

She had just queried it. The reason she typed was gone from the box and appeared
nowhere else on the pane. The card offered her the same two choices again as
though nothing had happened.

Measured, to be sure it was not simply scrolled out of view:

```
pane scrollHeight 908 · clientHeight 908      (nothing hidden)
document.body.innerText.includes('same 38 metres')  →  false
notes column in the database                  →  the full sentence, intact
```

**Written, and read back nowhere.** Accepting a difference DOES display its
reason, in an alert above the table. Querying had no equivalent. Same card, same
promise, one of the two branches honoured.

## The worse two

**There was no way back.** The only transitions in the whole service are
`draft → approved`, `→ disputed`, `→ paid`, `→ cancelled`. Approving refuses on
`disputed`; recording a payment refuses on `disputed`. So the ordinary ending of
a query — the supplier answers and the matter is settled — had nowhere to go.
The only exit was to cancel an invoice that still exists.

**And the other button was a trap.** `acceptBillVariance` refused only on `paid`
and `cancelled`. From a queried bill it would have written its reason over the
query's reason, stamped the variance accepted, and left the status on
`disputed` — after which approve and pay both refuse and the bill is stranded,
with the record of why it was queried destroyed.

## What changed

**The trace.** A queried bill now shows why, in its own alert, the way an
accepted variance always did.

> **This is out with the supplier**
> This is the same 38 metres as AM-2198. Rang Ellen, she is raising a credit note.

**The way back.** `settleBillQuery` returns a disputed bill to `draft`, audited
as `query_settled`. No note is asked for, because the reason it was QUERIED is
the thing worth keeping and a second sentence would overwrite it.

**The card knows what she did.**

> **While it is with the supplier**
> Nothing will be paid against this invoice while it is queried. Settle the
> query once the supplier has answered. If they send a credit note or a new
> invoice, cancel this one and enter theirs instead. If they say this one was
> right, settle it and then accept the difference.
>
> [The query is settled]

**Accepting is refused while it is out with them**, naming the order that works:
settle the query first.

## One I wrote myself, twice

The first version of that card said:

> When the supplier has answered **—** a credit note, a corrected invoice, or a
> reason it was right after all **—** settle the query and **the figures can be
> put right off their new paper**.

Two faults in one sentence. Em-dashes in shipped copy, against a standing rule.
And a promise the product cannot keep: `UpdateSupplierBillInput` takes number,
dates, tax, freight and notes, and **no lines**. A bill's figures cannot be
changed after entry, anywhere.

That turned out to be correct, not a gap. A supplier's invoice is a copy of a
piece of paper, and a corrected invoice is a different piece of paper with a
different number on it. So the sentence was wrong, not the product, and it was
rewritten to name the three endings that actually exist: cancel and enter
theirs, or settle and accept.

## Also noted, not fixed here

`notes` on a supplier bill is a single general field, and both accepting and
querying write their reason into it. In the shipped consoles nothing else ever
writes it — neither bill-entry form offers a note — so no collision can happen
today. The API allows one.

## Proven

|                                        |                                           |
| -------------------------------------- | ----------------------------------------- |
| queried bill shows its reason          | yes, in its own alert                     |
| card offers accept/query while queried | no                                        |
| accept while queried                   | refused by the service                    |
| settle → status                        | `draft`, toast "AM-2231 is back with you" |
| settled bill offers accept/query again | yes                                       |

## One my own fix caused, caught the same way

Querying AM-2231 made the CORRECT invoice on that order, AM-2214, read as
over-billed:

> **1 line(s) do not agree** · $36.00 more than the goods justify
> arrived 40 · **76 on other invoices** · billed 2 · **Billed for more than arrived**

[510](510-a-partial-invoice-reads-as-a-disagreement.md)'s new sum of the other
invoices excluded only `cancelled`. A queried bill still consumed the quantity
it was charging for, so disputing a duplicate pushed the total to 76 against the
40 that arrived and turned the one honest invoice into a finding.

Which is the exact opposite of what querying is for. A bill nobody is going to
pay as it stands consumes nothing, so `disputed` is excluded alongside
`cancelled`. AM-2214 now reads **38 on other invoices · Agrees**, and 38 + 2 is
the 40 that arrived.

Found by opening the other invoice and looking at it. Every test was green,
both consoles typechecked, both linted, and the parity check passed.

## Proven red

| break                                           | test that reddens                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| a queried bill counts as already invoiced again | stops a queried invoice from counting against the correct one            |
| accepting while queried is allowed again        | will not accept a difference on an invoice that is out with the supplier |

Suites after: inventory **366** (6 new, 4 of them DB-backed against the real
schema), commerce-schemas 463, piggles workbench 232, sparx workbench 157.
