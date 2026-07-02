// Bootcamp write + query schemas (docs/114 §B.5).

import { z } from 'zod';

import {
  BootcampFormat,
  BootcampStatus,
  CountryCode,
  IsoDateTime,
  RegistrationMode,
} from './common';

// ── Create (`POST /v1/partner/bootcamps`) ────────────────────────────────────
// slug is auto-generated from title in the service (globally unique).
export const CreateBootcampInput = z
  .object({
    title: z.string().trim().min(1).max(255),
    description: z.string().max(50_000).default(''),
    format: BootcampFormat.default('virtual'),
    locationCity: z.string().trim().max(160).nullable().optional(),
    locationState: z.string().trim().max(120).nullable().optional(),
    locationCountry: CountryCode.default('US'),
    startsAt: IsoDateTime,
    endsAt: IsoDateTime,
    seatsTotal: z.number().int().min(1).max(100_000).nullable().optional(),
    priceCents: z.number().int().min(0).default(0),
    currency: z.string().length(3).default('USD'),
    registrationMode: RegistrationMode.default('internal'),
    registrationUrl: z.string().trim().url().max(500).nullable().optional(),
  })
  .refine((v) => new Date(v.endsAt).getTime() >= new Date(v.startsAt).getTime(), {
    message: 'End must be on or after the start.',
    path: ['endsAt'],
  })
  .refine((v) => v.registrationMode !== 'external' || !!v.registrationUrl, {
    message: 'An external registration link is required for external registration.',
    path: ['registrationUrl'],
  });
export type CreateBootcampInput = z.infer<typeof CreateBootcampInput>;

// ── Update (`PUT /v1/partner/bootcamps/:id`) ─────────────────────────────────
// Explicit all-optional (no create defaults to clobber). No cross-field refine so
// a partial PATCH doesn't fail on absent counterparts; the service re-checks.
export const UpdateBootcampInput = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(50_000).optional(),
  format: BootcampFormat.optional(),
  locationCity: z.string().trim().max(160).nullable().optional(),
  locationState: z.string().trim().max(120).nullable().optional(),
  locationCountry: CountryCode.optional(),
  startsAt: IsoDateTime.optional(),
  endsAt: IsoDateTime.optional(),
  seatsTotal: z.number().int().min(1).max(100_000).nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  registrationMode: RegistrationMode.optional(),
  registrationUrl: z.string().trim().url().max(500).nullable().optional(),
});
export type UpdateBootcampInput = z.infer<typeof UpdateBootcampInput>;

// ── Lifecycle (`PATCH /v1/partner/bootcamps/:id/status`) ─────────────────────
// A partner can move draft↔published and to cancelled/completed. The service
// gates certified-only publish + emits bootcamp.published / .cancelled.
export const BootcampStatusInput = z.object({
  status: BootcampStatus,
});
export type BootcampStatusInput = z.infer<typeof BootcampStatusInput>;

// ── Public directory query (`GET /v1/public/bootcamps`) ──────────────────────
export const BootcampDirectoryQuery = z.object({
  format: BootcampFormat.optional(),
  // Free-text location match (city/state).
  location: z.string().trim().max(160).optional(),
  // ISO date-only range bounds (inclusive) on starts_at.
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  q: z.string().trim().max(120).optional(),
  cursor: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});
export type BootcampDirectoryQuery = z.infer<typeof BootcampDirectoryQuery>;

// ── Public internal RSVP (`POST /v1/public/bootcamps/:slug/register`) ────────
// On-platform registration → a lead in the host partner's CRM (docs/114 §B.5).
export const RegisterBootcampInput = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().toLowerCase().email().max(255),
  seats: z.coerce.number().int().min(1).max(20).default(1),
  // Honeypot — bots fill it; never persisted.
  company_website: z.string().max(0).optional(),
});
export type RegisterBootcampInput = z.infer<typeof RegisterBootcampInput>;
