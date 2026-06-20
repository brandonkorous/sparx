// Shared primitive + enum schemas for the Scheduling module (docs/79).
//
// One file for the leaf shapes that recur across resources, services, bookings,
// availability, policies, and calendar sync — so a constraint or enum change
// happens in exactly one place. Every enum here mirrors a `@db.VarChar` column
// in 78-scheduling.prisma; the service layer validates against these before any
// Prisma write, keeping column + JSONB writes type-safe across REST / Server
// Actions / MCP.

import { z } from 'zod';

export const Uuid = z.string().uuid();
export const OptionalUuid = Uuid.nullable().optional();

// IANA time zone (e.g. "America/Denver"). Length mirrors the VARCHAR(64) column.
export const Timezone = z.string().min(1).max(64);

// #RRGGBB — matches the VARCHAR(7) calendar/color columns.
export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a #RRGGBB hex color');

// ISO-8601 instant (UTC `Z` form). Stored as timestamptz; the API normalizes
// any offset to UTC before validation, and the engine resolves display zones
// from the resource/location (docs/79 §7.7).
export const IsoDateTime = z.string().datetime();

// Minutes from local midnight, 0..1440 — availability window bounds.
export const MinuteOfDay = z.number().int().min(0).max(1440);

// ── Enums — each mirrors a column's documented value set in 78-scheduling.prisma ──

export const ResourceKind = z.enum(['staff', 'asset', 'table', 'space', 'equipment']);
export type ResourceKind = z.infer<typeof ResourceKind>;

export const BookingType = z.enum(['appointment', 'class', 'reservation', 'rental']);
export type BookingType = z.infer<typeof BookingType>;

export const BookingStatus = z.enum([
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'waitlisted',
]);
export type BookingStatus = z.infer<typeof BookingStatus>;

export const AssignmentStrategy = z.enum([
  'any_available',
  'round_robin',
  'collective',
  'customer_choice',
]);
export type AssignmentStrategy = z.infer<typeof AssignmentStrategy>;

export const AttendeeStatus = z.enum([
  'booked',
  'checked_in',
  'attended',
  'no_show',
  'cancelled',
  'waitlisted',
]);
export type AttendeeStatus = z.infer<typeof AttendeeStatus>;

export const DepositType = z.enum(['none', 'card_hold', 'deposit', 'prepay']);
export type DepositType = z.infer<typeof DepositType>;

export const DepositStatus = z.enum(['none', 'held', 'captured', 'refunded', 'forfeited']);
export type DepositStatus = z.infer<typeof DepositStatus>;

export const FeeType = z.enum(['fixed', 'percent']);
export type FeeType = z.infer<typeof FeeType>;

// Where a booking originated. Mirrors bookings.source.
export const BookingSource = z.enum([
  'site',
  'portal',
  'dashboard',
  'mcp',
  'phone',
  'marketplace',
  'api',
]);
export type BookingSource = z.infer<typeof BookingSource>;

export const ExceptionKind = z.enum(['closed', 'custom_hours', 'blackout', 'special_price']);
export type ExceptionKind = z.infer<typeof ExceptionKind>;

export const WaitlistStatus = z.enum(['waiting', 'offered', 'booked', 'expired', 'cancelled']);
export type WaitlistStatus = z.infer<typeof WaitlistStatus>;

// Calendar sync (docs/79 §8).
export const CalendarProvider = z.enum(['google', 'microsoft', 'apple_caldav', 'caldav']);
export type CalendarProvider = z.infer<typeof CalendarProvider>;

export const ConnectionKind = z.enum(['oauth', 'caldav', 'ical_feed']);
export type ConnectionKind = z.infer<typeof ConnectionKind>;

export const CredentialSource = z.enum(['platform', 'tenant_byo']);
export type CredentialSource = z.infer<typeof CredentialSource>;

export const SyncDirection = z.enum(['in', 'out', 'two_way']);
export type SyncDirection = z.infer<typeof SyncDirection>;

// Notifications (docs/79 §10).
export const NotificationType = z.enum([
  'confirmation',
  'reminder',
  'change',
  'cancellation',
  'followup',
  'waitlist_offer',
]);
export type NotificationType = z.infer<typeof NotificationType>;

export const NotificationChannel = z.enum(['email', 'sms', 'push']);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

// A single required-resource role on a service (stored in
// scheduling_services.resource_requirements JSONB). The slot engine resolves a
// concurrently-free candidate per role at booking time (docs/79 §7.2/§7.5).
export const ResourceRequirement = z.object({
  // Logical role label echoed onto booking_resources.role (e.g. "stylist", "chair").
  role: z.string().min(1).max(40),
  kind: ResourceKind,
  // Candidate must carry every listed skill tag (subset match).
  skillTags: z.array(z.string().min(1).max(63)).max(20).default([]),
  // How many distinct resources of this role the booking consumes at once.
  count: z.number().int().min(1).max(20).default(1),
});
export type ResourceRequirement = z.infer<typeof ResourceRequirement>;
