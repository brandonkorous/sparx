# 781 — Renaming a reference name broke the platform's own lookup

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 276
**Surface:** `document_workflows` — the reference name field in `invoicing.workflow.edit`
**Filed:** 2026-09-22
**Blocked on:** —

## What happened

Three of the five workflows on Juniper Row's list are the platform's own:

```
Net-terms AR          net-terms-ar          money owed on B2B terms
B2B Quotes            b2b-quotes            a price offered to a trade customer
Customer Estimates    customer-estimates    a price offered to a retail one
```

Nothing said so. Each opened in the same editor as any other, with a freely
editable **Reference name** under a sentence inviting the change:

```
A short version with no spaces, used behind the scenes. Filled in from
the name. Change it only if you have a reason to.
```

## What renaming one did

Three services resolve their workflow BY SLUG, because they run with no document
in hand and have to find the right one from nothing:

```
b2b-ar-service.ts            ensureNetTermsArWorkflow   → findUnique({ tenantId_slug })
b2b-quote-service.ts         b2b-quotes                 → findUnique({ tenantId_slug })
customer-estimate-service.ts customer-estimates         → findUnique({ tenantId_slug })
```

Each is idempotent: not found means create. So a rename did not fail. It made
the next lookup MISS, and the miss minted a SECOND workflow carrying the
original name and slug. The tenant is then looking at two "B2B Quotes" in their
list, with every existing quote still on the one they renamed.

And a fourth reader, in `crm-schemas`:

```ts
const PRICE_OFFER_NOUNS = {
  [B2B_QUOTE_WORKFLOW_SLUG]: 'quote',
  [CUSTOMER_ESTIMATE_WORKFLOW_SLUG]: 'estimate',
};
export function isPriceOfferWorkflow(slug) {
  return slug != null && slug in PRICE_OFFER_NOUNS;
}
```

That is the function that tells a price OFFER from a demand for money. A quote
whose workflow slug no longer matches is treated as a bill: it falls due, it
carries an AR status, and the page a wholesale customer receives says
**Balance due**. Issues 764 and 765 were exactly that failure, and one edit in
this field re-opened both.

## The premise, stated in the code

The comment above `PRICE_OFFER_NOUNS` says why the slug was chosen as the key:

> Keyed by SLUG because a tenant renames a workflow whenever they like, and the
> system workflows are seeded with **a slug that does not move**.

Nothing enforced that. The screen next door moved it.
[[feedback_copy_edit_breaks_identity_lookups]]
[[feedback_verify_capability_in_code_not_docs]]

## What was done

**One list, where the premise is stated.** `SYSTEM_WORKFLOW_SLUGS` and
`isSystemWorkflowSlug` in `crm-schemas/src/builtins/invoicing.ts`, beside
`PRICE_OFFER_NOUNS` and the comment that relies on them.

**The server refuses it.** `documentWorkflowService.update` throws a
`CrmValidationError` naming the workflow and the name that has to stay, and
saying what can still be changed:

```
"B2B Quotes" is one your account runs on, so its reference name has to stay
"b2b-quotes". You can rename it, change its steps, and change what your
customers see at each one.
```

**The screen says so first.** The Reference name field is `readOnly` on a system
workflow — readOnly rather than disabled, so the value stays selectable and
copyable, since it is what an automation condition is pointed at. The help text
under it changes to the reason.

Everything else about these workflows stays the tenant's: the display name, the
stages, the customer-facing word at each stage, and the default flag. Only the
reference name is the platform's.

## Proof

`workflow-system-slug.test.ts`, 7 assertions:

```
cannot be changed on the quotes workflow                       ✓
cannot be changed on the estimates workflow                    ✓
cannot be changed on the net-terms receivables workflow        ✓
says which name has to stay, and what can still be changed     ✓
leaves everything else about it theirs                         ✓
still lets a tenant rename a workflow they invented            ✓
is happy to be handed the name it already has                  ✓
```

The last one is not padding. The console sends the whole header on every save,
so an unrelated edit arrives with the slug attached; refusing that would make a
system workflow unsaveable rather than unrenameable.

Replacing the guard's condition with `false` reddens the first four.
[[feedback_a_test_that_cannot_go_red]]

On screen: typing into **b2b-quotes** now changes nothing, and the field reads
"This is one your account runs on, so its reference name stays as it is."
**commission-weave**, a workflow Devi invented, remains fully editable.

## Files

- `wizeworks/packages/crm-schemas/src/builtins/invoicing.ts` + `index.ts`
- `wizeworks/packages/crm/src/services/document-workflow-service.ts`
- `wizeworks/packages/crm/test/integration/workflow-system-slug.test.ts` (new)
- `piggles|sparx/apps/workbench/surfaces/invoicing/stage-inspector.tsx`
- `piggles|sparx/apps/workbench/surfaces/invoicing/workflow-editor.tsx`
- `piggles/apps/workbench/surfaces/invoicing/workflow-editor-panes.tsx`

## What was looked at and left

Archiving a system workflow is still allowed, and is honest: the resolvers find
it by slug whether or not it is archived, so the platform keeps working, and the
confirm's promise ("it stops being offered when someone creates a document") is
about the manual create path, which is exactly what archiving does.
