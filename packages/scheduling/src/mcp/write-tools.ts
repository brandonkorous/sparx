// Write scheduling MCP tools. Scope: 'write:scheduling', all confirmation-gated —
// the MCP server surfaces a destructiveHint so the client prompts the user before
// the booking lifecycle is touched. Each is a thin wrapper over the engine, so the
// no-overlap guarantee + state-machine rules apply identically to an MCP call.

import { z } from 'zod';

import {
  CancelBookingInput,
  CreateBookingInput,
  CreateServiceInput,
  RescheduleBookingInput,
  UpdateServiceInput,
} from '@sparx/scheduling-schemas';

import { cancelBooking, createBooking, rescheduleBooking } from '../booking-service';
import { createService, deleteService, updateService } from '../services';

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

// ── Service setup (what can be booked) ───────────────────────────────────────
// The booking lifecycle above operates on services that must already exist. These
// three let an agent SET UP the schedule itself — create the bookable services,
// tune them, retire them — so a tenant's /book page has something to show. Without
// `create_scheduling_service` an agent could take bookings but never define what is
// bookable, which is the gap that made a fresh site's booking page render empty.

export const createServiceTool: McpToolDefinition = {
  name: 'create_scheduling_service',
  description:
    'Create a bookable SERVICE — the thing customers book (appointment, class, reservation, or rental). At minimum set `name` and `durationMinutes`; `priceCents` (0 = free), `capacity` (>1 for a class roster), `bookableOnline`, and `requiresApproval` tune it. Pass `propertyId` to scope the service to one site, or omit for a tenant-wide service. This is what makes a site’s /book page show something — an agent setting up a tenant defines its bookable services here.',
  scope: 'write:scheduling',
  confirmation: true,
  input: CreateServiceInput,
  run: (ctx, input) => createService(ctx.tenantId, input as CreateServiceInput),
};

export const updateServiceTool: McpToolDefinition = {
  name: 'update_scheduling_service',
  description:
    'Update a bookable service by `id` — any field (name, duration, price, capacity, bookableOnline, isActive, …). Only the fields you pass change; omit the rest.',
  scope: 'write:scheduling',
  confirmation: true,
  input: UpdateServiceInput,
  run: (ctx, input) => updateService(ctx.tenantId, input as UpdateServiceInput),
};

export const deleteServiceTool: McpToolDefinition = {
  name: 'delete_scheduling_service',
  description:
    'Soft-delete a bookable service by `id` — it stops being offered online, but its historical bookings keep their reference. Use update_scheduling_service with isActive:false to merely pause it instead.',
  scope: 'write:scheduling',
  confirmation: true,
  input: z.object({ id: z.string().uuid() }),
  run: (ctx, input) =>
    deleteService(ctx.tenantId, (input as { id: string }).id).then(() => ({
      id: (input as { id: string }).id,
      deleted: true,
    })),
};

export const writeTools = [
  createBookingTool,
  rescheduleBookingTool,
  cancelBookingTool,
  createServiceTool,
  updateServiceTool,
  deleteServiceTool,
];
