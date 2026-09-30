# 764 — The quote a shop would receive was a bill for money nobody owed

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 270
**Surface:** platform — the printed and emailed billing document, both consoles
**Filed:** 2026-09-21
**Fixed:** 2026-09-21
**Confirmed by:** P03, reading the preview of the page the shop would get
**Blocked on:** —

## What happened

She finished the quote for Loom and Larder and pressed **Preview** to check it
before sending. The page the shop would receive:

```
Juniper Row Textiles LLC                              INVOICE
1164 SE Ash St                                        ┌────────┐
Portland, OR 97214                                    │ Unpaid │
US                                                    └────────┘
                                         Issued  Sep 21, 2026

BILL TO
Tamsin Vale

DESCRIPTION                          QTY  UNIT PRICE    AMOUNT
Marlow Knit, mixed sizes, spring…     12      $42.00    $504.00

                                    Subtotal     $504.00
                                    Total        $504.00
                                    Balance due  $504.00
```

A price she had not sent yet, printed as an invoice, marked unpaid, with a
balance due. Loom and Larder buy on net terms. That goes in their accounts
payable.

No number on it either.

## MEASURED, before the fix

Four places had to know whether a document was a quote or a bill. Three did
not:

| renderer / screen            | knew? | what it printed on a quote        |
| ---------------------------- | ----- | --------------------------------- |
| the live document renderer   | no    | the stage label, "Draft Q-000017" |
| the unsaved-draft renderer   | no    | "Invoice", numberless, "Unpaid"   |
| the frozen-snapshot renderer | no    | the stage label                   |
| the console editor           | no    | "invoice" in five places (762)    |

And a separate hole underneath it: the preview pane sends the draft the editor
publishes, and that payload carried the typed fields ONLY — no stage, no
number, no status, no workflow — so every preview fell through to the
renderer's defaults. That is why it read "Invoice / Unpaid / Balance due" and
not even the stage label.

## Why: `customerLabel` means two different things

A quote and an invoice are the same row on two different workflows, and only
the workflow can tell them apart. The stage's `customerLabel` cannot, because
the two seeded templates use it for different jobs:

| workflow     | its stage customer labels                             |
| ------------ | ----------------------------------------------------- |
| `invoice`    | Invoice, Receipt — **the name of the document**       |
| `b2b-quotes` | Draft, Submitted, Quoted, Accepted — **its standing** |

So a renderer handed only the stage label has no correct answer available. On a
bill it names the document; on a quote it names where the quote has got to.
[[feedback_one_outcome_two_causes]]

## A second thing, found in the same minute

With no editor open, the preview pane sends `{ documentId }` to render the
saved document. `DraftPreviewBody` had no `documentId` field, so Zod stripped
it and the route rendered the empty object left behind: a numberless "Invoice",
Unpaid, no lines, $0.00.

The pane's own comment says the opposite: "the preview keeps working with no
editor open at all: with no draft published it simply previews the saved
document." [[feedback_a_promise_in_copy_is_a_contract]]

## What was done

**`BillingRenderData` gains two optional fields**, and the shared blocks honor
them:

- `standing` — what goes in the pill INSTEAD of the AR status. An offer says
  where it stands; a bill says whether it has been paid.
- `priceOffer` — suppresses the **Balance due** row, which on an offer is a
  debt nobody has incurred. A deposit already taken still shows, because that
  money really did change hands.

**All three builders set them** from the workflow slug, through the one shared
rule in `@wizeworks/crm-schemas/builtins`. The snapshot builder reads the
workflow live rather than from the frozen payload — safe here and only here,
because a document's workflow is set at create and never changes, and the
alternative was a payload field every snapshot frozen before today would be
missing, leaving old accepted quotes reprinting as unpaid invoices.

**The hand-built-chrome binding agrees.** A template author writing
`{{ document.status }}` gets the same answer the built-in head block gives, so
two blocks on one page cannot contradict each other.

**The draft carries the document's identity.** The console publishes
`workflowSlug`, `stageId`, `number`, `status`, `amountPaid` and the date in the
right column alongside the typed fields, and the route's schema accepts
`workflowSlug`. A schema that strips what it is not told about is exactly how
this stayed invisible.

**`documentId` is a real field on the preview body**, and when it is given the
route renders the SAVED document through the same builder the emailed and
printed copies use.

**`check:price-offers`** fails the build on any second copy of the price-offer
slugs. Wired into `pre-push`.

## Files

- `wizeworks/packages/crm/src/services/billing-document-html.ts` — `standing`, `priceOffer`, the head and totals blocks
- `wizeworks/packages/crm/src/services/billing-render-service.ts` — live + snapshot
- `wizeworks/packages/crm/src/services/billing-draft-render.ts` — the unsaved preview
- `wizeworks/packages/crm/src/index.ts` — re-exports the rule for packages that depend on the CRM
- `wizeworks/packages/crm-schemas/src/builtins/invoicing.ts`, `index.ts` — the rule
- `wizeworks/packages/automation-actions/src/resolvers.ts` — reads it rather than keeping its own copy
- `wizeworks/services/api-rest/src/routes/v1/invoicing/documents.ts` — `documentId`, `workflowSlug`
- `wizeworks/services/api-rest/src/lib/invoice-tree-render.ts` — the chrome binding
- `piggles/apps/workbench/surfaces/invoicing/invoice-editor.tsx`, `sparx/…` — publishes identity
- `scripts/check-price-offers.mjs`, `package.json`, `.githooks/pre-push`

## Proof

Read on screen 2026-09-21, the same document, the same button:

```
Juniper Row Textiles LLC                               QUOTE
1164 SE Ash St                                        ┌───────┐
Portland, OR 97214                                    │ Draft │
US                                                    └───────┘
                                         Number  Q-000017
                                         Issued  Sep 21, 2026
...
                                    Subtotal     $504.00
                                    Total        $504.00

                        Juniper Row Textiles LLC · Q-000017
```

Quote, not invoice. Draft, not unpaid. Numbered. **No balance due.**

**A real invoice is untouched**, and the second hole is closed with it.
INV-000013, previewed with no editor open:

```
Juniper Row Textiles LLC                             INVOICE
                                            ┌────────────────┐
                                            │ Partially paid │
                                            └────────────────┘
                                   Number  INV-000013
BILL TO                     SHIP TO
Marlow Knit · XL · Moss         1    $52.00     $52.00
                                    Subtotal      $52.00
                                    Total         $52.00
                                    Deposit      -$30.00
                                    Amount paid  -$30.00
                                    Balance due   $22.00
NOTES     For order O-000018.
PAYMENTS  Deposit · cash · Sep 21, 2026 · $30.00
```

Before this fix that same pane drew a numberless empty invoice at $0.00.

`check:price-offers` was proved red three ways before it was believed:
[[feedback_a_test_that_cannot_go_red]]

| what was broken                 | what it said                                        |
| ------------------------------- | --------------------------------------------------- |
| a bare slug put back in a pane  | names the file and line, and what to import instead |
| the owning file renamed         | refuses, rather than passing over nothing           |
| a scan root that does not exist | refuses, rather than printing green over 0 files    |

It found two real copies on its first honest run, one of them pre-existing in
`automation-actions/src/resolvers.ts`. [[feedback_structural_checks_go_blind]]

crm 251, api-rest 243, automation-actions 25, and 61 structural checks pass.
