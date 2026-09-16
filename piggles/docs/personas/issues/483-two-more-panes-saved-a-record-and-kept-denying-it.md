# 483 — Two more panes saved a record and kept saying it was not saved

**Status:** fixed
**Severity:** major
**Found by:** Devi raising her first purchase order
**Surface:** `inventory.purchase-orders.detail` · `finance.expense.detail` (both consoles)
**Filed:** 2026-09-09

## What was wrong

Exactly [478](478-she-added-a-supplier-and-was-told-it-was-not-saved.md), in two
panes that issue cleared as correct.

She filled in a purchase order to Ashcombe Mills and pressed **Save draft**. The
toast said **"PO-000001 saved as a draft"**. At the same moment the tab grew an
unsaved dot and the status bar read **"Not saved: PO-000001"**. Navigating away
raised Chrome's own "Leave site?" over an order that was safely written.

## Why 478 got this wrong

478 narrowed the search to one idiom — `if (isNew) { setLoaded(true); return; }` —
found seven panes carrying it, and hand-checked each. `purchase-order-detail`
was marked **correct** because the file plainly contains the rebase:

```ts
setDraft(next);
setOriginal(saved.lines);
setBaseline(JSON.stringify(next));
```

It does. **It is inside the `else`.** The create path, four lines above, swaps
the pane and rebases nothing:

```ts
onSuccess: (saved) => {
  if (isNew) {
    ctx.open('inventory.purchase-orders.detail', { id: saved.id }, { target: 'replace' });
    ...
  } else {
    const next = draftFromDetail(saved);
    setBaseline(JSON.stringify(next));   // ← the rebase, on the OTHER branch
  }
```

Reading the file for the presence of a rebase answers a different question from
reading the BRANCH the create path takes. `finance/expense-detail` has the same
shape and the same verdict — and it is the pane Devi records every cost in.

## Measured properly this time

A sweep over every `target: 'replace'` in a pane that also registers a dirty
guard: **61 files**, of which **11** hold their baseline in state rather than
deriving it from the query. Each of those eleven was read at its swap:

| pane                              |                                                               |
| --------------------------------- | ------------------------------------------------------------- |
| `inventory/supplier-detail`       | fixed in act 120                                              |
| `partner/bootcamp-detail`         | fixed in act 120                                              |
| `inventory/purchase-order-detail` | **broken** — found here, fixed                                |
| `finance/expense-detail`          | **broken** — found here, fixed                                |
| `automations/automation-editor`   | correct — guard gated on `!create.isSuccess`                  |
| `email/sequence-detail`           | correct — same gate                                           |
| `invoicing/invoice-editor`        | correct — `setDirty(false)` before the swap                   |
| `invoicing/workflow-editor`       | correct — same                                                |
| `inventory/transfer-detail`       | correct — its seed effect is not latched, so it re-seeds      |
| `inventory/source-detail`         | not a create path (a retry button)                            |
| `crm/record-detail`               | correct by derivation — `saved` is a `useMemo` over the query |

There are three ways to be right here, not one: rebase before the swap, turn the
guard off on success, or derive the snapshot from the query. Only the latched
baseline with no rebase is wrong.

## The fix

The rebase hoisted out of the `else` so it happens on both paths, before the
swap — which is what `staff/person-writes.ts` spells out in its own docblock.

## It was not only lying about the dot — it was erasing what the server had filled in

Found while checking the two orders in the database afterwards. `PO-000001`, the
one raised before the fix, has **no payment terms**. `PO-000002`, raised after
it, carries `net 15` — Fairfield Trims' own.

Creating a purchase order fills the terms from the supplier: `paymentTerms:
input.paymentTerms ?? supplier.paymentTerms ?? null`. Because the create path
never re-seeded the draft from what came back, the box on screen stayed empty,
and the very next save PATCHed that empty box over the terms the server had just
worked out. **A stale draft does not only mis-report its own state; it writes
itself back over everything the server computed.** The same is true of line ids,
totals and anything else the server assigns.

The rebase fixes both, because `setDraft(draftFromDetail(saved))` is what puts
the server's answer back in front of her. PO-000001's terms were corrected
through the screen afterwards and it now reads `net 30`.

## Proven

**PO-000002** (60 brass buckles from Fairfield Trims) saved as a draft: no
unsaved dot, no "Not saved" chip anywhere on screen, Save disabled, "Saved just
now". Recorded a real cost through `finance.expense.detail`: same, and the tab
took the cost's own name.
