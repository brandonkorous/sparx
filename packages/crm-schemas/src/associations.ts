// CRM associations — the write shapes for the relationship graph (docs/144 §6).
//
// An association says "these two records are related, and here is HOW". The
// motivating case is the one a single foreign key cannot express: a deal sold to
// three people — the one who signs it, the one who will use it, the one in
// accounts who pays the invoice.
//
// TWO THINGS THIS MODULE IS DELIBERATELY NOT:
//
//   • It does not replace `deals.customer_id` and the FKs like it. Those stay,
//     and the service keeps them in step with the association marked primary.
//   • It does not validate that an id exists. That needs a table lookup, which
//     needs a transaction, which belongs in the service — a schema that pretends
//     to check would be worse than one that visibly does not.

import { z } from 'zod';

import { Uuid } from './common';
import { ObjectDefKey } from './object-defs';

/**
 * The key of a relationship type. Same shape as an object key, because the same
 * rule applies: it appears in URLs, in exports, and in anything a tenant wires
 * to sparx.
 */
export const AssociationLabelKey = z
  .string()
  .min(2)
  .max(63)
  .regex(
    /^[a-z][a-z0-9_]*$/,
    'Use lowercase letters, numbers and underscores, starting with a letter.'
  );

/** One end of a relationship: which kind of record, and which one. */
export const AssociationEndpoint = z.object({
  objectKey: ObjectDefKey,
  recordId: Uuid,
});
export type AssociationEndpoint = z.infer<typeof AssociationEndpoint>;

export const CreateAssociationInput = z
  .object({
    fromType: ObjectDefKey,
    fromId: Uuid,
    toType: ObjectDefKey,
    toId: Uuid,
    /** Null / omitted = "related, but we have not said how yet". */
    labelKey: AssociationLabelKey.nullable().optional(),
    /**
     * Mirror this onto the legacy FK column. Defaults FALSE: promoting a link to
     * primary rewrites a column the reports read, so it has to be asked for.
     */
    isPrimary: z.boolean().optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((input) => !(input.fromType === input.toType && input.fromId === input.toId), {
    message: 'A record cannot be related to itself.',
    path: ['toId'],
  });
export type CreateAssociationInput = z.infer<typeof CreateAssociationInput>;

// No `.partial()` here: the only things worth changing about an existing link
// are its label and its note, and re-pointing an endpoint is a delete plus a
// create — pretending otherwise would let a caller silently move a relationship
// onto a different record while every audit row still named the old one.
export const UpdateAssociationInput = z.object({
  labelKey: AssociationLabelKey.nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});
export type UpdateAssociationInput = z.infer<typeof UpdateAssociationInput>;

export const ListAssociationsInput = z.object({
  objectKey: ObjectDefKey,
  recordId: Uuid,
  /** Only relationships pointing at this kind of record. */
  toType: ObjectDefKey.optional(),
  labelKey: AssociationLabelKey.optional(),
  take: z.number().int().min(1).max(250).optional(),
});
export type ListAssociationsInput = z.infer<typeof ListAssociationsInput>;

/* ── Labels ─────────────────────────────────────────────────────────────── */

export const CreateAssociationLabelInput = z.object({
  fromType: ObjectDefKey,
  toType: ObjectDefKey,
  key: AssociationLabelKey,
  label: z.string().min(1).max(120),
  /**
   * How the SAME relationship reads from the other end. Required, because a
   * missing inverse is what makes one side of a panel read backwards — "Decision
   * maker" on a contact, listing deals, is nonsense.
   */
  inverseLabel: z.string().min(1).max(120),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});
export type CreateAssociationLabelInput = z.infer<typeof CreateAssociationLabelInput>;

// `.partial()` is safe here — no field carries a `.default()`, so an omitted key
// stays omitted rather than being fabricated. (The trap it avoids is documented
// at length on UpdateDealInput.)
export const UpdateAssociationLabelInput = CreateAssociationLabelInput.partial().omit({
  fromType: true,
  toType: true,
  key: true,
});
export type UpdateAssociationLabelInput = z.infer<typeof UpdateAssociationLabelInput>;

/* ── The relationships sparx ships ──────────────────────────────────────── */

/**
 * Built-in labels, seeded on CRM activation.
 *
 * Chosen from what a business owner would actually say out loud, not from a CRM
 * vendor's vocabulary: "Signs it off", not "economic buyer". A tenant can rename
 * every one of them, and most will not need to.
 *
 * The inverse is written from the OTHER record's point of view, and reads as a
 * heading above a list — "Deals they decide on" sits above that person's deals.
 */
export const BUILTIN_ASSOCIATION_LABELS: {
  fromType: string;
  toType: string;
  key: string;
  label: string;
  inverseLabel: string;
  sortOrder: number;
}[] = [
  // A deal → the people involved in it. The case a single `customer_id` cannot
  // hold, and the reason this whole table exists.
  {
    fromType: 'deal',
    toType: 'contact',
    key: 'decision_maker',
    label: 'Signs it off',
    inverseLabel: 'Deals they sign off',
    sortOrder: 10,
  },
  {
    fromType: 'deal',
    toType: 'contact',
    key: 'main_contact',
    label: 'Main contact',
    inverseLabel: 'Deals they are the main contact on',
    sortOrder: 20,
  },
  {
    fromType: 'deal',
    toType: 'contact',
    key: 'end_user',
    label: 'Will use it',
    inverseLabel: 'Deals for something they will use',
    sortOrder: 30,
  },
  {
    fromType: 'deal',
    toType: 'contact',
    key: 'billing_contact',
    label: 'Handles the invoice',
    inverseLabel: 'Deals they handle the invoice for',
    sortOrder: 40,
  },

  // A company → its people.
  {
    fromType: 'company',
    toType: 'contact',
    key: 'employee',
    label: 'Works there',
    inverseLabel: 'Where they work',
    sortOrder: 10,
  },
  {
    fromType: 'company',
    toType: 'contact',
    key: 'billing_contact',
    label: 'Handles the invoices',
    inverseLabel: 'Companies they handle invoices for',
    sortOrder: 20,
  },

  // Company → company. A group with subsidiaries is a real thing a distributor
  // sells to, and today it can only be recorded in a note.
  {
    fromType: 'company',
    toType: 'company',
    key: 'parent',
    label: 'Part of',
    inverseLabel: 'Businesses under it',
    sortOrder: 10,
  },

  // Person → person. How referrals get recorded at all.
  {
    fromType: 'contact',
    toType: 'contact',
    key: 'referred_by',
    label: 'Introduced by',
    inverseLabel: 'People they introduced',
    sortOrder: 10,
  },

  // A request → who raised it and what it is about (Phase 4 gives `ticket` its
  // own table; the labels are harmless before then and stop a second seeding
  // step existing later).
  {
    fromType: 'ticket',
    toType: 'contact',
    key: 'raised_by',
    label: 'Raised by',
    inverseLabel: 'Requests they raised',
    sortOrder: 10,
  },
  {
    fromType: 'ticket',
    toType: 'deal',
    key: 'about_deal',
    label: 'About this deal',
    inverseLabel: 'Requests about this deal',
    sortOrder: 20,
  },
];
