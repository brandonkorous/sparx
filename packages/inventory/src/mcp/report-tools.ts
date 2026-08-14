// Reporting MCP tools (docs/146 Phase 10, surfaced in Phase 12.1).
//
// Phase 10 built ONE report registry so the export route, the scheduler and an
// assistant could not drift into three answers to the same question. Two of the
// three were wired; `runReport`'s own comment claimed the third. This is it.
//
// ── Why the catalog is a tool of its own ─────────────────────────────────
//
// The keys are internal (`gmroi`, `sell_through`) and the labels are what a
// business owner calls the thing. An assistant that has to guess a key will
// guess `inventory_value` and get an error; one that can ask for the list first
// picks from real names. `list_inventory_reports` exists so `run_inventory_report`
// never has to be guessed at.
//
// ── What is deliberately absent ──────────────────────────────────────────
//
// CREATING or changing a schedule. A schedule mails a file to a list of people
// on a recurring basis — it is an outbound commitment to somebody's inbox, and
// an agent quietly adding a weekly send is a different category of mistake from
// running a report once. Reading the schedules is here, so an assistant can
// answer "what am I already being sent"; setting one up is a person's job.
//
// Per the platform's BYOK/MCP-only rule, sparx runs no model here — the tenant
// brings their own client.

import { z } from 'zod';

import { ReportFilters, ReportKey } from '@sparx/commerce-schemas';

import { inventoryService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const catalog: McpToolDefinition = {
  name: 'list_inventory_reports',
  description:
    'Every inventory report that can be run, with the name a business owner would use, what it answers, and whether it covers a period or a moment. Ask for this before `run_inventory_report` rather than guessing a key.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({}),
  run: () => Promise.resolve(inventoryService.reportCatalog()),
};

const run: McpToolDefinition = {
  name: 'run_inventory_report',
  description:
    'Run any inventory report and get back its rows, a table ready to save as a spreadsheet, and a short summary in plain words. Same code path as the export button and the scheduled email, so the three cannot disagree. Filters are a superset — each report reads the ones that mean something to it and ignores the rest, so passing a date window to a point-in-time report is harmless.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    key: ReportKey,
    filters: ReportFilters.optional(),
  }),
  run: (ctx, input) => {
    const i = input as { key: string; filters?: Record<string, unknown> };
    return inventoryService.runReport(ctx, i.key, i.filters ?? {});
  },
};

const schedules: McpToolDefinition = {
  name: 'list_report_schedules',
  description:
    'The reports already being sent on a schedule: which report, how often, to whom, in what format, when it last went and when it next will. Use this to answer "what am I already getting" before anybody sets up another one.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => inventoryService.listReportSchedules(ctx),
};

const glReconciliation: McpToolDefinition = {
  name: 'get_gl_reconciliation',
  description:
    'Whether the stock figure and the accounts agree at a given moment, and where they do not. Breaks the difference into the honest categories — goods received but not yet invoiced, invoiced but not yet received, and anything left that is a genuine discrepancy. Use this at period end for "why doesn\'t my inventory account match my stock report".',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    /** The moment to state the position at. Defaults to now. */
    asOf: z.string().datetime().optional(),
  }),
  run: (ctx, input) => {
    const i = input as { asOf?: string };
    return inventoryService.glReconciliationReport(ctx, {
      asOf: i.asOf ? new Date(i.asOf) : new Date(),
    });
  },
};

export const reportReadTools: AnyMcpTool[] = [catalog, run, schedules, glReconciliation];
