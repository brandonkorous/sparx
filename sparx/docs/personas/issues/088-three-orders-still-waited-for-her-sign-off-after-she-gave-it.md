# 088 — Three orders still "waited for her sign-off" after they were answered

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 5 (checking search after issue 087)
**Surface:** workbench › Tasks; workbench › Search everything; the daily seed check (release and 02:07)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06 (Tasks › Done, Search everything)
**Blocked on:** —

## What happened

Doty searched "O-0000". Under Tasks the box listed:

- "Order O-000014 from Renée Castañeda is waiting for your sign-off: approve or reject it under Approvals"
- "Order O-000013 from Seamus O'Malley is waiting for your sign-off: …"
- `Order O-000012 from  is waiting for your sign-off: …` (no name at all)

each with "Medium priority" beside it. Wholesale › Approvals, one click away, said "Nothing waiting". All three were answered days before: O-000014 approved by Teodora on the site, O-000012 signed off and placed, O-000013 turned down. In the database all three tasks were still `open`.

After the daily check closed them, the task list was right, and the search box still listed all three as open, under the old blank-name title, still "Medium priority".

## What should have happened

A task that asks her to do something already done closes itself and says why, as tasks have since migration 20270530000014. A closed task shows as closed everywhere she can find it, search included, and never under a title with a hole in it.

## How to reproduce

1. Sign in as Doty (`p01.doty@gillettdiesel.test`), open Search everything, type "O-0000" or "sign-off".
2. Before the fix: the three tasks above, open, "Medium priority". Wholesale › Approvals: "Nothing waiting". Every time.

## Why it matters

It says something false on the screen she works from. Three chores that cannot be done sit in her list next to real ones, and she can only learn they are stale by opening Approvals and comparing. The blank title reads as broken.

## Where it lives

Five causes, all on the same path.

1. **No backfill.** `20270530000014_a_task_closes_when_its_order_moves_on` gave `tasks` an `order_id` and chose "No backfill … older open tasks keep no link and are closed by hand". The three were opened before it. Nothing told her which open tasks were safe to close.
2. **The daily check knew every subject but orders.** `closeTasksWhoseReasonIsGone` in `wizeworks/packages/crm/src/services/task-service.ts` closed tasks waiting on an account, a deal or a document, and never one waiting on an order.
3. **The daily check's events were thrown away.** `reconcileSeeds` in `wizeworks/packages/automation-worker/src/runtime.ts` never installed the CRM event bridge. The release runs it first thing on a fresh pod, so every task it closed announced itself to the default `LoggingPublisher`, which discards. Measured: the check closed the three, and search kept all three open.
4. **A canceled task, or one edited by hand, announced nothing.** `closeTasks` sent `crm.task.completed` for done and nothing for canceled; `taskService.update` sent nothing at all. The search index follows `crm.task.*` events, so a renamed, reopened or canceled task kept its old words and status in search, on every path, not just the daily one.
5. **The search line under a task was its priority only.** `wizeworks/packages/commerce/src/universal-projection.ts`: "Medium priority" under a task that is done.

The blank name itself is issue 085 item 15 (the engine had no customer name). Fixed then for new tasks, and never repaired on the rows it had already written.

## The fix

- **Migration `20270530000023_an_older_sign_off_task_finds_its_order`.** Links each task the "Wholesale order waiting: sign it off" automation opened to its order, from the automation's own run record (the trigger event names the order, the step's output names the task), the way 0022 did for accounts, deals and documents. Puts the customer's name back into `from  is waiting`, built the way the engine builds `customer.fullName`. Locally: 3 linked, 1 renamed.
- **The daily check closes order tasks.** `closeWhereOrderHasMovedOn` reads where each order is now: canceled ("Order O-000013 was canceled, so there is nothing left to do here."), refunded, or signed off ("Order O-000012 was signed off and placed."). An order deleted outright closes its task as no longer needed.
- **`reconcileSeeds` installs the bridge first** (`ensureEngineInstalled`), so what it closes reaches search, automations and webhooks.
- **Every task change is announced.** A canceled close and a hand edit send `crm.task.updated` (`reason: 'closed' | 'edited'`, with the status), after commit, keyed to the change.
- **The search line says Done or Canceled** for a closed task (`taskLineWords`), the task list's own words, and the priority while it is open.

Siblings checked: the closers for accounts, deals and documents all go through the same `closeTasks`, so they gained the canceled event too (the account test now expects it). Nothing else reacts to `crm.task.updated` except the overdue reminder, which checks its own `reason`. Both consoles read the same index, so neither needed a change for this.

Tests, each proved red against the code before it:

- `crm/src/services/task-waits-on-subject.test.ts` "closes a sign-off task whose order was answered before anything called it": old code closed 0 of 3.
- The same file and `task-waits-on-order.test.ts`: the canceled close sends `crm.task.updated`; a hand edit does ("says it changed, so the search box shows the new words"). Removing the fix reddens exactly 3.
- `automation-worker/src/reconcile-announces.test.ts`: the bridge is installed before the reconcile. Old code: `['reconcile']`.
- `commerce/src/task-search-line.test.ts`: Done, Canceled, priority. The old line reddens 2.

Two tests had been pinning the defect: both asserted that a canceled close published nothing. They now expect the event.

## Confirmed by

On screen, 2026-10-06, as Doty (Gillett, local), after `prisma migrate deploy` and one run of the daily check (`tasks: closed 3`):

- **Tasks › To do:** "No tasks to do". **Tasks › Done:** "Order O-000012 from Dana Whitcomb-Nguyen is waiting for your sign-off…" and the O-000014 task, both Done. Opening O-000012's task: Notes "Order O-000012 was signed off and placed."
- **Search everything, "sign-off":** the three tasks with their names, beside "Done", "Done" and "Canceled".

**The live paths, with no hand steps** (2026-10-06, same session):

- **An order canceled.** Dana placed O-000016 on the site ($4,758.30, over Salt Lake County's $2,500 limit). The task "Order O-000016 from Dana Whitcomb-Nguyen is waiting for your sign-off" opened by itself, name included, and search showed it "Medium priority". Doty canceled the order from its page; search then showed the task "Canceled". The same again with O-000017.
- **A task edited by hand.** Doty added "Call Dana about the Cheetah turbos for Units 31 and 34", renamed it "Quote Dana the Cheetah turbos at contract price, Units 31 and 34": "contract price" found it, "Call Dana" no longer did. Status set to Canceled: search said "Canceled". Back to To do: "Medium priority". Mark done: "Done".
- **Piggles.** Juniper Row's finished "Q-000019 was approved" tasks read "Medium priority" until Juniper Row's index was rebuilt, then "Done": the line changes only when an entry is written again, which is what the release's `reindex-search` step is for.
- **Both themes.** The Done and Canceled lines read clearly in light and dark.

The search index caught up after a reindex of Gillett, because these three were closed before the bridge fix. In production the same is true of every task the release's daily check has closed so far: run ops `reindex-search` with apply once this ships.

## Rating effect

—
