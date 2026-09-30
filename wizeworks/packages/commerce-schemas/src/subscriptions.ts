// Subscriptions — first-class auto-ship. Drives dogfood / diesel-additive
// recurring delivery. Backed by SubscriptionBilling provider (Stripe by
// default); the worker advances the schedule and emits an Order with
// channel='subscription' on each occurrence.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

import { ConfigurationSelection } from './bundles';
import { AddressSnapshot, Channel, Currency, MoneyCents } from './common';

export const SubscriptionStatus = z.enum(['trialing', 'active', 'past_due', 'paused', 'cancelled']);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;

export const IntervalUnit = z.enum(['day', 'week', 'month', 'year']);
export type IntervalUnit = z.infer<typeof IntervalUnit>;

export const SubscriptionScheduleInput = z.object({
  intervalUnit: IntervalUnit,
  intervalCount: z.number().int().positive().max(365),
  deliveriesPerCycle: z.number().int().positive().default(1),
  // Days of the month / week the renewal anchors to (when meaningful).
  anchorDayOfMonth: z.number().int().min(1).max(31).optional(),
  anchorDayOfWeek: z.number().int().min(0).max(6).optional(),
  endAfterOccurrences: z.number().int().positive().optional(),
  endOnDate: z.string().datetime().optional(),
});
export type SubscriptionScheduleInput = z.infer<typeof SubscriptionScheduleInput>;

export const SubscriptionItemInput = z.object({
  variantId: Uuid,
  quantity: z.number().int().positive().default(1),
  configuration: ConfigurationSelection.optional(),
  unitPriceCents: MoneyCents,
  // For configurator-driven add-ons rooted under another sub item.
  addonOfId: Uuid.optional(),
});
export type SubscriptionItemInput = z.infer<typeof SubscriptionItemInput>;

export const CreateSubscriptionInput = z
  .object({
    customerId: Uuid,
    /** Which SITE the customer signed up on (issue 878). A renewal creates a
     *  real Order months later, from this row alone, and an order with no site
     *  is in no site's takings and hidden from every member limited to named
     *  sites. Optional here and defaulted to the active site by the route, the
     *  same way a new order is. */
    propertyId: Uuid.optional(),
    channel: Channel.default('storefront'),
    currency: Currency,
    schedule: SubscriptionScheduleInput,
    items: z.array(SubscriptionItemInput).min(1).max(50),
    shippingAddress: AddressSnapshot,
    billingAddress: AddressSnapshot.optional(),
    paymentProviderSlug: z.string().min(1).max(63),
    /** How this subscription collects (docs/142 §8). `card` charges the saved
     *  method on each occurrence; `invoice` creates the order and emails a payment
     *  link, which is what a gateway without a vault gets and what an account on
     *  terms wants. */
    billingMode: z.enum(['card', 'invoice']).default('card'),
    /** The vaulted method to charge. Required on `card` — see the refine below. */
    paymentMethodId: Uuid.optional(),
    trialDays: z.number().int().nonnegative().max(365).optional(),
    startAt: z.string().datetime().optional(),
  })
  // The gap this closes: the field here used to be `paymentMethodRef`, a
  // required opaque string that `create()` never read and never stored. So every
  // caller was forced to supply a payment method, and every subscription was
  // created with no way to charge one — the silent failure at the centre of
  // docs/142. Refusing the combination is what stops it coming back in a new
  // shape.
  .refine((v) => v.billingMode !== 'card' || v.paymentMethodId !== undefined, {
    message:
      'A card subscription needs a saved payment method. Pass paymentMethodId, or use billingMode "invoice" to bill this customer instead.',
    path: ['paymentMethodId'],
  });
export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionInput>;

export const UpdateSubscriptionItemsInput = z.object({
  subscriptionId: Uuid,
  items: z.array(SubscriptionItemInput).min(1).max(50),
});
export type UpdateSubscriptionItemsInput = z.infer<typeof UpdateSubscriptionItemsInput>;

export const PauseSubscriptionInput = z.object({
  subscriptionId: Uuid,
  until: z.string().datetime().optional(), // null = indefinite
  reason: z.string().max(2000).optional(),
});
export type PauseSubscriptionInput = z.infer<typeof PauseSubscriptionInput>;

export const ResumeSubscriptionInput = z.object({
  subscriptionId: Uuid,
});
export type ResumeSubscriptionInput = z.infer<typeof ResumeSubscriptionInput>;

export const SkipNextOccurrenceInput = z.object({
  subscriptionId: Uuid,
  reason: z.string().max(2000).optional(),
});
export type SkipNextOccurrenceInput = z.infer<typeof SkipNextOccurrenceInput>;

export const CancelSubscriptionInput = z.object({
  subscriptionId: Uuid,
  atPeriodEnd: z.boolean().default(true),
  reason: z.string().max(2000).optional(),
});
export type CancelSubscriptionInput = z.infer<typeof CancelSubscriptionInput>;

/** Repoint a subscription at a different saved card, or switch it to invoicing.
 *  The recovery path for an expired or replaced card — without it a past_due
 *  subscription can only be fixed by cancelling and re-selling it. */
export const ChangeSubscriptionPaymentMethodInput = z
  .object({
    subscriptionId: Uuid,
    billingMode: z.enum(['card', 'invoice']).default('card'),
    paymentMethodId: Uuid.optional(),
  })
  .refine((v) => v.billingMode !== 'card' || v.paymentMethodId !== undefined, {
    message: 'Choose a saved card, or switch this repeat order to invoicing.',
    path: ['paymentMethodId'],
  });
export type ChangeSubscriptionPaymentMethodInput = z.infer<
  typeof ChangeSubscriptionPaymentMethodInput
>;

export const UpdateSubscriptionScheduleInput = z.object({
  subscriptionId: Uuid,
  schedule: SubscriptionScheduleInput,
});
export type UpdateSubscriptionScheduleInput = z.infer<typeof UpdateSubscriptionScheduleInput>;

export const ChangeSubscriptionAddressInput = z.object({
  subscriptionId: Uuid,
  shippingAddress: AddressSnapshot.optional(),
  billingAddress: AddressSnapshot.optional(),
});
export type ChangeSubscriptionAddressInput = z.infer<typeof ChangeSubscriptionAddressInput>;

// Dunning policy — how the platform retries a failed renewal charge.
// Stored per-tenant on `commerce_site_settings` and reused by every
// subscription unless overridden.
export const DunningPolicy = z.object({
  maxAttempts: z.number().int().min(1).max(10).default(4),
  retryDelaysHours: z.array(z.number().int().positive()).max(10).default([24, 72, 168, 336]),
  finalOutcome: z.enum(['cancel', 'pause', 'mark_past_due']).default('pause'),
  notifyCustomerOnFirstFailure: z.boolean().default(true),
  notifyCustomerOnFinalFailure: z.boolean().default(true),
});
export type DunningPolicy = z.infer<typeof DunningPolicy>;

/* ── What a repeat order is worth in a month ─────────────────────────────── */

/** One line of a repeat order, priced. */
export interface RepeatOrderLine {
  unitPriceCents: number;
  quantity: number;
}

export interface RepeatOrderValueInput {
  lines: readonly RepeatOrderLine[];
  /** An `IntervalUnit`, typed loosely because every caller reads it off a
   *  database row where it is a `VarChar`. */
  intervalUnit: string;
  intervalCount: number;
  deliveriesPerCycle: number;
}

/**
 * How many times a cadence comes round in a month.
 *
 * An unrecognized unit returns 0, which is what this has always done. Left
 * deliberately: the value is validated by `IntervalUnit` on the way in, so the
 * case is unreachable, and guessing a cadence would put a number on a screen
 * that nobody measured. If it ever becomes reachable the answer is "we cannot
 * say", not a fabricated month.
 */
export function monthlyOccurrenceFactor(unit: string, count: number): number {
  if (count <= 0) return 0;
  switch (unit) {
    case 'day':
      return 30 / count;
    case 'week':
      return 30 / (7 * count);
    case 'month':
      return 1 / count;
    case 'year':
      return 1 / (12 * count);
    default:
      return 0;
  }
}

/**
 * What a repeat order brings in per month.
 *
 * ONE function, called by the service that reports it on every list AND by the
 * console form that promises the shop owner a number while she is setting one
 * up. Two copies would be two answers to "what is this worth", and the one she
 * reads while agreeing it with a customer is the one she would never doubt.
 */
export function repeatOrderMonthlyCents(input: RepeatOrderValueInput): number {
  const perCycle = input.lines.reduce(
    (sum, line) => sum + Math.max(0, line.unitPriceCents) * Math.max(0, line.quantity),
    0
  );
  const factor = monthlyOccurrenceFactor(input.intervalUnit, input.intervalCount);
  return Math.round(perCycle * Math.max(0, input.deliveriesPerCycle) * factor);
}

/**
 * How many of a product go out in a YEAR on one repeat order.
 *
 * UNITS, and a YEAR, and both halves matter.
 *
 * A thing cannot be half sent. The product panel counted units by calling
 * `repeatOrderMonthlyCents` with a price of one, which rounds — so one scarf
 * every two months was reported as **1 a month**, twice what she owes, and one
 * every three months was reported as **0**. Three quarterly subscribers each
 * rounded to nothing and the panel told a shop owner she was committed to
 * sending nothing at all, beside "3 customers have it on repeat right now"
 * (issue 795). [[feedback_never_present_absence_as_measurement]]
 *
 * A year is the window in which every cadence a shop actually sells on lands on
 * a whole number, so it is the honest unit for a count of things.
 *
 * Returned UNROUNDED, because a caller summing several repeat orders must round
 * once at the end rather than once per order.
 */
export function repeatOrderYearlyUnits(input: {
  lines: readonly { quantity: number }[];
  intervalUnit: string;
  intervalCount: number;
  deliveriesPerCycle: number;
}): number {
  const perCycle = input.lines.reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
  const factor = monthlyOccurrenceFactor(input.intervalUnit, input.intervalCount);
  return perCycle * Math.max(0, input.deliveriesPerCycle) * factor * 12;
}

/**
 * When the next delivery falls, counting from `from`.
 *
 * Null for a unit this does not recognize, so the caller decides what an
 * unreadable cadence means: the service refuses it, and the console form that
 * shows the shop owner her first delivery date simply says nothing rather than
 * printing a date nobody worked out.
 *
 * Shared for the reason the money is shared. The form tells her "first delivery
 * on 19 October, then every month after that" BEFORE she agrees it with a
 * customer; the server decides the real date after. Two copies would let those
 * two dates differ, and the one she read out loud is the one she would be held
 * to.
 */
export function nextOccurrenceAfter(from: Date, unit: string, count: number): Date | null {
  const next = new Date(from);
  switch (unit) {
    case 'day':
      next.setUTCDate(next.getUTCDate() + count);
      return next;
    case 'week':
      next.setUTCDate(next.getUTCDate() + 7 * count);
      return next;
    case 'month':
      next.setUTCMonth(next.getUTCMonth() + count);
      return next;
    case 'year':
      next.setUTCFullYear(next.getUTCFullYear() + count);
      return next;
    default:
      return null;
  }
}
