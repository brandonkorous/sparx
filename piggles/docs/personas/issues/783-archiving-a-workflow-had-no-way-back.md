# 783 — Archiving a workflow had no way back

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 276
**Surface:** api-rest + both workbenches — `invoicing.workflow.edit`
**Filed:** 2026-09-22
**Blocked on:** —

## What happened

The workflow editor's one destructive action is **Archive**, behind a confirm
that reads:

```
Archive "Commission weave"?

It stops being offered when someone creates a document. Documents already
using it are untouched and keep working exactly as they do now.

[ Keep it ]  [ Archive workflow ]
```

That is a description of a reversible change. Nothing was reversible.

```
DELETE /v1/invoicing/workflows/:id   →  archived_at = now()
(nothing)                            →  archived_at = null
```

The list even has an **Archived** filter, so a business owner could find what
they had put away, open it, read a badge saying Archived — and then look at a
toolbar with nothing on it but Save. The screen showed the door and no handle.

`UpdateDocumentWorkflowInput` takes `name`, `slug`, `isDefault` and `sortOrder`,
so there was no way through the update route either. An MCP client could not do
it and neither could a person.
[[feedback_a_promise_in_copy_is_a_contract]]

## What was done

**The endpoint, in the house shape.** `POST /v1/invoicing/workflows/:id/restore`,
matching `POST /v1/commerce/products/:id/restore` and its variant twin; admin,
like the archive it reverses; its own audit entry
(`invoicing.workflow.restored`).

**One deliberate asymmetry.** Restoring does NOT hand back `is_default`.
Archiving stands it down, and by the time anyone restores, something else is
almost certainly the default — quietly taking that back would move every new
document onto a workflow the tenant had put away.

**The action.** Archive and **Bring it back** occupy the same toolbar slot,
because only one of them can ever apply and showing both would mean one is
always inert. No confirm on the way back: it only ever puts something back.

**The confirm now tells the truth**, with one sentence added that only became
true when the rest of this was built:

```
… You can find it again under Archived and bring it back.
```

## Proof

Walked on the real console, on a workflow Devi built this act:

```
Archive "Commission weave"?        confirm names it, and now promises the way back
Archive workflow                   toast "Workflow archived", pane closed
Archived filter                    one row: Commission weave · Archived
opened it                          Archived badge in the toolbar, action reads "Bring it back"
Bring it back                      toast "Workflow brought back", badge gone, action reads "Archive"
Active filter                      six rows again, its two stages intact
```

`workflow-restore.test.ts`, 5 assertions: it comes back into the list, its
stages and their number prefixes are untouched, it does NOT take the default
flag back off whatever replaced it, restoring an active one is a no-op, and a
workflow that does not exist says so. Replacing `{ archivedAt: null }` with
`{}` reddens the first two. [[feedback_a_test_that_cannot_go_red]]

## Files

- `wizeworks/packages/crm/src/services/document-workflow-service.ts`
- `wizeworks/services/api-rest/src/routes/v1/invoicing/workflows.ts`
- `wizeworks/packages/crm/test/integration/workflow-restore.test.ts` (new)
- `piggles|sparx/apps/workbench/surfaces/invoicing/workflow-data.ts`
- `piggles|sparx/apps/workbench/surfaces/invoicing/workflow-editor.tsx`
- `piggles/apps/workbench/surfaces/invoicing/workflow-editor-toolbar.tsx`
