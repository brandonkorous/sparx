// Write automation MCP tools. Scope: 'write:automations'. All confirm — the MCP
// server surfaces a destructiveHint so the client prompts before the AI mutates
// a rule.
//
// These reuse the SAME input schemas as the REST routes (CreateAutomationInput /
// UpdateAutomationInput / CloneAutomationInput from @sparx/automation-schemas),
// so the authoring vocabulary the AI sees (trigger kinds, the 12 condition
// operators, the typed action catalog) is exactly what the dashboard and SDKs
// see — one schema, no drift. The tier invariants are enforced in the service:
// create is always user-origin/draft; a LOCKED rule rejects update/status/delete
// (→ AUTOMATION_LOCKED), and the AI's path to adapt one is `clone_automation`.

import { z } from 'zod';

import {
  CloneAutomationInput,
  CreateAutomationInput,
  UpdateAutomationInput,
} from '@sparx/automation-schemas';

import {
  cloneAutomation,
  createAutomation,
  deleteAutomation,
  setAutomationStatus,
  updateAutomation,
} from '../service/automation-service';

import type { McpToolDefinition } from './registry';

export const createAutomationTool: McpToolDefinition = {
  name: 'create_automation',
  description:
    'Author a new automation. Always created as a user-origin DRAFT — activate it separately with set_automation_status once the trigger/conditions/actions look right. Provide a trigger (event or schedule), an optional condition group, and one or more typed actions.',
  scope: 'write:automations',
  confirmation: true,
  input: CreateAutomationInput,
  run: (ctx, input) => createAutomation(ctx, input as z.input<typeof CreateAutomationInput>),
};

export const updateAutomationTool: McpToolDefinition = {
  name: 'update_automation',
  description:
    'Update an existing automation (name / description / trigger / conditions / actions / status). Only user-origin rules are editable — a platform-managed LOCKED rule rejects this (AUTOMATION_LOCKED); clone_automation it first, then edit the copy.',
  scope: 'write:automations',
  confirmation: true,
  input: UpdateAutomationInput.extend({ automationId: z.string().uuid() }),
  run: (ctx, input) => {
    const { automationId, ...patch } = input as z.input<typeof UpdateAutomationInput> & {
      automationId: string;
    };
    return updateAutomation(ctx, automationId, patch);
  },
};

export const setAutomationStatusTool: McpToolDefinition = {
  name: 'set_automation_status',
  description:
    'Set an automation live or idle: draft → active (start firing) / paused (stop firing) / draft. A LOCKED rule rejects this (AUTOMATION_LOCKED).',
  scope: 'write:automations',
  confirmation: true,
  input: z.object({
    automationId: z.string().uuid(),
    status: z.enum(['draft', 'active', 'paused']),
  }),
  run: (ctx, input) => {
    const { automationId, status } = input as {
      automationId: string;
      status: 'draft' | 'active' | 'paused';
    };
    return setAutomationStatus(ctx, automationId, status);
  },
};

export const cloneAutomationTool: McpToolDefinition = {
  name: 'clone_automation',
  description:
    '"Duplicate to edit" — fork any automation (including a platform-managed/Locked one) into a new user-origin, editable DRAFT copy that records its lineage (clonedFrom). This is how a tenant adapts a system rule without touching the original.',
  scope: 'write:automations',
  confirmation: true,
  input: z.object({
    automationId: z.string().uuid(),
    name: z.string().min(1).max(255).optional(),
  }),
  run: (ctx, input) => {
    const { automationId, name } = input as { automationId: string; name?: string };
    return cloneAutomation(ctx, automationId, CloneAutomationInput.parse({ name }));
  },
};

export const deleteAutomationTool: McpToolDefinition = {
  name: 'delete_automation',
  description:
    'Delete a user-origin automation permanently. A platform-managed LOCKED rule cannot be deleted (AUTOMATION_LOCKED) — pause it instead, or clone-and-adapt.',
  scope: 'write:automations',
  confirmation: true,
  input: z.object({ automationId: z.string().uuid() }),
  run: async (ctx, input) => {
    const { automationId } = input as { automationId: string };
    await deleteAutomation(ctx, automationId);
    return { automationId, deleted: true };
  },
};

export const writeTools = [
  createAutomationTool,
  updateAutomationTool,
  setAutomationStatusTool,
  cloneAutomationTool,
  deleteAutomationTool,
];
