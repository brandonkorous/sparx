// Read-only scheduling MCP tools. Scope: 'read:scheduling'. No confirmation — the
// agent may call these freely to inspect services, open times, and bookings before
// proposing a change.

import { z } from 'zod';

import { getAvailability } from '../availability';
import { listAvailabilityWindows } from '../availability-rules';
import { getBooking, listBookings } from '../booking-queries';
import { listResources } from '../resources';
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

// ── Who/what does the work ───────────────────────────────────────────────────
// A service says what is bookable; a RESOURCE (a staff member, room, table, piece
// of equipment) is what actually has to be free for a slot to exist. When an agent
// is diagnosing "the service exists but nothing is bookable", these two reads are
// the answer: no matching resource, or a resource with no weekly hours.

export const listResourcesTool: McpToolDefinition = {
  name: 'list_scheduling_resources',
  description:
    "List the tenant's bookable resources — the staff, rooms, tables, or equipment a booking consumes. A service offers no times unless at least one ACTIVE, online-bookable resource of the kind it needs has weekly hours, so start here when availability comes back empty.",
  scope: 'read:scheduling',
  confirmation: false,
  input: z.object({
    kind: z.enum(['staff', 'room', 'table', 'equipment', 'vehicle', 'asset']).optional(),
    locationId: z.string().uuid().optional(),
    activeOnly: z.boolean().optional(),
  }),
  run: (ctx, input) => {
    const { kind, locationId, activeOnly } = input as {
      kind?: string;
      locationId?: string;
      activeOnly?: boolean;
    };
    return listResources(ctx.tenantId, {
      ...(kind !== undefined ? { kind } : {}),
      ...(locationId !== undefined ? { locationId } : {}),
      activeOnly: activeOnly ?? true,
    });
  },
};

export const listResourceHoursTool: McpToolDefinition = {
  name: 'list_resource_hours',
  description:
    "A resource's recurring weekly hours — the days and local times it is open for bookings. An empty list means the resource can never be booked, however many services point at it.",
  scope: 'read:scheduling',
  confirmation: false,
  input: z.object({ resourceId: z.string().uuid() }),
  run: (ctx, input) =>
    listAvailabilityWindows(ctx.tenantId, (input as { resourceId: string }).resourceId),
};

export const readTools = [
  listServicesTool,
  getAvailabilityTool,
  listBookingsTool,
  getBookingTool,
  listResourcesTool,
  listResourceHoursTool,
];
