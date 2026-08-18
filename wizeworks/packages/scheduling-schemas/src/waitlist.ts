// Waitlist input schemas (docs/79 §5/§7).
//
// Service-level waitlist: "notify me when this service has an opening in this
// window (optionally with this resource)." Session-level waiting (a specific
// full class) is modeled as a BookingAttendee with status `waitlisted`; this is
// the broader "any opening" intent. The worker auto-promotes on cancellation.

import { z } from 'zod';

import { OptionalUuid, Uuid } from './common';

export const CreateWaitlistEntryInput = z.object({
  serviceId: Uuid,
  customerId: Uuid,
  // Preferred staff/resource (e.g. a specific artist). Optional.
  resourcePref: OptionalUuid,
  desiredFrom: z.string().datetime(),
  desiredTo: z.string().datetime(),
});
export type CreateWaitlistEntryInput = z.infer<typeof CreateWaitlistEntryInput>;

// Offer a freed slot to the next waiting customer (worker / staff action).
export const OfferWaitlistInput = z.object({
  id: Uuid,
  // How long the held offer stays open before auto-expiring to the next in line.
  offerTtlMinutes: z.number().int().min(5).max(1440).default(60),
});
export type OfferWaitlistInput = z.infer<typeof OfferWaitlistInput>;

// Accept an offer by booking a concrete slot in the entry's window. The slot must
// fall inside [desiredFrom, desiredTo]; the engine books it and marks the entry
// `booked` (a lost race surfaces as SLOT_UNAVAILABLE, leaving the offer open).
export const AcceptWaitlistInput = z.object({
  id: Uuid,
  startAt: z.string().datetime(),
  resourceIds: z.array(Uuid).max(20).default([]),
});
export type AcceptWaitlistInput = z.infer<typeof AcceptWaitlistInput>;
