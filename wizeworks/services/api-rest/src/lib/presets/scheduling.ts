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

import { definePreset, type ModulePreset } from '@wizeworks/auth';
import type { TenantContext } from '@wizeworks/db';

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
  // Per-vertical booking model (docs/79 §7.5). Omitted = 'any_available'. A salon
  // guest picks their stylist (`customer_choice`); a service desk round-robins.
  // Correct from day one so the storefront widget behaves right as the tenant adds
  // staff — even though the starter pack ships a single resource.
  assignmentStrategy?: 'any_available' | 'round_robin' | 'collective' | 'customer_choice';
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
        assignmentStrategy: service.assignmentStrategy ?? 'any_available',
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
    // Salon guests book with a stylist by name — every service is `customer_choice`.
    services: [
      {
        name: 'Women’s cut & style',
        bookingType: 'appointment',
        durationMinutes: 60,
        priceCents: 6500,
        capacity: 1,
        color: '#EC4899',
        assignmentStrategy: 'customer_choice',
      },
      {
        name: 'Men’s cut',
        bookingType: 'appointment',
        durationMinutes: 30,
        priceCents: 3500,
        capacity: 1,
        color: '#6366F1',
        assignmentStrategy: 'customer_choice',
      },
      {
        name: 'Color & highlights',
        bookingType: 'appointment',
        durationMinutes: 120,
        priceCents: 12000,
        capacity: 1,
        color: '#8B5CF6',
        assignmentStrategy: 'customer_choice',
      },
      {
        name: 'Manicure',
        bookingType: 'appointment',
        durationMinutes: 45,
        priceCents: 4000,
        capacity: 1,
        color: '#F59E0B',
        assignmentStrategy: 'customer_choice',
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
    // The free intro round-robins across the team; paid sessions are booked with a
    // specific consultant by name (`customer_choice`).
    services: [
      {
        name: 'Discovery call',
        bookingType: 'appointment',
        durationMinutes: 30,
        priceCents: 0,
        capacity: 1,
        color: '#06B6D4',
        assignmentStrategy: 'round_robin',
      },
      {
        name: 'Strategy session',
        bookingType: 'appointment',
        durationMinutes: 60,
        priceCents: 20000,
        capacity: 1,
        color: '#6366F1',
        assignmentStrategy: 'customer_choice',
      },
      {
        name: 'Follow-up',
        bookingType: 'appointment',
        durationMinutes: 30,
        priceCents: 10000,
        capacity: 1,
        color: '#10B981',
        assignmentStrategy: 'customer_choice',
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
    // Group classes stay `any_available` (you book a seat, not an instructor);
    // 1-on-1 personal training is booked with your trainer (`customer_choice`).
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
        assignmentStrategy: 'customer_choice',
      },
    ],
    resource: { kind: 'space', name: 'Studio', color: '#F59E0B' },
  }),
  // Florist — the one vertical that is a CLASS and an APPOINTMENT at once, and
  // the reason it needs a preset of its own rather than borrowing one.
  //
  // `fitness-classes` is the right SHAPE (seats, a class policy) and the wrong
  // WORDS: these presets author named services, so a flower shop that reused it
  // would open its calendar on "Yoga class". `salon-spa` has the same problem in
  // the other direction — every service `customer_choice`, which is right for a
  // stylist and wrong for a workshop bench where you are buying a seat, not a
  // person.
  //
  // So: workshops are `class` + `any_available` (a seat), consultations are
  // `appointment` + `customer_choice` (the florist doing your wedding is a
  // person you met). The deposit is real — a wedding consultation that no-shows
  // costs an hour of the owner's Saturday, and every florist takes one.
  studioPreset({
    slug: 'florist-workshops',
    name: 'Florist workshops & consultations',
    description:
      'A starter booking setup for a flower shop — evening and weekend workshops sold by the seat, plus wedding and sympathy consultations, a workshop bench resource, and a 48-hour policy with a deposit on wedding work.',
    iconKey: 'flower',
    tags: ['florist', 'flowers', 'workshops', 'weddings'],
    policy: {
      name: 'Workshop & consultation policy',
      // `deposit`, not `prepay`: a workshop seat is held with money down and the
      // balance settles on the day, which is how every florist runs one. The
      // AMOUNT is not a policy field — the late-cancel fee below is the only
      // figure this shape carries, and the deposit value is set per service in
      // Bookings after install.
      depositType: 'deposit',
      // 48 rather than 24: the stems for a workshop are ordered from the grower
      // two days out and cannot be un-ordered. A day's notice does not help a
      // florist the way it helps a salon.
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 240],
      policyText:
        'Workshop places can be moved or cancelled up to 48 hours before — after that the flowers are already cut and ordered for you. Wedding consultations take a deposit that comes off your final quote.',
      lateCancelFeeType: 'fixed',
      lateCancelFeeValue: 2500,
    },
    services: [
      {
        name: 'Wreath workshop',
        bookingType: 'class',
        durationMinutes: 120,
        priceCents: 7500,
        capacity: 8,
        color: '#C2410C',
      },
      {
        name: 'Hand-tied bouquet evening',
        bookingType: 'class',
        durationMinutes: 120,
        priceCents: 6800,
        capacity: 8,
        color: '#EC4899',
      },
      {
        name: 'Wedding consultation',
        bookingType: 'appointment',
        durationMinutes: 60,
        priceCents: 0,
        capacity: 1,
        color: '#7E22CE',
        assignmentStrategy: 'customer_choice',
      },
      {
        name: 'Sympathy & tribute order',
        bookingType: 'appointment',
        durationMinutes: 30,
        priceCents: 0,
        capacity: 1,
        color: '#0E7490',
      },
    ],
    resource: { kind: 'space', name: 'Workshop bench', color: '#C2410C' },
  }),
];
