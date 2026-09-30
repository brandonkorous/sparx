# 857 — A quote is not money somebody owes you

**Status:** fixed
**Severity:** **major** — 39% of the figure her console gives as "what I am owed"
was money nobody owed, including one quote still in Draft that nobody has seen
**Found by:** P03 · act 301, opening Invoices because the nav said 9 things were
waiting
**Surface:** mypiggles › Invoices, Money › Receivables, and the B2B dashboard
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** her own pane, read from the live DOM before and after, and the
figure reconciled against the database both times

## What the screen said, and what she is owed

```
Outstanding   $3,911.70          ← the number she would use to decide
              16 open invoices      whether she can pay her own bills
```

Two of those 16 are quotes.

| document | what it is                | balance   |
| -------- | ------------------------- | --------- |
| Q-000016 | a B2B quote, **in Draft** | $1,008.00 |
| Q-000017 | a B2B quote, **accepted** | $504.00   |

$1,512.00 of $3,911.70. **Thirty-nine percent.** One of them is a price she has
not sent to anybody.

After:

```
Outstanding   $2,399.70
              14 open invoices
```

Platform-wide the same query moved **$67,279.83 over 86 documents** to
**$57,934.19 over 70** — $9,345.64 that nobody owed anybody, and every one of the
16 was on the quotes workflow.

## Why status could never answer this

The question was asked as:

```ts
status: { in: ['unpaid', 'partial', 'overdue'] }
```

`status` is the PAYMENT state, and it is derived from what has been paid.
`billing-ar.ts` says so in its opening paragraph:

> The document's status is PAYMENT-derived and independent of the workflow
> stage.

So a quote nobody has sent carries `unpaid` and a balance exactly like an
invoice, because nothing about the status machine knows what a quote is. Asking
that question and calling the answer "receivables" was never going to work; it
happened to look right because most documents are invoices.

## The rule already existed, with a guard against second copies

Issue **764** built it. Its own write-up opens with:

> Juniper Row Textiles LLC — INVOICE — Unpaid — **Balance due $504.00**
>
> A price she had not sent yet, printed as a bill for money nobody owed.

**$504.00 is Q-000017.** The same document, the same amount, the same shop. 764
fixed the page the customer receives. The figure on the owner's own screen kept
counting it for another month.

764 also listed the places that had to know a bill from an offer:

> four separate places had to know which was which: the print renderer, the
> unsaved-preview renderer, and each of the two consoles.

There was a fifth, and it was not on the list: **the query that adds the money
up.** [[feedback_a_fix_leaves_its_neighbour_behind]]

## Eight queries, one question

Every place that asked "is this owed" asked it as a payment status. Eight of
them, across four packages, each with its own copy:

| where                                  | what it drives                       | wrong today |
| -------------------------------------- | ------------------------------------ | ----------- |
| `billing-document-service.aging()`     | the Outstanding band on her invoices | **yes**     |
| `finance/receivables.ts`               | the Money receivables screen         | **yes**     |
| `b2b/reports.ts`                       | the B2B dashboard's "true AR"        | **yes**     |
| `b2b/invoices.ts`                      | lifting a credit hold                | **yes**     |
| `billing-document-service` (`pastDue`) | the late filter on the list          | latent      |
| `b2b-escalation-service`               | the dunning ladder                   | latent      |
| `automation-actions/resolvers.ts`      | the daily reminder scan              | latent      |
| `automation-actions/b2b.ts`            | the credit-hold scan                 | latent      |

The four marked latent are saved by a due-date clause, and only by accident: **no
quote or estimate on the platform carries a due date**, because an offer runs OUT
(`validUntil`) rather than falling DUE. Measured, 0 of 16. Two of them carried a
comment claiming they excluded drafts, which was a claim about status.
[[feedback_verify_capability_in_code_not_docs]]

All eight now ask through one exported `OWED_DOCUMENT_WHERE`.

**The credit-hold one matters in the other direction.** It counts open
receivables in order to LIFT a hold, so a counted quote keeps an account frozen:
a customer who had settled every invoice stayed unable to order because they had
accepted a quote nobody had billed yet.

## The sharpest one

`b2b/reports.ts` builds its dashboard in a single `Promise.all`. Six lines apart:

```ts
tx.billingDocument.count({                      // open quotes
  where: { workflow: { slug: B2B_QUOTE_WORKFLOW_SLUG },
           stage:    { stageType: OPEN_QUOTE_STAGE_TYPE } },
}),

// "…so the aging below reflects true outstanding AR."
tx.billingDocument.findMany({                   // money owed
  where: { companyId: { not: null },
           status: { in: ['unpaid', 'partial', 'overdue'] } },
}),
```

The same quote, counted once as an open quote and again as money owed, in one
statement, under a comment promising the second figure is true.

## Three clauses, each one a sentence the platform already prints

```
not a price offer   "nobody owes anything on a price they have not accepted"   (issue 764)
not a draft stage   "Nothing is promised to the customer yet."                 (stage-presentation.ts)
not a void stage    "it is not owed and not collectable."                      (stage-presentation.ts)
```

The last two are the words a tenant reads when choosing what a stage means, so
the rule and the explanation cannot drift.

**`committed` on a bill workflow is deliberately still owed.** On a QUOTE it is
"accepted" and the workflow clause excludes it. On a workflow a tenant invented
it is theirs to mean what they like, and guessing would hide money rather than
show too much — the same honest default `isPriceOfferWorkflow` takes.

## Proved

**12 tests**, and **proved red** by deleting the price-offer clause, which is what
shipped: 2 of 12 fail.

The before and after figures are **measurements**, taken from her pane's live DOM
and reconciled against the database both times:

```
screen  $3,911.70 · 16   →  $2,399.70 · 14
query   $3,911.70 · 16   →  $2,399.70 · 14
```

**Checks:** typecheck 0 on `crm-schemas`, `crm`, `b2b`, `automation-actions` and
`api-rest`. Tests: crm 28 files / 277, api-rest 33 / 269, crm-schemas 3 / 60,
automation-actions 3 / 25, b2b 2 / 5. Guards `price-offers` (still one owner for
both slugs), `boundaries`, `american-spelling` green. ESLint and prettier clean.

## Files

- `wizeworks/packages/crm-schemas/src/builtins/invoicing.ts` (the rule)
- `wizeworks/packages/crm-schemas/src/builtins/owed-document.test.ts` (new)
- `wizeworks/packages/crm-schemas/src/builtins/index.ts`
- `wizeworks/packages/crm/src/services/billing-document-service.ts` (`OWED_DOCUMENT_WHERE`, `aging()`, the late filter)
- `wizeworks/packages/crm/src/index.ts`
- `wizeworks/packages/crm/src/services/b2b-escalation-service.ts`
- `wizeworks/packages/b2b/src/invoices.ts`
- `wizeworks/packages/automation-actions/src/resolvers.ts` · `src/b2b.ts`
- `wizeworks/services/api-rest/src/routes/v1/finance/receivables.ts`
- `wizeworks/services/api-rest/src/routes/v1/b2b/reports.ts`

## The thing to remember

**A guard that names the places it protects has named the places somebody
thought of.** `check:price-offers` is a good check, it works, and it has been
green since 764. It guards against a second copy of the rule — and this was never
a second copy. It was a place that never asked. A check can only fail where
somebody wrote the thing it looks for.

And the one underneath: **two columns that are always equal in your data are not
the same column.** `status = 'unpaid'` and "this is a bill" agree on every
ordinary invoice, which is nearly everything, so one stood in for the other for
months. The rows where they differ were the rows that mattered, and there were
sixteen of them.
