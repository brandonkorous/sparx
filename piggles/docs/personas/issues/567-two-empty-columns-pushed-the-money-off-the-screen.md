# 567 — Two empty columns pushed the money off the screen

**Status:** fixed and proven
**Severity:** medium
**Found by:** Devi, opening My Team the way she always works, three panes wide
**Surface:** `piggles|sparx/apps/workbench/surfaces/staff/people.tsx`, `staff/timesheets.tsx`
**Filed:** 2026-09-16
**Follows:** [565](565-five-more-tables-where-the-name-got-64-pixels.md)
**Family:** [[feedback_responsive_top2_rule]] · [[feedback_never_present_absence_as_measurement]]

## What she saw

**My Team → People.** Two people, a horizontal scrollbar, and two columns with
nothing in them:

| Name             | Status  | Clock | Tickets |
| ---------------- | ------- | ----- | ------- |
| Priya Nandakumar | Working |       |         |
| Tomas Okonkwo    | Working |       |         |

**My Team → Timesheets.** The Cost column, which is the reason anyone opens the
screen before approving anything, cut off the right-hand edge.

## Measured

Her pane is 357px.

| screen     | table width | overflow  | what fell off                   |
| ---------- | ----------- | --------- | ------------------------------- |
| People     | 485px       | **128px** | Type, Email, and the row action |
| Timesheets | 447px       | **90px**  | **Cost**                        |

People's two empty columns held **158px between them**: Clock 73px, Tickets 85px,
both rendering nothing on either row.

## The cause

Clock and Tickets are **exception columns**. They draw a badge when somebody is
on the clock, or a ticket has expired or is about to, and `null` otherwise:

```tsx
<td>{onTheClockSince ? <Badge …/> : null}</td>
<td>{certs.expired > 0 ? <Badge …/> : certs.expiring > 0 ? <Badge …/> : null}</td>
```

On an ordinary roster that is nothing on any row. A column holding nothing still
holds its header's width, and an always-visible one takes it from the columns
that do have content. Empty columns do not get to hide the ones with something
in them.

Timesheets was the plainer version: five always-visible columns, none disclosing,
and its name cell carried `max-w-48 min-w-0` rather than a give-cell — so its
`truncate` could never bite and Cost was pushed out instead.

## The fix

The house pattern, the same one the stock list uses and the same one applied to
five tables in [565](565-five-more-tables-where-the-name-got-64-pixels.md):
`hidden @md:table-cell` on the column, and the badge folds back under the name
when the pane is narrow. Built once per row and drawn in both places, because two
copies of a badge is two chances to drift.

Timesheets also gets a real give-cell on Who, so the name truncates and the money
stays.

## Proven

Same pane, measured again:

| screen     | overflow before | after   |
| ---------- | --------------- | ------- |
| People     | 128px           | **0px** |
| Timesheets | 90px            | **0px** |

On People the name cell went 194px → 211px. On Timesheets Who settled at 144px,
truncating to "Priya Nandak…", with Logged and **Cost** both on screen.

402 piggles tests and 314 sparx tests pass; both consoles typecheck; lint clean.
