# 478 — She added a supplier and the console kept telling her it was not saved

**Status:** fixed
**Severity:** major
**Found by:** Devi adding Ashcombe Mills, the mill she has already paid $240 for fabric
**Surface:** `inventory.suppliers.detail` (both consoles) · `partner.bootcamp.detail`
**Filed:** 2026-09-09

## What was wrong

She filled in the supplier form and pressed **Add supplier**. It worked — the
record is in the database, complete and correct, and the pane became "Ashcombe
Mills · Active".

Three things then disagreed with that, at the same time, on the same screen:

| where             | what it said                  |
| ----------------- | ----------------------------- |
| status bar, left  | **Saved just now**            |
| status bar, right | **Not saved: Ashcombe Mills** |
| the tab           | an unsaved dot                |

And closing the pane produced the confirm dialog:

> **Unsaved changes.** Changes to Ashcombe Mills have not been saved. Close
> anyway?

Over a record that had been written eight seconds earlier.

It is worse than an annoyance. The leave-guard is the one thing standing between
an owner and lost work, and this teaches her that it lies — so the day it is
right, she clicks through it. The false state also registers a browser
`beforeunload`, so navigating away raised Chrome's own **"Leave site?"** dialog
about a supplier that was safely saved.

The workaround, if she found it, was to press **Save** a second time: the update
path rebases the baseline, so a redundant save cleared a warning about a save
that had already happened.

## Why

`target: 'replace'` changes the pane's params in place rather than remounting
it. The load effect is latched behind `loaded`, which the "new" path sets to
`true` without ever taking a baseline:

```ts
if (isNew) {
  setLoaded(true);
  return;
}
if (supplier.data && !loaded) {
  // never runs again after the swap
  setBaseline(formFrom(supplier.data));
}
```

So `baseline` stays `EMPTY_FORM` for the life of the pane, `dirty` compares her
filled-in form against nothing, and the answer is "dirty" forever.

## The mechanism was already written down. Twice.

`staff/person-writes.ts` carries a docblock describing this exact failure:

> _"`target: 'replace'` changes this pane's params in place rather than
> remounting it, so the load effect never re-runs and a baseline left at EMPTY
> would keep the pane dirty forever — **a saved person carrying an unsaved dot
> and a leave-guard on the way out.**"_

And `crm/object-type-detail.tsx` has a one-line version above its own fix:

> _"Cleared BEFORE the pane swap, or the guard fires on the way out of a draft
> that has just been written."_

Somebody hit this, diagnosed it precisely, fixed it where they were standing, and
wrote the reason down. The panes beside them still had it.

## How many, measured rather than guessed

The signal is the specific latch — `if (isNew) { setLoaded(true); return; }` —
because panes that derive their "saved" snapshot from the query with a `useMemo`
recompute after the swap and do not have this bug (checked `crm/task-detail` and
`commerce/tax-zone-detail` by hand to confirm that).

**Seven panes carry the latch. Three had the defect:**

| pane                              |                                               |
| --------------------------------- | --------------------------------------------- |
| `inventory/supplier-detail`       | **broken** — driven, fixed, re-proved         |
| `partner/bootcamp-detail`         | **broken** — same shape exactly, fixed        |
| `crm/record-detail`               | **carries the latch, not driven** — see below |
| `finance/expense-detail`          | ~~correct~~ — **wrong, see below**            |
| `inventory/purchase-order-detail` | ~~correct~~ — **wrong, see below**            |
| `crm/object-type-detail`          | correct                                       |
| `staff/person`                    | correct                                       |

> **Corrected 2026-09-09 by [483](483-two-more-panes-saved-a-record-and-kept-denying-it.md).**
> Two of those four "correct" verdicts were wrong. Both files DO carry the
> rebase, and in both it sits inside the `else` — the update path — while the
> create path swaps the pane with nothing. Reading a file for the presence of a
> rebase answers a different question from reading the BRANCH the create path
> takes, and this table recorded the first answer to the second question. 483
> re-measured the class from the swap rather than from the latch: 61 panes swap
> with `target: 'replace'` under a dirty guard, 11 hold their baseline in state,
> and those 11 were each read AT the swap.

`crm/record-detail` is listed rather than fixed or cleared. It has the same latch,
but its `saved` snapshot is derived from the query rather than latched, so it
self-heals **if** the server echoes the value bag back unchanged. Whether it does
has not been driven, and a guess either way would be worth nothing. It needs a
CRM record created through the screen to settle.

## The fix

The rebase the update path already did, moved onto the create path and placed
BEFORE the swap, matching what the four correct panes do:

```ts
setBaseline(form);
ctx.open('inventory.suppliers.detail', { id: result.id }, { target: 'replace' });
```

## Proven

Added a second real supplier — **Fairfield Trims**, who make the brass hardware
for the leather-covered belt — and the pane came back with **no unsaved dot, no
"Not saved" in the status bar, and Save correctly disabled**. Closed it: no
dialog. Then re-opened Ashcombe Mills and closed that too, cleanly.
