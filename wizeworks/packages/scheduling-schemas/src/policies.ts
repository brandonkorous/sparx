// Booking-policy input schemas — deposits, no-show / late-cancel fees, reminders.
//
// Tock-style per-service protection (docs/79 §9): a policy picks none / card_hold
// / deposit / prepay, sets the cancellation window + fees, the policy text the
// customer accepts at booking (dispute evidence), and the reminder cadence.

import { z } from 'zod';

import { DepositType, FeeType, Uuid } from './common';

export const CreateBookingPolicyInput = z.object({
  name: z.string().min(1).max(255),
  depositType: DepositType.default('none'),
  // Exactly one of amount / percent is used, by depositType — engine enforces.
  depositAmountCents: z.number().int().min(0).nullable().optional(),
  depositPercent: z.number().int().min(0).max(100).nullable().optional(),
  cancellationWindowHours: z.number().int().min(0).max(8760).default(24),
  lateCancelFeeType: FeeType.nullable().optional(),
  lateCancelFeeValue: z.number().int().min(0).nullable().optional(),
  noShowFeeType: FeeType.nullable().optional(),
  noShowFeeValue: z.number().int().min(0).nullable().optional(),
  policyText: z.string().max(20000).nullable().optional(),
  // Minutes-before-start to send reminders, e.g. [1440, 120] = 24h + 2h.
  reminderOffsetsMin: z.array(z.number().int().min(0).max(43200)).max(10).default([1440, 120]),
});
export type CreateBookingPolicyInput = z.infer<typeof CreateBookingPolicyInput>;

export const UpdateBookingPolicyInput = CreateBookingPolicyInput.partial().extend({ id: Uuid });
export type UpdateBookingPolicyInput = z.infer<typeof UpdateBookingPolicyInput>;
