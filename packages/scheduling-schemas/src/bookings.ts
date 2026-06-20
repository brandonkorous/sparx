// Booking input schemas — create, reschedule, cancel, attendee lifecycle.
//
// The caller supplies the service, a start time, who it's for, and (optionally)
// preferred resources; the engine computes endAt from the service duration +
// buffers, allocates the required resource roles per the assignment strategy,
// and enforces the no-overlap guarantee at the DB tier (docs/79 §7). Status
// transitions (confirm / check-in / complete / no-show) are dedicated actions,
// not free-form status writes.

import { z } from 'zod';

import { AttendeeStatus, BookingSource, OptionalUuid, Uuid } from './common';

// One party member / class enrollee. For a 1:1 appointment the engine creates a
// single attendee from the booking's customer; classes & group bookings pass many.
export const BookingAttendeeInput = z.object({
  customerId: OptionalUuid,
  guestName: z.string().max(255).nullable().optional(),
  partySize: z.number().int().min(1).max(100000).default(1),
  // Per-attendee intake (e.g. each class member's waiver). Optional.
  intakeSubmissionId: OptionalUuid,
});
export type BookingAttendeeInput = z.infer<typeof BookingAttendeeInput>;

// A linked part expected for the service (B2B/fleet). Mirrors bookings.parts_linked.
export const LinkedPart = z.object({
  productId: OptionalUuid,
  sku: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  quantity: z.number().int().min(1).default(1),
});
export type LinkedPart = z.infer<typeof LinkedPart>;

export const CreateBookingInput = z.object({
  serviceId: Uuid,
  startAt: z.string().datetime(),
  // Display zone the customer booked in; defaults to the resource/location zone.
  timezone: z.string().min(1).max(64).optional(),

  // Who — appointment/reservation: customer on the booking; class: attendees[].
  customerId: OptionalUuid,
  b2bAccountId: OptionalUuid,
  partySize: z.number().int().min(1).max(100000).optional(),
  locationId: OptionalUuid,

  // Resource selection. Empty → engine assigns per strategy. For customer_choice
  // or explicit staff pick, name the resource id(s) to allocate.
  resourceIds: z.array(Uuid).max(20).default([]),

  // B2B / fleet context.
  assetRef: z.record(z.string(), z.unknown()).nullable().optional(),
  partsLinked: z.array(LinkedPart).max(200).default([]),
  workOrderId: OptionalUuid,

  // Class / group roster (omit for a plain 1:1 appointment).
  attendees: z.array(BookingAttendeeInput).max(1000).default([]),

  intakeSubmissionId: OptionalUuid,
  notes: z.string().max(5000).nullable().optional(),
  source: BookingSource.default('dashboard'),
});
export type CreateBookingInput = z.infer<typeof CreateBookingInput>;

// Staff-side edits that don't move the booking in time (those go through reschedule).
export const UpdateBookingInput = z.object({
  id: Uuid,
  notes: z.string().max(5000).nullable().optional(),
  staffNotes: z.string().max(10000).nullable().optional(),
  assetRef: z.record(z.string(), z.unknown()).nullable().optional(),
  partsLinked: z.array(LinkedPart).max(200).optional(),
  workOrderId: OptionalUuid,
  locationId: OptionalUuid,
});
export type UpdateBookingInput = z.infer<typeof UpdateBookingInput>;

export const RescheduleBookingInput = z.object({
  id: Uuid,
  startAt: z.string().datetime(),
  // Optionally re-pick resources; empty keeps the current allocation where free.
  resourceIds: z.array(Uuid).max(20).default([]),
  notifyCustomer: z.boolean().default(true),
});
export type RescheduleBookingInput = z.infer<typeof RescheduleBookingInput>;

export const CancelBookingInput = z.object({
  id: Uuid,
  reason: z.string().max(2000).nullable().optional(),
  // Override the policy fee (staff goodwill). Default applies the policy.
  waiveFee: z.boolean().default(false),
  notifyCustomer: z.boolean().default(true),
});
export type CancelBookingInput = z.infer<typeof CancelBookingInput>;

// Mark a no-show — captures any held no-show fee per policy unless waived.
export const NoShowBookingInput = z.object({
  id: Uuid,
  waiveFee: z.boolean().default(false),
});
export type NoShowBookingInput = z.infer<typeof NoShowBookingInput>;

export const CheckInInput = z.object({
  bookingId: Uuid,
  // For classes: check in a specific attendee; omit for a 1:1 appointment.
  attendeeId: OptionalUuid,
});
export type CheckInInput = z.infer<typeof CheckInInput>;

export const UpdateAttendeeInput = z.object({
  id: Uuid,
  status: AttendeeStatus.optional(),
  partySize: z.number().int().min(1).max(100000).optional(),
});
export type UpdateAttendeeInput = z.infer<typeof UpdateAttendeeInput>;
