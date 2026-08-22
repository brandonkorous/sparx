# 051 — Nothing she invoiced was ever due

**Status:** fixed
**Severity:** **blocker** (no invoice on the default workflow could ever fall due, be chased, or age)
**Found by:** P01 · Thistle & Rye · act 10 — Money › Owed to you
**Surface:** mypiggles › Money › Owed to you, and every invoice list
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 10 — INV-000003 came out **Due Sep 4, 2026**, 14 days out

## What happened

Marisol agreed **Net 14** with both cafés and recorded it on both companies
([048](048-the-terms-she-agreed-with-her-cafes-were-not-on-the-list.md)). She
raised the month-end invoice, sent it, took $200 on account, and opened Money to
see what she was owed:

| Invoice    | Customer           | How late        | Due   | Balance |
| ---------- | ------------------ | --------------- | ----- | ------- |
| INV-000001 | Ferrous Coffee Bar | **Not yet due** | **—** | $424.00 |

**Due: —.** And beside it, a claim that it is not yet due.

## Why it matters

A due date is the entire mechanism of getting paid. Without one an invoice:

- can never become late, so it never appears under **Late**;
- lands in the `current` aging bucket for ever, so "what am I owed and how old is
  it" is answerable only as one undifferentiated number;
- is never chased by anything, ever.

She would find out Ferrous had not paid when she noticed, personally, weeks later.

And the screen says **"Not yet due"** about it — a claim about a deadline that
does not exist. Nobody has established when this money stops being fine, and the
software reports that it is fine. That is absence rendered as a measurement, on
money somebody owes her.

## Why it happened — two independent breaks in one chain

**1. The rule only ran for a stage type the default workflow does not have.**

The due-date derivation lived inside the `finalize` block:

```ts
const enteringFinal = stage.stageType === 'final' && document.finalizedAt === null;
if (enteringFinal) {
  data.finalizedAt = …;
  data.issuedBy   = …;
  if (document.companyId && document.dueAt === null) { …set dueAt… }
}
```

`finalizedAt` and `issuedBy` genuinely are facts about finalizing. **A due date is
not.** And `DEFAULT_DOCUMENT_WORKFLOWS[0]` — the "Invoice" workflow every tenant
starts on, `isDefault: true` — has stages **`open` → `paid`**. There is no `final`
stage in it, and there never will be.

So for the default workflow, on every tenant, the rule was unreachable code.

**2. Even in a workflow that has one, the terms could not be found.**

It read `document.companyId`, and nothing in the console sets it. An invoice is
raised against a **person** — the customer picker writes `customerId` and the
create service takes `companyId` only from its input, which the console never
sends. So a bakery invoicing the buyer at a café she has on terms produced a
document with no company at all.

## The fix

**The due date is set on becoming PAYABLE, not on being finalized** — a stage
whose type is `open` or `final`. Both mean the same thing to the customer: here
is the bill. Guarded by `dueAt === null`, so a date set by hand or on an earlier
entry is never overwritten.

**The terms follow the payer's EMPLOYER.** When the document itself names no
company, it resolves the customer's. This is the rule the company screen already
states in its own words:

> Everything billed to this company **or to anyone who works here**, newest
> first — because a contact's unpaid invoice is still this company's debt.

**And "no due date" no longer reads as "not yet due".** `overdueDays` is 0 for
both, which is exactly why they have to be told apart at the point of display:

|                        | before          | after                        |
| ---------------------- | --------------- | ---------------------------- |
| on terms, not yet late | Not yet due     | Not yet due                  |
| no date agreed         | **Not yet due** | **No date agreed** (warning) |

## Confirmed

Linked Ines Marchetti to The Reading Room, raised INV-000003 on 21 August:

> **Due Sep 4, 2026**

Exactly the fourteen days she agreed. INV-000001 and INV-000002 still read
"No date agreed" — correctly: they were issued before the fix and the rule never
overwrites a document's existing date, so nothing rewrote history.

## The other half of the chain, found on the way

Nothing links a contact to a company automatically. The company card promises it:

> add this company's email domains above and new arrivals will be offered it
> automatically

`ferrouscoffee.test` was on the company before Dane was created with
`dane@ferrouscoffee.test`, and nothing offered anything. The **Wholesale account**
select that does the real linking sits on the customer's _Details_ tab, several
scrolls from the free-text **Company** box on the create form that looks like it
does the same job. Filed as an observation on the persona run, not fixed here:
what "offered" should look like is a design decision.
