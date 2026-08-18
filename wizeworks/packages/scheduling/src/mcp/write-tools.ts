// Write scheduling MCP tools. Scope: 'write:scheduling', all confirmation-gated —
// the MCP server surfaces a destructiveHint so the client prompts the user before
// the booking lifecycle is touched. Each is a thin wrapper over the engine, so the
// no-overlap guarantee + state-machine rules apply identically to an MCP call.

import { z } from 'zod';

import {
  CancelBookingInput,
  CreateBookingInput,
  CreateLocation,
  CreateResourceInput,
  CreateServiceInput,
  RescheduleBookingInput,
  SetAvailabilityWindowsInput,
  UpdateLocationInput,
  UpdateResourceInput,
  UpdateServiceInput,
} from '@wizeworks/scheduling-schemas';

import { setAvailabilityWindows } from '../availability-rules';
import { cancelBooking, createBooking, rescheduleBooking } from '../booking-service';
import { createLocation, deleteLocation, updateLocation } from '../locations';
import { createResource, deleteResource, updateResource } from '../resources';
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

// ── Resources + hours (the other half of "set up the schedule") ──────────────
// A service on its own is inert. The availability engine offers a slot only when
// some ACTIVE, online-bookable resource of the kind the service needs is free for
// the whole span — and a resource with no weekly hours is never free. So an agent
// that can create services but not resources-and-hours still leaves the tenant's
// /book page empty, which is the same dead end `create_scheduling_service` was
// added to fix, one layer down. Creating a service, a resource, and that
// resource's hours is the complete "set up my schedule" path.

export const createResourceTool: McpToolDefinition = {
  name: 'create_scheduling_resource',
  description:
    'Create a bookable RESOURCE — the staff member, room, table, vehicle, or piece of equipment a booking actually occupies. Set `kind` and `name`; `timezone` (IANA, e.g. "America/Denver") should match where the work happens, since weekly hours are read in the resource\'s own zone. Services with no explicit requirements look for a `staff` resource, so that is the kind to create first. A new resource has NO hours yet — follow with set_resource_hours or it will never be offered.',
  scope: 'write:scheduling',
  confirmation: true,
  input: CreateResourceInput,
  run: (ctx, input) => createResource(ctx.tenantId, input as CreateResourceInput),
};

export const updateResourceTool: McpToolDefinition = {
  name: 'update_scheduling_resource',
  description:
    'Update a bookable resource by `id` — name, kind, timezone, capacity, skill tags, bookableOnline, isActive, and so on. Only the fields you pass change. Setting `isActive:false` or `bookableOnline:false` immediately withdraws every slot it was the only cover for.',
  scope: 'write:scheduling',
  confirmation: true,
  input: UpdateResourceInput,
  run: (ctx, input) => updateResource(ctx.tenantId, input as UpdateResourceInput),
};

export const deleteResourceTool: McpToolDefinition = {
  name: 'delete_scheduling_resource',
  description:
    'Soft-delete a bookable resource by `id`. Existing bookings keep their reference to it; it simply stops being offered. To pause someone temporarily use update_scheduling_resource with isActive:false instead.',
  scope: 'write:scheduling',
  confirmation: true,
  input: z.object({ id: z.string().uuid() }),
  run: (ctx, input) =>
    deleteResource(ctx.tenantId, (input as { id: string }).id).then(() => ({
      id: (input as { id: string }).id,
      deleted: true,
    })),
};

// ── Locations (where the work happens) ──────────────────────────────────────
// A resource and a service each point at a location, and a tenant that opens a
// second premises has to be able to say so. `propertyIds` scopes a location to
// particular sites — leave it empty and it serves all of them, which is right for
// the ordinary single-premises business.

export const createLocationTool: McpToolDefinition = {
  name: 'create_scheduling_location',
  description:
    'Create a business LOCATION — a physical place customers are served from (shop, clinic, studio, yard). Resources and services are then filed against it. `timezone` should be the IANA zone the place is in. Leave `propertyIds` empty unless the tenant runs several websites and this place only serves some of them.',
  scope: 'write:scheduling',
  confirmation: true,
  input: CreateLocation,
  run: (ctx, input) => createLocation(ctx.tenantId, input),
};

export const updateLocationTool: McpToolDefinition = {
  name: 'update_scheduling_location',
  description:
    'Update a location by `id` — name, address, timezone, map coordinates, isActive, or which sites it serves. Only the fields you pass change. `isActive:false` is the safe way to retire a place: it stops being offered while every past booking keeps its history.',
  scope: 'write:scheduling',
  confirmation: true,
  input: UpdateLocationInput,
  run: (ctx, input) => updateLocation(ctx.tenantId, input),
};

export const deleteLocationTool: McpToolDefinition = {
  name: 'delete_scheduling_location',
  description:
    'Delete a location by `id`. REFUSED (LOCATION_IN_USE) while any booking references it, because deleting would strip the place off that history — use update_scheduling_location with isActive:false instead. Resources and services filed there simply become unassigned.',
  scope: 'write:scheduling',
  confirmation: true,
  input: z.object({ id: z.string().uuid() }),
  run: (ctx, input) =>
    deleteLocation(ctx.tenantId, (input as { id: string }).id).then(() => ({
      id: (input as { id: string }).id,
      deleted: true,
    })),
};

export const setResourceHoursTool: McpToolDefinition = {
  name: 'set_resource_hours',
  description:
    "Set a resource's recurring weekly hours — the days and times it is open for bookings. REPLACES the whole week in one call, so send every window you want to keep: `dayOfWeek` 0=Sunday..6=Saturday, `startMinute`/`endMinute` as minutes from local midnight (9am = 540, 5pm = 1020). Send two windows on a day to model a lunch break. An empty `windows` array clears the schedule and stops the resource being offered at all. Times are read in the RESOURCE's timezone; `validFrom`/`validTo` (YYYY-MM-DD) bound a seasonal schedule.",
  scope: 'write:scheduling',
  confirmation: true,
  input: SetAvailabilityWindowsInput,
  run: (ctx, input) => setAvailabilityWindows(ctx.tenantId, input as SetAvailabilityWindowsInput),
};

export const writeTools = [
  createBookingTool,
  rescheduleBookingTool,
  cancelBookingTool,
  createServiceTool,
  updateServiceTool,
  deleteServiceTool,
  createResourceTool,
  updateResourceTool,
  deleteResourceTool,
  setResourceHoursTool,
  createLocationTool,
  updateLocationTool,
  deleteLocationTool,
];
