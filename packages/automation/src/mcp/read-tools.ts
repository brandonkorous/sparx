// Read-only automation MCP tools. Scope: 'read:automations'. No confirmation —
// the agent may call these freely to inspect a tenant's rules and run history
// before proposing a change.

import { z } from 'zod';

import {
  AutomationNotFoundError,
  getAutomation,
  listAutomations,
} from '../service/automation-service';
import { getAutomationRun, listAutomationRuns } from '../service/run-service';

import type { McpToolDefinition } from './registry';

export const listAutomationsTool: McpToolDefinition = {
  name: 'list_automations',
  description:
    'List the tenant\'s automations, optionally filtered by status (draft/active/paused), triggerType, or origin. `origin:"system"` are platform-managed rules (some Locked — they reject edits, duplicate them to adapt); `origin:"user"` are tenant-authored.',
  scope: 'read:automations',
  confirmation: false,
  input: z.object({
    status: z.enum(['draft', 'active', 'paused']).optional(),
    triggerType: z.string().max(100).optional(),
    origin: z.enum(['user', 'system']).optional(),
  }),
  run: (ctx, input) => listAutomations(ctx, input as Parameters<typeof listAutomations>[1]),
};

export const getAutomationTool: McpToolDefinition = {
  name: 'get_automation',
  description:
    'Fetch one automation by id — its trigger, conditions, actions, status, and tier flags (origin/locked/clonedFrom).',
  scope: 'read:automations',
  confirmation: false,
  input: z.object({ automationId: z.string().uuid() }),
  run: async (ctx, input) => {
    const { automationId } = input as { automationId: string };
    const automation = await getAutomation(ctx, automationId);
    if (!automation) throw new AutomationNotFoundError(automationId);
    return automation;
  },
};

export const getAutomationRunsTool: McpToolDefinition = {
  name: 'get_automation_runs',
  description:
    'Recent execution history for one automation — each run with its status (completed / failed / waiting / gated). Use this to see whether a rule is actually firing and why.',
  scope: 'read:automations',
  confirmation: false,
  input: z.object({
    automationId: z.string().uuid(),
    status: z.string().max(20).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  run: async (ctx, input) => {
    const { automationId, ...filter } = input as {
      automationId: string;
      status?: string;
      limit?: number;
    };
    // 404 if the automation itself is absent, so an empty list isn't read as a
    // never-ran rule when the id is simply wrong.
    if (!(await getAutomation(ctx, automationId))) {
      throw new AutomationNotFoundError(automationId);
    }
    return listAutomationRuns(ctx, automationId, filter);
  },
};

export const getAutomationRunTool: McpToolDefinition = {
  name: 'get_automation_run',
  description:
    'One execution of an automation, with its ordered per-step records and the gate_log audit trail (why each action ran, was gated/denied, transformed, or deferred).',
  scope: 'read:automations',
  confirmation: false,
  input: z.object({
    automationId: z.string().uuid(),
    runId: z.string().uuid(),
  }),
  run: async (ctx, input) => {
    const { automationId, runId } = input as { automationId: string; runId: string };
    const run = await getAutomationRun(ctx, automationId, runId);
    if (!run) throw new Error(`automation run ${runId} not found`);
    return run;
  },
};

export const readTools = [
  listAutomationsTool,
  getAutomationTool,
  getAutomationRunsTool,
  getAutomationRunTool,
];
