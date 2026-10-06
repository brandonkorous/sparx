// Shared commerce primitives used by orders + quotes.

import { z } from 'zod';

import { Uuid } from './common';

export const Currency = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/);
export type Currency = z.infer<typeof Currency>;

export const Money = z.number().nonnegative().multipleOf(0.01);

// Inline address snapshot for order/quote headers. Mirrors CustomerAddress
// but standalone (denormalized) so editing the customer's address later
// doesn't rewrite history.
export const AddressSnapshot = z.object({
  recipientName: z.string().max(255).optional(),
  company: z.string().max(255).optional(),
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  city: z.string().min(1).max(120),
  region: z.string().max(120).optional(),
  postalCode: z.string().max(32).optional(),
  country: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/, 'Country must be ISO 3166-1 alpha-2 (e.g. "US")'),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional(),
});
export type AddressSnapshot = z.infer<typeof AddressSnapshot>;

// Line-item shape shared by OrderItem and QuoteItem inputs. The CRM owns
// free-text sku/name today; a Products module FK lands later via the
// nullable productId/variantId.
export const LineItemInput = z
  .object({
    productId: Uuid.nullable().optional(),
    variantId: Uuid.nullable().optional(),
    sku: z.string().min(1).max(127),
    name: z.string().min(1).max(255),
    description: z.string().max(10_000).nullable().optional(),
    quantity: z.number().int().positive().default(1),
    unitPrice: Money.default(0),
    taxAmount: Money.default(0),
    discountAmount: Money.default(0),
    // Core charge per unit: a refundable deposit on a rebuilt part, paid on top of
    // the price and refunded when the old part comes back. Never discounted or
    // taxed, never in the line's subtotal. Null or absent = no core.
    coreCharge: Money.refine((dollars) => dollars > 0, {
      message: 'A core charge is more than $0. Leave it out to take no core.',
    })
      .nullable()
      .optional(),
    // Bought by sending the old part FIRST (issue 057): no deposit, and the line
    // ships when the old part arrives. Never together with a core charge.
    coreFirst: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((line) => !(line.coreFirst === true && line.coreCharge != null), {
    message: 'A line bought by sending the old part first carries no core deposit.',
    path: ['coreFirst'],
  });
export type LineItemInput = z.infer<typeof LineItemInput>;
