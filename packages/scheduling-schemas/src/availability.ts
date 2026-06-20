// Availability input schemas — recurring weekly windows, one-off exceptions, and
// the slot-availability query (docs/79 §7).
//
// Windows are authored in the resource's local zone (minutes from midnight);
// the engine resolves them DST-correctly. Exceptions override windows: time off,
// custom hours, blackout dates, special pricing. The query returns bookable
// start times for a service over a date range.

import { z } from 'zod';

import { ExceptionKind, MinuteOfDay, OptionalUuid, Uuid } from './common';

export const AvailabilityWindowInput = z.object({
  resourceId: Uuid,
  dayOfWeek: z.number().int().min(0).max(6), // 0=Sun .. 6=Sat
  startMinute: MinuteOfDay,
  endMinute: MinuteOfDay,
  // YYYY-MM-DD (DATE column). Regex rather than `.date()` for zod-version safety.
  validFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .nullable()
    .optional(),
  validTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .nullable()
    .optional(),
});
export type AvailabilityWindowInput = z.infer<typeof AvailabilityWindowInput>;

// Replace-all set for one resource (the editor saves the whole week at once).
export const SetAvailabilityWindowsInput = z.object({
  resourceId: Uuid,
  windows: z.array(AvailabilityWindowInput.omit({ resourceId: true })).max(100),
});
export type SetAvailabilityWindowsInput = z.infer<typeof SetAvailabilityWindowsInput>;

export const AvailabilityExceptionInput = z.object({
  // null resource = tenant / location-wide (e.g. a holiday closure).
  resourceId: OptionalUuid,
  locationId: OptionalUuid,
  kind: ExceptionKind,
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().max(2000).nullable().optional(),
  // custom_hours → { startMinute, endMinute }; special_price → { multiplier }.
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type AvailabilityExceptionInput = z.infer<typeof AvailabilityExceptionInput>;

export const UpdateAvailabilityExceptionInput = AvailabilityExceptionInput.partial().extend({
  id: Uuid,
});
export type UpdateAvailabilityExceptionInput = z.infer<typeof UpdateAvailabilityExceptionInput>;

// Slot query — "what start times can I book for this service in this window?"
export const AvailabilityQuery = z.object({
  serviceId: Uuid,
  from: z.string().datetime(),
  to: z.string().datetime(),
  // Restrict to one resource (e.g. a customer-chosen stylist).
  resourceId: OptionalUuid,
  locationId: OptionalUuid,
  // Reservations: only offer slots whose table fits the party.
  partySize: z.number().int().min(1).max(100000).optional(),
});
export type AvailabilityQuery = z.infer<typeof AvailabilityQuery>;

// A single offered slot returned by the engine (not an input, but the shared
// shape every transport renders).
export const AvailabilitySlot = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  // Candidate resource ids that are free for this slot, keyed by role.
  candidatesByRole: z.record(z.string(), z.array(Uuid)),
  // Remaining capacity (classes / pooled); 1 for exclusive single-resource slots.
  remaining: z.number().int().min(0),
});
export type AvailabilitySlot = z.infer<typeof AvailabilitySlot>;
