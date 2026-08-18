// Service input schemas — what can be booked (appointment / class / reservation / rental).
//
// A service carries its duration, buffers, price, capacity, the resource roles a
// booking must fill, the assignment strategy, and references to its deposit
// policy + intake form (docs/79 §14). The bookingType discriminator selects the
// engine behavior; everything else is configuration.
//
// Cross-field rules (e.g. "collective assignment needs ≥1 resource requirement")
// are enforced in the engine, not here, so Update can stay a plain `.partial()`.

import { z } from 'zod';

import {
  AssignmentStrategy,
  BookingType,
  HexColor,
  OptionalUuid,
  ResourceRequirement,
  Uuid,
} from './common';

export const CreateServiceInput = z.object({
  // The site offering this service (docs/131 §4). Optional so a tenant-wide
  // service can be authored explicitly; the dashboard route defaults it to the
  // site being worked in.
  propertyId: z.string().uuid().nullable().optional(),
  bookingType: BookingType.default('appointment'),
  name: z.string().min(1).max(255),
  description: z.string().max(10000).nullable().optional(),
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(60 * 24 * 30)
    .default(60),
  bufferBeforeMin: z.number().int().min(0).max(1440).default(0),
  bufferAfterMin: z.number().int().min(0).max(1440).default(0),
  priceCents: z.number().int().min(0).default(0),
  currency: z.string().length(3).default('usd'),
  // >1 for classes (roster size). Appointments / reservations / rentals keep 1.
  capacity: z.number().int().min(1).max(100000).default(1),
  assignmentStrategy: AssignmentStrategy.default('any_available'),
  resourceRequirements: z.array(ResourceRequirement).max(20).default([]),
  policyId: OptionalUuid,
  intakeFormId: OptionalUuid,
  locationId: OptionalUuid,
  minLeadMinutes: z.number().int().min(0).default(0),
  maxAdvanceDays: z.number().int().min(0).max(3650).default(365),
  slotIntervalMin: z.number().int().min(1).max(1440).default(15),
  color: HexColor.nullable().optional(),
  imageUrl: z.string().url().max(2048).nullable().optional(),
  bookableOnline: z.boolean().default(true),
  requiresApproval: z.boolean().default(false),
  isActive: z.boolean().default(true),
  // B2B / fleet: this service needs an asset (vehicle) on the booking.
  requiresAsset: z.boolean().default(false),
  settings: z.record(z.string(), z.unknown()).optional(),
});
export type CreateServiceInput = z.infer<typeof CreateServiceInput>;

export const UpdateServiceInput = CreateServiceInput.partial().extend({ id: Uuid });
export type UpdateServiceInput = z.infer<typeof UpdateServiceInput>;
