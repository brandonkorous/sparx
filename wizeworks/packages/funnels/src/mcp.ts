// Funnels MCP tools (docs/151, docs/07) — the campaign surface, for an agent.
//
// Thin wrappers over the same service layer the REST routes drive: one service,
// many transports. Own `read:funnels` / `write:funnels` scopes, additionally
// gated on the `funnels` module flag in api-mcp's server dispatch.
//
// ── WHY THE READ TOOL IS THE POINT ──────────────────────────────────────────
//
// docs/152 A1 recorded that a tenant could reach the conversion-funnel report
// only by asking their AI, because no surface drew it. That is exactly backwards
// as a reason to build an agent tool — but it is the right reason to make sure
// the one an agent gets is the WHOLE answer rather than a row count. So
// `get_funnel_report` returns the assembled ladder: every rung, both halves of
// it counted from their own sources, and every rate as a number or null.
//
// ── WHAT AN AGENT MAY NOT DO ────────────────────────────────────────────────
//
// Record a stage against an arbitrary customer id, and price a conversion, are
// both allowed here and refused on the PUBLIC route — because this call carries
// the tenant's own API key. The asymmetry is deliberate and is documented in
// both places.
//
// Nothing here can write an anonymous row or reach a `view` rung: `recordStage`
// refuses one and a CHECK constraint says the same underneath it. An agent that
// wants "how many people saw the page" reads the report.

import { z } from 'zod';

import {
  CreateFunnelInput,
  UpdateFunnelInput,
  buildLadder,
  createFunnel,
  deleteFunnel,
  getFunnel,
  listFunnels,
  recordStage,
  stagesOf,
  updateFunnel,
} from './index.js';
import { announceStage } from './announce.js';

export type McpScope = 'read:funnels' | 'write:funnels';

/** The context an MCP funnel tool runs under — the same {tenantId, userId} the
 *  REST transport builds from a request. */
export interface FunnelsMcpCtx {
  tenantId: string;
  userId: string;
}

export interface McpToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  scope: McpScope;
  input: z.ZodType<TInput>;
  /** Consequential writes — the MCP server prompts before invoking. */
  confirmation: boolean;
  run(ctx: FunnelsMcpCtx, input: TInput): Promise<TOutput>;
}

export type AnyMcpTool = McpToolDefinition<unknown, unknown>;

// The MCP server has no Fastify request, so events are announced with a console
// logger — the same thing the CMS and social tools do.
const mcpLogger = console as unknown as Parameters<typeof announceStage>[0];

/** Last 30 days unless the caller names a window, matching the REST default so
 *  two transports never disagree about what "recently" meant. */
function range(input: { from?: string; to?: string }): { from: Date; to: Date } {
  return {
    from: input.from ? new Date(input.from) : new Date(Date.now() - 30 * 86_400_000),
    to: input.to ? new Date(input.to) : new Date(),
  };
}

const readTools: AnyMcpTool[] = [
  {
    name: 'list_funnels',
    description:
      'List the campaigns on this account, newest activity first. Optionally filter by site or by status (draft, active, paused, archived). A funnel only measures while it is active.',
    scope: 'read:funnels',
    confirmation: false,
    input: z.object({
      propertyId: z.string().uuid().optional(),
      status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
    }),
    async run(ctx, input) {
      const i = input as { propertyId?: string; status?: string };
      return listFunnels(ctx, {
        ...(i.propertyId ? { propertyId: i.propertyId } : {}),
        ...(i.status ? { status: i.status } : {}),
      });
    },
  },
  {
    name: 'get_funnel',
    description:
      'One campaign with its stage ladder: what each rung is called, what it counts, and what the campaign is trying to achieve.',
    scope: 'read:funnels',
    confirmation: false,
    input: z.object({ funnelId: z.string().uuid() }),
    async run(ctx, input) {
      const { funnelId } = input as { funnelId: string };
      const funnel = await getFunnel(ctx, funnelId);
      if (!funnel) throw new Error(`No funnel with id ${funnelId}`);
      return { ...funnel, stages: stagesOf(funnel) };
    },
  },
  {
    name: 'get_funnel_report',
    description:
      'How a campaign is actually doing over a date range: how many people reached each stage, the drop-off between stages, and the value of what converted. Rates come back as null rather than 0 when there is nothing to divide by, so "nobody got that far yet" never reads as "everybody dropped out".',
    scope: 'read:funnels',
    confirmation: false,
    input: z.object({
      funnelId: z.string().uuid(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }),
    async run(ctx, input) {
      const i = input as { funnelId: string; from?: string; to?: string };
      const funnel = await getFunnel(ctx, i.funnelId);
      if (!funnel) throw new Error(`No funnel with id ${i.funnelId}`);
      return buildLadder(ctx, funnel, range(i));
    },
  },
];

const writeTools: AnyMcpTool[] = [
  {
    name: 'create_funnel',
    description:
      'Start a new campaign. It is created as a draft with the default stage ladder for its kind, and stays a draft until it is given a goal and turned on — a campaign that measured from the moment it was created would count the author clicking around their own landing page.',
    scope: 'write:funnels',
    confirmation: false,
    input: CreateFunnelInput,
    async run(ctx, input) {
      return createFunnel(ctx, input as CreateFunnelInput);
    },
  },
  {
    name: 'update_funnel',
    description:
      'Change a campaign: its name, its stages, its goal, what it is worth, which page and form start it, how long somebody may go quiet before it counts as abandoned, or its status. Turning one on requires a goal, because a campaign with no goal can only report what happened, not whether it worked.',
    scope: 'write:funnels',
    confirmation: false,
    input: z.object({ funnelId: z.string().uuid(), changes: UpdateFunnelInput }),
    async run(ctx, input) {
      const { funnelId, changes } = input as { funnelId: string; changes: UpdateFunnelInput };
      return updateFunnel(ctx, funnelId, changes);
    },
  },
  {
    name: 'record_funnel_stage',
    description:
      'Record that one person reached one stage of a campaign — for outcomes that happen away from the website, like a job booked over the phone. Name exactly one person: an existing customer, or an email address for somebody who is not a contact yet. Only the converting stage can carry a value; leave it out when nobody can say what it was worth, because an unknown value must never be recorded as nothing.',
    scope: 'write:funnels',
    // Consequential: it writes a person into a campaign's history and can wake
    // a follow-up automation.
    confirmation: true,
    input: z.object({
      funnelId: z.string().uuid(),
      stageKey: z.string().min(1).max(63),
      customerId: z.string().uuid().optional(),
      subjectEmail: z.string().email().max(255).optional(),
      valueCents: z.number().int().nonnegative().optional(),
      occurredAt: z.string().datetime().optional(),
    }),
    async run(ctx, input) {
      const i = input as {
        funnelId: string;
        stageKey: string;
        customerId?: string;
        subjectEmail?: string;
        valueCents?: number;
        occurredAt?: string;
      };
      const row = await recordStage(ctx, {
        funnelId: i.funnelId,
        stageKey: i.stageKey,
        customerId: i.customerId,
        subjectEmail: i.subjectEmail,
        valueCents: i.valueCents,
        ...(i.occurredAt ? { occurredAt: i.occurredAt } : {}),
      });
      // Announced exactly as a web capture is, so an automation cannot tell
      // (and should not care) how the stage was recorded.
      await announceStage(mcpLogger, ctx.tenantId, row);
      return row;
    },
  },
  {
    name: 'delete_funnel',
    description:
      'Delete a campaign and the counts recorded against it. This cannot be undone. To stop a campaign measuring while keeping its history, set its status to paused instead.',
    scope: 'write:funnels',
    confirmation: true,
    input: z.object({ funnelId: z.string().uuid() }),
    async run(ctx, input) {
      const { funnelId } = input as { funnelId: string };
      await deleteFunnel(ctx, funnelId);
      return { funnelId, deleted: true };
    },
  },
];

/** The full funnel tool set the MCP server publishes. */
export const funnelsMcpTools = [...readTools, ...writeTools];
