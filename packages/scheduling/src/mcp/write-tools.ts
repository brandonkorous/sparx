// Write scheduling MCP tools. Scope: 'write:scheduling', all confirmation-gated —
// the MCP server surfaces a destructiveHint so the client prompts the user before
// the booking lifecycle is touched. Each is a thin wrapper over the engine, so the
// no-overlap guarantee + state-machine rules apply identically to an MCP call.

import {
  CancelBookingInput,
  CreateBookingInput,
  RescheduleBookingInput,
} from '@sparx/scheduling-schemas';

import { cancelBooking, createBooking, rescheduleBooking } from '../booking-service';

import type { McpToolDefinition } from './registry';

export const createBookingTool: McpToolDefinition = {
  name: 'create_booking',
  description:
    'Create a booking for a service at a start time (ISO-8601). The engine allocates the required resources per the service strategy and rejects a time that is no longer free (SLOT_UNAVAILABLE) — re-check get_scheduling_availability first. Pass customerId for a known customer, or attendees for a class/group.',
  scope: 'write:scheduling',
  confirmation: true,
  input: CreateBookingInput,
  run: (ctx, input) => createBooking(ctx.tenantId, input as CreateBookingInput, ctx.userId),
};

export const rescheduleBookingTool: McpToolDefinition = {
  name: 'reschedule_booking',
  description:
    'Move a booking to a new start time. The same resources are kept unless resourceIds are supplied; the no-overlap guarantee re-checks the new time (SLOT_UNAVAILABLE if taken).',
  scope: 'write:scheduling',
  confirmation: true,
  input: RescheduleBookingInput,
  run: (ctx, input) => rescheduleBooking(ctx.tenantId, input as RescheduleBookingInput),
};

export const cancelBookingTool: McpToolDefinition = {
  name: 'cancel_booking',
  description:
    'Cancel a booking, releasing its slot immediately. Any deposit/hold is settled per the service policy by the booking surface; this tool performs the cancellation + notifies the customer.',
  scope: 'write:scheduling',
  confirmation: true,
  input: CancelBookingInput,
  run: (ctx, input) => cancelBooking(ctx.tenantId, input as CancelBookingInput),
};

export const writeTools = [createBookingTool, rescheduleBookingTool, cancelBookingTool];
