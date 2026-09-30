# 753 — The bin beside the switch did what the switch does, and asked nothing first

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 268
**Surface:** `@wizeworks/b2b` (approval rules), both consoles — Orders to approve
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, on screen and in the database, before and after
**Blocked on:** —

## What happened

One row per spending limit, and on it two controls a thumb-width apart:

```
Over $2,500.00                          ( ●)  [bin]
Loom and Larder
```

The switch pauses the limit and can be switched back. The bin **removed it for
good, with no question asked and nothing said afterwards.** What it took away is
the only thing holding a large wholesale order back from being placed without
anybody looking at it.

Then, having removed it, the row came back a second later marked **Off.**

## Two defects, one row

**The bin asked nothing.** The house rule is that every delete goes behind a
confirm naming what is lost, and 30+ surfaces in this console already do. Two
did not. [[feedback_destructive_actions_confirm]]

**The bin did not delete.** MEASURED 2026-09-20 against the database, straight
after pressing it:

```
 id                                   | min_amount_cents | is_active | company_name
 4b8887e9-516b-4fe7-aff1-989148027a63 |           250000 | f         | Loom and Larder
```

`deleteRule` set `isActive = false`, describing itself as a soft delete
"preserving its audit history". There was no history to preserve: **nothing in
the schema points at a rule id**, and an approval decision is logged as a
`CrmActivity` row naming the ORDER. What the soft delete preserved was the row,
on her screen, forever, because `listRules` returns every rule whatever its
switch.

So the bin and the switch wrote the same field, and only one of them said so.
**43 limits exist on this machine and 38 are switched off; not one has ever been
removed, because the control that says remove cannot.**

## The same feature, two rooms

The console has spending limits in two places: wholesale orders coming IN, and
purchase orders going OUT. The buying one has done it right since the day it was
written:

```ts
// wizeworks/packages/inventory/src/services/purchase-order-approvals.ts
await tx.purchaseOrderApprovalRule.delete({ where: { id } });
await audit(tx, ctx, 'approval_rule.deleted', id, { name: existing.name });
```

Two spellings of one idea, and only one kept its word.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What was done

**Removing a limit removes it.** The switch is still the reversible option and
is still the PATCH; the route comment that read "DELETE → deactivate" now says
what it does.

**The bin asks first,** naming what stops happening rather than only asking
twice:

```
Remove the limit over $2,500.00?
No order from Loom and Larder will be held for sign-off again, however large.
                                              [Keep it]  [Remove the limit]
```

A blanket limit gets the other sentence: "No order will be held for sign-off on
size alone. Every wholesale order goes straight through, however large."

**The switch says when it fails.** `updateRule` had no error handler, and the
list is only invalidated on success, so a failed toggle silently sprang back to
where it was. A switch that springs back and says nothing is the same screen as
a switch that never moved. [[feedback_the_empty_control_is_the_untested_one]]

**`check:confirm` reads every console screen** and fails on a destructive
mutation in a file that asks nothing anywhere. It is wired into `pre-push`.

## Files

- `wizeworks/packages/b2b/src/approval.ts` — the delete
- `wizeworks/packages/b2b/src/approval-rule-delete.test.ts` — new
- `wizeworks/services/api-rest/src/routes/v1/b2b/approval.ts` — the comment that was wrong
- `piggles|sparx/apps/workbench/surfaces/b2b/approvals.tsx` — the confirm, both toasts
- `piggles|sparx/apps/workbench/surfaces/cms/media-picker.tsx` — the neighbour ([754](754-taking-a-picture-out-of-an-album-said-nothing-when-it-failed.md))
- `scripts/check-destructive-confirm.mjs` — new
- `package.json`, `.githooks/pre-push` — wired

## Proof

**The service test** goes red with the soft delete put back: `delete` never
called, 1 of 5. It also holds the tenant check, so another tenant's id still
throws before anything is written.

**`check:confirm` was proved red four ways** before being believed:

| what was broken                         | what it said                                      |
| --------------------------------------- | ------------------------------------------------- |
| the pane put back exactly as it shipped | `approvals.tsx:520  deleteRule`                   |
| the media-picker allowance deleted      | `media-picker.tsx:283  removeFromCollection`      |
| a scan root renamed                     | cannot find `piggles/apps/workbench/screens`      |
| an allowance pointing at nothing        | `media-gone.tsx` no longer has a destructive call |

It prints its denominator rather than a bare tick: _41 destructive mutations
across 1,395 console screens, every one in a file that asks first (2 allowed,
with reasons)._ [[feedback_structural_checks_go_blind]]

Deleting the import alone did NOT redden it, because the helper below still
called `useConfirm` — worth writing down, because that first attempt looked like
a check that could not go red. [[feedback_a_test_that_cannot_go_red]]

**On screen and in the data**, 2026-09-20: the confirm drew, "Limit removed"
toasted, the row left the list, and the database went from two rows to one.
