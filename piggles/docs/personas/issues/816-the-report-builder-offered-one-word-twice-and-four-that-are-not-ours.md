# 816 — The report builder offered one word twice, and four that are not ours

**Status:** fixed
**Severity:** copy + correctness
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `crm.report.builder`, and `report-compiler.ts`
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi, the picker read out of the live DOM
**Blocked on:** —

## The pane is one of the best in the console

"What to call it", "What to look at", "What to work out", "How to break it
down", "The answer, right now", and under the period picker: _"A rolling
period stays true tomorrow, which is what makes a report worth pinning to a
dashboard."_ Plain English the whole way down, and a live preview beside the
controls so a choice teaches you what it does.

Then Devi opened the one list on it.

## Two fields with one name

```
Nothing: just one total
Customer
Kind of customer
Stage
Lead status
Company          ←
Job title
Owner
Company          ←
Do not contact
…
```

**"Company" twice, four rows apart.** `company_name` is whatever somebody
typed on the record; `company_id` is the company record it is actually linked
to. Group by the wrong one and two spellings of one firm come out as two rows.
Nothing on the screen said which was which.
[[feedback_one_outcome_two_causes]]

They are **Company name** and **Linked company** now, in the shared catalog,
because the duplicate is wrong for both consoles.

## The test found a second one I had not seen

A guard over the catalog, asserting no two fields on one object share a label,
went red on `task`: both `assigned_to_user_id` and the custom-record spine's
`owner_id` read **Owner**.

That one turned out to be my own parser reading past the end of the catalog
and into `CUSTOM_SPINE` — a scan that reads past what it is scanning invents
findings as readily as it misses them. Bounded at the catalog's closing brace,
and the denominator (55 fields, 5 objects) is asserted so a parse that
collapses cannot pass quietly.
[[feedback_structural_checks_go_blind]]

## Four words out of somebody else's trade

The field catalog comes down from the API written for the other console's
reader, and this console draws it straight onto the picker, the rule editor
and every column heading of the answer. Every other screen gets its vocabulary
from `lib/console/vocabulary.ts`. This one had none.

| the API says | Piggles says         | because                                                     |
| ------------ | -------------------- | ----------------------------------------------------------- |
| Stage        | How far along        | this is the customer's own progress, not a board's step     |
| Lead status  | How keen they are    | "lead" was taken off the scoring pane by hand in issue 811  |
| Owner        | Who looks after them | "Owner" is also Devi's own role badge, top right            |
| Stage (deal) | Step                 | `pipeline-detail.tsx` says Steps, "Add a step", "Step name" |
| Pipeline     | Board                | the rail calls the list of these "How things move"          |
| Probability  | Chance               | the step editor labels the field Chance, with a % beside it |

`report-field-words.ts` is the same split `channels.ts` makes for where a sale
came from, and the same one vocabulary.ts makes for screen names: the KEY is
untouched, only the word changes, and a field with no entry keeps the API's
word. "Job title", "Last order", "Do not contact" and "Lifetime spend" needed
nothing.

**Swapped at the one point the catalog enters the console**, in
`useReportFields`, rather than at each of the four places that draw a field
name.

## Read back off the live picker

```
["Nothing: just one total","Customer","Kind of customer","How far along",
 "How keen they are","Company name","Job title","Who looks after them",
 "Linked company","Do not contact","Lifetime spend","Orders","Added",
 "Last order","How they found us","What they like to be called",
 "Last reviewed on"]
```

The last three are Devi's own custom properties, and they read fine.

## Proved red

- Removing the `deal.stageId` rename → **2 of 6** red.
- Putting both `Company` labels back → **1 of 3** red, naming both fields.

## Files

- `wizeworks/packages/crm/src/services/report-compiler.ts`
- `wizeworks/packages/crm/src/services/report-fields-have-one-name-each.test.ts` — NEW, 3 tests
- `piggles/apps/workbench/surfaces/crm/report-field-words.ts` — NEW
- `piggles/apps/workbench/surfaces/crm/report-field-words.test.ts` — NEW, 6 tests
- `piggles/apps/workbench/surfaces/crm/report-builder-data.ts`

## Noted, not fixed

The report builder's **toolbar carries no status at all** — the bar above
"What to call it" is empty but for Save. Every other pane says what it is
showing. Small, and it wants a look at what the bar should say on an unsaved
report as against a saved one.
