// MCP tools for calling (docs/144 §5.6).
//
// PLACING A CALL IS THE MOST CONSEQUENTIAL THING IN THIS TOOL SET, and it is
// worth being precise about why: it makes a real phone ring in someone's pocket,
// possibly at seven in the morning, from a business they may not be expecting to
// hear from. An email can be ignored; a phone call interrupts. So `place_crm_call`
// is confirmation-gated and its description says plainly what it does, and the
// tool that merely records a call that already happened is not.

import { z } from 'zod';

import { PlaceCallInput, UpdateCallInput } from '@wizeworks/crm-schemas';

import { callService, voiceConnectionService } from '../services';

import type { McpToolDefinition } from './registry';

/* ── Reads ──────────────────────────────────────────────────────────────── */

export const listCalls: McpToolDefinition = {
  name: 'list_crm_calls',
  description:
    'Read the phone calls made to and from a customer — when, how long, how each one ended, and whatever was written down afterwards. Newest first. Use it before contacting somebody so you know whether they were already rung this week, and by whom.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({
    customerId: z.string().uuid().optional(),
    dealId: z.string().uuid().optional(),
    take: z.number().int().min(1).max(50).optional(),
  }),
  run: (ctx, input) =>
    callService.listFor(ctx, input as { customerId?: string; dealId?: string; take?: number }),
};

export const listPhoneSystems: McpToolDefinition = {
  name: 'list_crm_phone_systems',
  description:
    'List the phone systems this business has connected and which number each calls from. Returns nothing when none is connected, which means calls cannot be placed from here — a person can still make them by hand and log them afterwards. Never returns any credential.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => voiceConnectionService.list(ctx),
};

/* ── Writes ─────────────────────────────────────────────────────────────── */

export const placeCall: McpToolDefinition = {
  name: 'place_crm_call',
  description:
    "Ring a member of staff's own phone and, when they answer, dial the customer and join the two. THIS MAKES A REAL PHONE RING FOR A REAL PERSON — confirm with the person you are helping who is being called and from which handset before calling it, and consider the time of day where the customer is. The customer's number comes from their record, so it cannot dial the wrong person. Refused for anyone who has asked not to be contacted.",
  scope: 'write:crm',
  confirmation: true,
  input: PlaceCallInput,
  // The caller ID comes from the connected phone system of the CUSTOMER'S OWN
  // SITE rather than from the tool input — an assistant must not be able to
  // choose what number a customer sees ringing them, and a tenant running two
  // unrelated businesses must not have one dial out as the other.
  //
  // A GLOBAL customer resolves to the tenant-wide phone system here, where the
  // REST route would use the site the operator is working in. That difference is
  // real rather than an oversight: an MCP client has no site it is "in", and
  // picking one on its behalf would silently choose which of a tenant's
  // businesses appears to be calling.
  run: (ctx, input) =>
    callService.placeCall(ctx, input, {
      resolveOrigin: async (customerPropertyId) => {
        const connection = await voiceConnectionService.forProperty(ctx, customerPropertyId);
        return connection
          ? { fromNumber: connection.fromNumber, propertyId: connection.propertyId }
          : null;
      },
    }),
};

export const updateCall: McpToolDefinition = {
  name: 'update_crm_call',
  description:
    'Write down what was said on a call, or correct how it ended. Worth doing straight after a conversation: the outcome recorded here is inferred from the phone system, and a short call it marked as "no answer" was often a voicemail. The notes are the part nobody else can reconstruct later.',
  scope: 'write:crm',
  confirmation: false,
  input: z.object({ callId: z.string().uuid() }).and(UpdateCallInput),
  run: (ctx, input) => {
    const { callId, ...patch } = input as { callId: string } & Record<string, unknown>;
    return callService.update(ctx, callId, patch);
  },
};

export const CALL_TOOLS: McpToolDefinition[] = [listCalls, listPhoneSystems, placeCall, updateCall];
