# 652 — Eight invoices were never chased, and four screens said the rule was on

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 227
**Surface:** Automations — the rule editor, the recipe card, the report row, and the record of one run
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 227 (driven on screen, every pane)

## What happened

Devi opened Automations to walk the app. The list did its job: **Invoice overdue
(7 days)** showed a red ⚠ 8, "2 days ago · failed", and an amber **Some
failures** badge. That is [540](540-twenty-two-failed-runs-under-a-green-on-badge.md)
working.

She clicked the row. The rule's own screen said:

> **On**

In success green, with nothing else. Not a word about the eight failures she had
just been warned about on the row she clicked.

## Measured

| where a rule's state is drawn        | reads the counters? |
| :----------------------------------- | :------------------ |
| the LIST                             | yes, since 540      |
| the read-only view of a managed rule | yes, since 540      |
| the **EDITOR**                       | **no**              |
| the **RECIPE CARD**                  | **no**              |
| the **REPORT ROW**                   | **no**              |

Five screens draw one fact. 540 fixed two of them.
[[feedback_a_fix_leaves_its_neighbour_behind]]

The editor is the one an owner reaches by clicking her own rule, so it is the
screen she is most likely to be standing on.

## The recipe card is the worst of the three

Ready-made automations is the screen written for somebody who does not think in
rules at all. It shows a card per job with a plain name and one switch:

> **Chase an invoice a week overdue**
> Emails the customer when an invoice is seven days past due.
> **On**

That is the same rule. Its last eight runs had every one of them failed, so
eight customers with a late invoice were never chased, and the screen built to
answer "is this working?" answered yes.

The file said so in its own words:

```ts
/** on = active or errored (an errored rule is still switched on — the badge is
 *  what flags that something went wrong); off = paused or draft. */
```

The badge was not flagging anything. It read the stored status word, and
**nothing on the platform ever writes `error`** — 540 counted 2,411 automations
and found zero, because the engine's comment says the policy that would set it
"is a later (UI) slice" and it never landed.
[[feedback_screen_over_a_function_nobody_calls]]

## And the report row argued with itself

"What has run" lists every rule with its success rate. Row one:

> **Invoice overdue (7 days)** · schedule.daily · 16 runs · **50% ok** · **On**

A green "On" beside its own amber "50% ok", on one line, two inches apart.

## Fixed

`automationHealth` was already there and already exported. All three now call it.
The badge, and on the editor a banner, because a rule that has never once worked
deserves more than a color:

> **Some failures**
> 8 of its 16 attempts failed, so some of what it promises did not happen.
> **[ See what went wrong ]**

The button opens the run history already switched to **Every run** and already
filtered to **Failed**, which is the list she wanted and three clicks away
before.

The sentence on the rule's own screen is **not** the one on the list. The list
says "Open it to see which", which on the rule itself is an instruction to do the
thing she has just done. Inside, the sentence names the consequence instead and
lets the button carry the remedy. [[feedback_one_outcome_two_causes]]

## Guard

`pnpm check:automation-health` — a screen in either console that badges a rule
with `automationState` and does not read `automationHealth` fails the build.

Proved red four ways:

1. a screen drops the health read → names the file
2. `automation-health.ts` stops reading `errorCount` → dies, because then every
   call site still reads as correct and every screen lies at once
   [[feedback_a_test_that_cannot_go_red]]
3. it stops leaving a paused rule alone → dies; a rule that is switched off is
   not failing, it is not trying
4. a scan root moves → exits 1 rather than passing over nothing
   [[feedback_structural_checks_go_blind]]

One named exception per console, with its reason in the file: the flow canvas
node reads "On · loop-guard depth 3", which is the switch, and the banner sits
directly above it.

## The run she finally opened said this

> **Failed**
> no executor registered for action "email.send_campaign"

Twice: once in the banner, once in the step card. She runs a clothing boutique.
She has never met an executor, the sentence names nothing she can see, and it
reads like she built the rule wrong.

She did not. An unregistered action is a fault in our boot — the exact thing 540
measured and repaired, 71 of the platform's 73 failed runs. **540 fixed the cause
and left the sentence**, so the next failure of any kind prints the next engine
string at her verbatim.

Now:

> **We could not carry out "Send a marketing email".**
> This is a fault on our side, not something you set up wrong. Nothing you change
> in this rule will fix it, and no step after this one ran. If you keep seeing
> it, send us the wording below.
>
> 1 · Send a marketing email · **Failed**
> `email.send_campaign`
> What it reported: `no executor registered for action "email.send_campaign"`

Said once. The exact wording is kept, labeled, because she needs it to quote at
us; hiding it would trade one problem for another.

`run-errors.ts` handles the two kinds the engine writes:

- errors it raises about ITSELF, where naming the fault as ours is more use than
  any remedy we could invent;
- errors an action raises about its own work, which are already English but carry
  a machine prefix (`crm.create_task: `) because the same string goes to a log.
  The console already holds the action's real name, so it shows "Create a task"
  and drops the id.

13 tests, proved red two ways.

Seven of those action messages were rewritten at the source as well, because they
said "tenant", "assignee resolved" and "the trigger entity" to a shop owner.

## Three more, found on the way

**`schedule.daily`, in monospace, twice.** The run list's Trigger column and the
report's "By automation" list both printed the stored type while the flow canvas
two clicks away said "Every day at 6:00pm". 494 of the platform's runs read
`schedule.daily` and 576 read `crm.deal.created`. Both now use
`triggerTypeLabel`; the raw name is the hover.

**"A skipped run is not counted against the success rate" was false.** The
headline used `completed / (completed + failed)`, exactly as the sentence
promises. The per-rule rate two hundred lines below in the SAME FILE used
`completed / runs`, skipped included, and landed on the same screen under that
one sentence. Invisible: there is not a single skipped run on the platform yet,
so the two agreed to the digit and would have gone on agreeing until the first
rule whose condition stopped matching.
[[feedback_a_promise_in_copy_is_a_contract]] `successRateOf` is now exported and
is the only definition, with 5 tests.

**72 triggers in one flat list.** The first rule anybody builds starts at "Start
this rule when…", which offered 71 choices in a single column with no headings
and no search: "An order is placed", "A sales deal is created", "A staff member
clocks in". Every entry already carried its module. The menu is now grouped —
Selling 22, Customers 17, Invoices 5, Wholesale 5, Your team 5, Campaigns 4,
Content 3, Social 3, Funnels 3, Money 2, Dropshipping 2 — and nothing new is
fetched: it stopped throwing away the field it was standing on.
[[feedback_fetched_but_never_rendered]]

## Files

- `piggles|sparx/apps/workbench/surfaces/automations/run-errors.ts` + `.test.ts` (new)
- `piggles|sparx/apps/workbench/surfaces/automations/automation-health.ts` + `.test.ts`
- `piggles|sparx/apps/workbench/surfaces/automations/{automation-editor,recipe-gallery,automations-reports,run-detail,automation-runs,automations-presentation,automations-data,trigger-editor}.tsx`
- `wizeworks/packages/automation/src/service/run-report-service.ts` + `test/unit/success-rate.test.ts` (new)
- `wizeworks/packages/automation/src/actions/{builtins,notify}.ts`
- `wizeworks/packages/automation-actions/src/{crm,crm-depth,email,entity,social}.ts`
- `scripts/check-automation-health.mjs` (new), `package.json`, `.githooks/pre-push`
