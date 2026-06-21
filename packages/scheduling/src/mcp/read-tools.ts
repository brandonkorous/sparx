// Read-only scheduling MCP tools. Scope: 'read:scheduling'. No confirmation — the
// agent may call these freely to inspect services, open times, and bookings before
// proposing a change.

import { z } from 'zod';

import { getAvailability } from '../availability';
import { getBooking, listBookings } from '../booking-queries';
import { listServices } from '../services';

import type { McpToolDefinition } from './registry';

export const listServicesTool: McpToolDefinition = {
  name: 'list_scheduling_services',
  description:
    "List the tenant's bookable services (appointment / class / reservation / rental) with duration, price, and booking type. Use this first to find the serviceId for an availability or booking call.",
  scope: 'read:scheduling',
  confirmation: false,
  input: z.object({
    bookingType: z.enum(['appointment', 'class', 'reservation', 'rental']).optional(),
    activeOnly: z.boolean().optional(),
  }),
  run: (ctx, input) => {
    const { bookingType, activeOnly } = input as { bookingType?: string; activeOnly?: boolean };
    return listServices(ctx.tenantId, { bookingType, activeOnly: activeOnly ?? true });
  },
};

export const getAvailabilityTool: McpToolDefinition = {
  name: 'get_scheduling_availability',
  description:
    'Open booking slots for a service over a date range (ISO-8601 instants). Returns concrete start/end times the no-overlap engine will accept — only offer the customer times this returns.',
  scope: 'read:scheduling',
  confirmation: false,
  input: z.object({
    serviceId: z.string().uuid(),
    from: z.string().datetime(),
    to: z.string().datetime(),
    resourceId: z.string().uuid().optional(),
    partySize: z.number().int().min(1).max(100000).optional(),
  }),
  run: (ctx, input) =>
    getAvailability(ctx.tenantId, input as Parameters<typeof getAvailability>[1], Date.now()),
};

export const listBookingsTool: McpToolDefinition = {
  name: 'list_bookings',
  description:
    "List bookings, filtered by status, service, customer, or date range. Returns a page of bookings plus the total count. Use to check a customer's upcoming appointments or a day's schedule.",
  scope: 'read:scheduling',
  confirmation: false,
  input: z.object({
    status: z.string().max(20).optional(),
    bookingType: z.string().max(20).optional(),
    serviceId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    take: z.number().int().min(1).max(100).optional(),
    skip: z.number().int().min(0).optional(),
  }),
  run: (ctx, input) => listBookings(ctx.tenantId, input as Parameters<typeof listBookings>[1]),
};

export const getBookingTool: McpToolDefinition = {
  name: 'get_booking',
  description:
    'Fetch one booking by id with its service, assigned resources, and attendees — the full record for review before a reschedule or cancellation.',
  scope: 'read:scheduling',
  confirmation: false,
  input: z.object({ bookingId: z.string().uuid() }),
  run: (ctx, input) => getBooking(ctx.tenantId, (input as { bookingId: string }).bookingId),
};

export const readTools = [listServicesTool, getAvailabilityTool, listBookingsTool, getBookingTool];
