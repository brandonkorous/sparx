// Scheduling module presets — starter "studio" packs: a booking policy, a set of
// bookable services, and one resource per vertical (salon, consultancy, fitness).
//
// At the composition root because the scheduling create services take a bare
// `tenantId` and open their OWN transaction (they can't compose into an open tx),
// so a multi-row pack written through them would not be atomic. The presets
// instead write raw Prisma on the open tenant tx (`sx.tx`) — one transaction, same
// RLS — exactly the rows those services would create.
//
// Scheduling activation seeds a "Standard" policy and a "Main location"; these
// packs reference the seeded location when present (locationId is optional) and
// add their OWN policy, so they never collide with the built-in "Standard".
//
// Data-as-code (line-limit exempt).

import { definePreset, type ModulePreset } from '@sparx/auth';
import type { TenantContext } from '@sparx/db';

interface PolicyDef {
  name: string;
  depositType: 'none' | 'card_hold' | 'deposit' | 'prepay';
  cancellationWindowHours: number;
  reminderOffsetsMin: number[];
  policyText: string;
  lateCancelFeeType?: 'fixed' | 'percent';
  lateCancelFeeValue?: number;
}

interface ServiceDef {
  name: string;
  bookingType: 'appointment' | 'class' | 'reservation' | 'rental';
  durationMinutes: number;
  priceCents: number;
  capacity: number;
  color: string;
}

interface ResourceDef {
  kind: 'staff' | 'asset' | 'table' | 'space' | 'equipment';
  name: string;
  color: string;
}

interface StudioSpec {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  policy: PolicyDef;
  services: ServiceDef[];
  resource: ResourceDef;
}

/** Stamp the policy + services + resource on the open tenant tx (one atomic
 *  install). References the activation-seeded "Main location" when present. */
async function buildStudio(sx: TenantContext, spec: StudioSpec): Promise<{ id: string }> {
  const location = await sx.tx!.businessLocation.findFirst({
    where: { tenantId: sx.tenantId, name: 'Main location' },
    select: { id: true },
  });
  const locationId = location?.id ?? null;

  const policy = await sx.tx!.bookingPolicy.create({
    data: {
      tenantId: sx.tenantId,
      name: spec.policy.name,
      depositType: spec.policy.depositType,
      cancellationWindowHours: spec.policy.cancellationWindowHours,
      reminderOffsetsMin: spec.policy.reminderOffsetsMin,
      policyText: spec.policy.policyText,
      lateCancelFeeType: spec.policy.lateCancelFeeType ?? null,
      lateCancelFeeValue: spec.policy.lateCancelFeeValue ?? null,
    },
    select: { id: true },
  });

  for (const service of spec.services) {
    await sx.tx!.schedulingService.create({
      data: {
        tenantId: sx.tenantId,
        bookingType: service.bookingType,
        name: service.name,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
        capacity: service.capacity,
        color: service.color,
        policyId: policy.id,
        locationId,
      },
    });
  }

  await sx.tx!.schedulingResource.create({
    data: {
      tenantId: sx.tenantId,
      kind: spec.resource.kind,
      name: spec.resource.name,
      color: spec.resource.color,
      skillTags: [],
      locationId,
    },
  });

  return { id: policy.id };
}

function studioPreset(spec: StudioSpec): ModulePreset {
  return definePreset({
    module: 'scheduling',
    slug: spec.slug,
    kind: 'scheduling',
    name: spec.name,
    description: spec.description,
    iconKey: spec.iconKey,
    tags: ['scheduling', 'booking', ...spec.tags],
    summary: [
      { label: spec.services.map((s) => s.name).join(' · '), tone: 'neutral' },
      { label: `${spec.services.length} services + policy`, tone: 'module' },
    ],
    // Installed ⇔ this pack's policy exists (its sentinel — a distinct name from
    // the built-in "Standard").
    marker: (tx, tenantId) =>
      tx.bookingPolicy
        .findFirst({ where: { tenantId, name: spec.policy.name }, select: { id: true } })
        .then(Boolean),
    build: (sx: TenantContext) => buildStudio(sx, spec),
  });
}

/** Every scheduling module preset, in picker order. */
export const schedulingPresets: ModulePreset[] = [
  studioPreset({
    slug: 'salon-spa',
    name: 'Salon & spa',
    description:
      'A starter booking setup for a salon or spa — cut, color, and manicure appointments, a stylist resource, and a 24-hour cancellation policy with a late-cancel fee.',
    iconKey: 'scissors',
    tags: ['salon', 'spa', 'beauty', 'appointments'],
    policy: {
      name: 'Salon cancellation',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText: 'Please give at least 24 hours notice to cancel or reschedule.',
      lateCancelFeeType: 'fixed',
      lateCancelFeeValue: 2500,
    },
    services: [
      {
        name: 'Women’s cut & style',
        bookingType: 'appointment',
        durationMinutes: 60,
        priceCents: 6500,
        capacity: 1,
        color: '#EC4899',
      },
      {
        name: 'Men’s cut',
        bookingType: 'appointment',
        durationMinutes: 30,
        priceCents: 3500,
        capacity: 1,
        color: '#6366F1',
      },
      {
        name: 'Color & highlights',
        bookingType: 'appointment',
        durationMinutes: 120,
        priceCents: 12000,
        capacity: 1,
        color: '#8B5CF6',
      },
      {
        name: 'Manicure',
        bookingType: 'appointment',
        durationMinutes: 45,
        priceCents: 4000,
        capacity: 1,
        color: '#F59E0B',
      },
    ],
    resource: { kind: 'staff', name: 'Stylist', color: '#EC4899' },
  }),
  studioPreset({
    slug: 'professional-consults',
    name: 'Professional consultations',
    description:
      'A starter setup for consultants and professional services — a free discovery call, a paid strategy session, and a follow-up, with a consultant resource and a 24-hour policy.',
    iconKey: 'briefcase',
    tags: ['consulting', 'professional', 'services', 'appointments'],
    policy: {
      name: 'Consultation policy',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 60],
      policyText:
        'Please reschedule at least 24 hours ahead so we can offer the slot to someone else.',
    },
    services: [
      {
        name: 'Discovery call',
        bookingType: 'appointment',
        durationMinutes: 30,
        priceCents: 0,
        capacity: 1,
        color: '#06B6D4',
      },
      {
        name: 'Strategy session',
        bookingType: 'appointment',
        durationMinutes: 60,
        priceCents: 20000,
        capacity: 1,
        color: '#6366F1',
      },
      {
        name: 'Follow-up',
        bookingType: 'appointment',
        durationMinutes: 30,
        priceCents: 10000,
        capacity: 1,
        color: '#10B981',
      },
    ],
    resource: { kind: 'staff', name: 'Consultant', color: '#6366F1' },
  }),
  studioPreset({
    slug: 'fitness-classes',
    name: 'Fitness & classes',
    description:
      'A starter setup for a studio or gym — group fitness and yoga classes with seats, plus 1-on-1 personal training, a studio space resource, and a 12-hour cancellation policy.',
    iconKey: 'dumbbell',
    tags: ['fitness', 'gym', 'classes', 'studio'],
    policy: {
      name: 'Class policy',
      depositType: 'none',
      cancellationWindowHours: 12,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Cancel at least 12 hours before class to free your spot and avoid losing the credit.',
    },
    services: [
      {
        name: 'Group fitness class',
        bookingType: 'class',
        durationMinutes: 45,
        priceCents: 2000,
        capacity: 12,
        color: '#F59E0B',
      },
      {
        name: 'Yoga class',
        bookingType: 'class',
        durationMinutes: 60,
        priceCents: 2200,
        capacity: 15,
        color: '#10B981',
      },
      {
        name: 'Personal training',
        bookingType: 'appointment',
        durationMinutes: 60,
        priceCents: 7500,
        capacity: 1,
        color: '#6366F1',
      },
    ],
    resource: { kind: 'space', name: 'Studio', color: '#F59E0B' },
  }),
];
