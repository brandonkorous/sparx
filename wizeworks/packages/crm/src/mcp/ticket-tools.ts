// MCP tools for service requests (docs/144 §7).
//
// THE MOST USEFUL TOOL HERE IS THE FIRST ONE, and it is a read: "what is about
// to go wrong today" is the question a support lead opens the day with, and it
// is answerable from the queue's own clocks without anybody building a report.
// An assistant that can answer it out loud is worth more than one that can file
// a request nobody asked it to file.
//
// Only the two genuinely consequential writes are confirmation-gated. Moving a
// request to Resolved tells a customer, through every rule the business has
// hung off that event, that their problem is dealt with — so it asks first.
// Writing a note or reassigning does not: those are reversible, internal, and
// gating them would train people to click through the gate that matters.

import { z } from 'zod';

import {
  AssignTicketInput,
  CreateTicketInput,
  MoveTicketStageInput,
  UpdateTicketInput,
} from '@wizeworks/crm-schemas';

import { slaPolicyService, ticketService } from '../services';

import type { McpToolDefinition } from './registry';

/* ── Reads ──────────────────────────────────────────────────────────────── */

export const listTickets: McpToolDefinition = {
  name: 'list_crm_tickets',
  description:
    'Read the support queue — who asked for what, how urgent it is, who has it, and how much time is left on the response the business promised. Defaults to requests still open and to the ones running out of time first, which is the order somebody working the queue actually wants. Use `breached: true` for what has already been missed, or `dueWithinMinutes` for what is about to be.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({
    q: z.string().max(255).optional(),
    state: z.enum(['open', 'resolved', 'closed', 'all']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    source: z.enum(['chat', 'email', 'form', 'phone', 'manual', 'api']).optional(),
    customerId: z.string().uuid().optional(),
    assignedToUserId: z.string().uuid().optional(),
    unassigned: z.boolean().optional(),
    breached: z.boolean().optional(),
    dueWithinMinutes: z.number().int().min(1).max(43_200).optional(),
    take: z.number().int().min(1).max(100).optional(),
  }),
  run: (ctx, input) => ticketService.list(ctx, { query: input }),
};

export const getTicket: McpToolDefinition = {
  name: 'get_crm_ticket',
  description:
    'Read one support request in full: what was asked, which stage it is on, who owns it, and both clocks — whether anybody has replied yet, and whether it is on track to be resolved in time.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({ ticketId: z.string().uuid() }),
  run: (ctx, input) => ticketService.get(ctx, (input as { ticketId: string }).ticketId),
};

export const listSlaPolicies: McpToolDefinition = {
  name: 'list_crm_sla_policies',
  description:
    'Read what this business has promised about response times: the hours it is open, the days it is shut, and the reply and resolution targets for each level of urgency. Read this before telling anyone whether a request is late — "four hours" means four WORKING hours here, so a request that arrived at five in the afternoon is not overdue the next morning.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => slaPolicyService.list(ctx),
};

/* ── Writes ─────────────────────────────────────────────────────────────── */

export const createTicket: McpToolDefinition = {
  name: 'create_crm_ticket',
  description:
    "Open a support request. Use it when somebody has asked for something that needs following up and is not already in the queue — check with list_crm_tickets first, because a duplicate request splits one conversation across two records and each one then looks half-answered. Lands on the business's support queue with a response time attached automatically.",
  scope: 'write:crm',
  confirmation: false,
  input: CreateTicketInput,
  run: (ctx, input) => ticketService.create(ctx, input),
};

export const updateTicket: McpToolDefinition = {
  name: 'update_crm_ticket',
  description:
    'Change a request: its subject, the detail, who it is for, or how urgent it is. CHANGING THE URGENCY CHANGES THE DEADLINE — the response time is re-worked from the promise attached to the new level, measured from when the request first arrived. To move it along its stages, use move_crm_ticket_stage instead.',
  scope: 'write:crm',
  confirmation: false,
  input: z.object({ ticketId: z.string().uuid() }).and(UpdateTicketInput),
  run: (ctx, input) => {
    const { ticketId, ...patch } = input as { ticketId: string } & Record<string, unknown>;
    return ticketService.update(ctx, ticketId, patch);
  },
};

export const assignTicket: McpToolDefinition = {
  name: 'assign_crm_ticket',
  description:
    'Hand a request to somebody on the team, or pass `null` to put it back in the unassigned queue for whoever picks it up first. Reversible and internal — nothing is sent to the customer.',
  scope: 'write:crm',
  confirmation: false,
  input: z.object({ ticketId: z.string().uuid() }).and(AssignTicketInput),
  run: (ctx, input) => {
    const { ticketId, ...patch } = input as { ticketId: string } & Record<string, unknown>;
    return ticketService.assign(ctx, ticketId, patch);
  },
};

export const moveTicketStage: McpToolDefinition = {
  name: 'move_crm_ticket_stage',
  description:
    'Move a request to another stage of the support process. CONFIRM BEFORE MARKING ANYTHING RESOLVED OR CLOSED: that is the business telling this customer their problem is dealt with, and any rule they have set up — a survey, a closing email — fires on it. Only somebody who has read the conversation can say whether it really is resolved.',
  scope: 'write:crm',
  confirmation: true,
  input: z.object({ ticketId: z.string().uuid() }).and(MoveTicketStageInput),
  run: (ctx, input) => {
    const { ticketId, ...move } = input as { ticketId: string } & Record<string, unknown>;
    return ticketService.moveStage(ctx, ticketId, move);
  },
};

export const deleteTicket: McpToolDefinition = {
  name: 'delete_crm_ticket',
  description:
    "Remove a request that should never have existed — spam, or a duplicate of one already in the queue. NOT how a request finishes: one that has been dealt with is moved to Resolved so it stays in the business's history and its response time still counts. Deleting is for mistakes only.",
  scope: 'write:crm',
  confirmation: true,
  input: z.object({ ticketId: z.string().uuid() }),
  run: (ctx, input) => ticketService.softDelete(ctx, (input as { ticketId: string }).ticketId),
};

export const TICKET_TOOLS: McpToolDefinition[] = [
  listTickets,
  getTicket,
  listSlaPolicies,
  createTicket,
  updateTicket,
  assignTicket,
  moveTicketStage,
  deleteTicket,
];
