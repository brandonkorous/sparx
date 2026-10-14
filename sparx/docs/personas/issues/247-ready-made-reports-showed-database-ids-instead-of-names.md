# 247 — Ready-made reports showed database ids instead of names

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming issue 246 (Customers › Build a report, as Doty)
**Surface:** every report grouped by a stage, pipeline, owner, company, price level or record, and by a coded value (stage of a customer, urgency, status), in both consoles, the API and MCP
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty and Piggles as The Marrow Review, 2026-10-13
**Blocked on:** —

## What happened

Doty opened two of the reports that ship with sparx.

**"Where your deals are"** ("How many open deals are sitting at each step of your
process") drew bars labeled `d516b43-95d3-4a07-a303-234f81c01fa7` and
`856c8539-2e61-4cc5-9927-5d75c37374ac`: database ids, where the names of Gillett's deal
stages should be. The report groups by `stageId`, and nothing turns the id into the
stage's name. "Who is carrying what" groups by `assignedToUserId`, the same way.

**"How far along your customers are"** drew a donut labeled `customer` and `lead`: the
stored codes, lowercase, not the stage names the rest of the console shows.

The report compiler runs one table with no joins, by design (it says so). So a grouped
id comes back as an id, and a coded value as its code. Nothing after it gave either a
name.

## What should have happened

Each bar and slice is named the way the business sees it everywhere else: the stage's
name, the person's name, "Lead" and "Customer".

## How to reproduce

1. Customers › Build a report.
2. Open "Where your deals are", then "How far along your customers are".

## Why it matters

These are the reports sparx offers as the way to learn the builder. The first thing they
teach is a column of ids. An owner cannot read a single bar.

## Where it lives

- `wizeworks/packages/crm/src/services/report-compiler.ts`: the field specs (`ColumnDef`)
  and `runReport`.
- The result renderers: `sparx/apps/workbench/surfaces/crm/report-builder.tsx` and the
  Piggles report builder.

## The fix

**Ids, on the server, once for every caller.** `report-compiler.ts`: every id field now
says where its name lives (`names` on `ColumnDef`, from a static `NAMES` table: stages,
pipelines, people, companies, price levels, and each record kind's own name). A run
grouped by an id looks the names up afterwards, by the ids that came back, as one bound
array inside the business's own session, and returns them as `groupLabels`. An id whose
row is gone reads "No longer here"; one with no name reads "Not named". Both consoles,
the API and MCP get names with no change of their own.

**Coded values, in each console's own words.** A new `report-group-words.ts` per console
maps the coded fields a report can group by (a customer's kind, stage and lead status; a
company's standing and payment terms; a request's urgency and source; a task's status and
priority) to the words that console already uses for them elsewhere. The report builder
and the dashboard card both name their groups through it, and the cell formatter they
each carried a copy of now lives there once.

Tests: crm `report-group-names.test.ts` (red: 15 id fields with no name source; green).
sparx `report-group-words.test.ts` and `report-builder-result.test.ts` (red on the old
builder, green). Piggles the same, red then green. crm: 890 pass.

The Piggles report builder (973 lines) and its data file (476) were split to the size
rule; `report-builder-data.ts` re-exports the new files so every importer still resolves.

## Confirmed by

- sparx, Doty: "Where your deals are" lists First call, Trial order, Visited their yard,
  Lost, Proposal sent (it showed ids before). "How far along your customers are": the
  donut reads "Customer" and "Lead". The same report on the "Monday numbers" dashboard
  card: stage names.
- Piggles, Rosalind: the donut reads "Subscriber" and "Lead"; "Where your deals are"
  reads "New inquiry"; the same on a new "Ad sales this season" dashboard card.

## Rating effect

Build a report, one report: Design and Ease were capped at 2 for a ready-made report of ids.
