// Finance input schemas (docs/148).
//
// Exported as the `@sparx/finance/schemas` subpath so a browser bundle can
// validate a form without pulling `@sparx/db` in behind it. Nothing here imports
// anything but zod — keep it that way, or the subpath stops being safe to import
// from the workbench.
//
// The vocabularies below are duplicated as CHECK constraints in the migration.
// That is deliberate rather than redundant: zod guards the writes we make, the
// CHECK guards the writes we forget, and a value that only one of them knows
// about is a bug either way.

import { z } from 'zod';

/* ── Vocabularies ──────────────────────────────────────────────────────────── */

/** How a category rolls up into the profit figure. `cost_of_sale` subtracts to
 *  GROSS profit; `labor` and `operating` subtract to NET. */
export const EXPENSE_KINDS = ['cost_of_sale', 'labor', 'operating'] as const;
export const expenseKindSchema = z.enum(EXPENSE_KINDS);
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

/** What produced an expense row. Only `manual` is freely editable — a derived row
 *  is corrected at its source, or the next derivation overwrites the edit. */
export const EXPENSE_SOURCES = [
    'manual',
    'recurring',
    'imported',
    'labor',
    'sparx_bill',
    'api',
] as const;
export const expenseSourceSchema = z.enum(EXPENSE_SOURCES);
export type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

export const PAYMENT_METHODS = ['card', 'bank', 'cash', 'check', 'other'] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** What a slice of spend was for. `site` allocates to a business without naming a
 *  job — the "this cost belongs to the shop, not to any one repair" case. */
export const ALLOCATION_TARGETS = ['order', 'booking', 'customer', 'product', 'site'] as const;
export const allocationTargetSchema = z.enum(ALLOCATION_TARGETS);
export type AllocationTarget = (typeof ALLOCATION_TARGETS)[number];

export const RECURRING_CADENCES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'] as const;
export const recurringCadenceSchema = z.enum(RECURRING_CADENCES);
export type RecurringCadence = (typeof RECURRING_CADENCES)[number];

export const ACCOUNTING_PROVIDERS = [
    'quickbooks_online',
    'quickbooks_desktop',
    'xero',
    'sage50',
    'freshbooks',
    'wave',
    'csv',
] as const;
export const accountingProviderSchema = z.enum(ACCOUNTING_PROVIDERS);
export type AccountingProvider = (typeof ACCOUNTING_PROVIDERS)[number];

/* ── Shared field shapes ───────────────────────────────────────────────────── */

const uuid = z.uuid();

/** Money, in minor units. Deliberately SIGNED: a vendor credit or a returned tool
 *  is negative spend, and forcing it positive means a second "credit" concept
 *  every report then has to remember to subtract. `.int()` because cents are not
 *  fractional and a rounding error here is money. */
const amountCents = z.int();

/** ISO-4217, upper-cased on the way in so 'usd' and 'USD' are one currency rather
 *  than two that never sum together. */
const currency = z
    .string()
    .length(3)
    .transform((value) => value.toUpperCase());

/** A hex swatch the tenant chose for their own category. User-picked data, not a
 *  design token — the same shape `SchedulingResource.color` already stores. */
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex color like #4F46E5');

/* ── Categories ────────────────────────────────────────────────────────────── */

export const createCategorySchema = z.object({
    name: z.string().trim().min(1).max(120),
    kind: expenseKindSchema.default('operating'),
    color: hexColor.nullish(),
    exportCode: z.string().trim().max(60).nullish(),
    sortOrder: z.int().default(0),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial().extend({ id: uuid });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

/* ── Vendors ───────────────────────────────────────────────────────────────── */

export const createVendorSchema = z.object({
    name: z.string().trim().min(1).max(200),
    supplierId: uuid.nullish(),
    companyId: uuid.nullish(),
    email: z.email().max(255).nullish(),
    phone: z.string().trim().max(40).nullish(),
    website: z.url().nullish(),
    address: z.string().trim().nullish(),
    accountRef: z.string().trim().max(120).nullish(),
    paymentTerms: z.string().trim().max(20).nullish(),
    notes: z.string().trim().nullish(),
});
export type CreateVendorInput = z.infer<typeof createVendorSchema>;

export const updateVendorSchema = createVendorSchema.partial().extend({ id: uuid });
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;

/* ── Allocations ───────────────────────────────────────────────────────────── */

export const allocationInputSchema = z.object({
    targetType: allocationTargetSchema,
    targetId: uuid,
    targetLabel: z.string().trim().max(200).nullish(),
    amountCents,
});
export type AllocationInput = z.infer<typeof allocationInputSchema>;

/* ── Expenses ──────────────────────────────────────────────────────────────── */

export const createExpenseSchema = z.object({
    propertyId: uuid.nullish(),
    categoryId: uuid,
    vendorId: uuid.nullish(),
    description: z.string().trim().min(1).max(300),
    amountCents,
    currency: currency.default('USD'),
    taxCents: z.int().min(0).default(0),
    incurredAt: z.coerce.date(),
    paidAt: z.coerce.date().nullish(),
    dueAt: z.coerce.date().nullish(),
    paymentMethod: paymentMethodSchema.nullish(),
    reference: z.string().trim().max(120).nullish(),
    notes: z.string().trim().nullish(),

    /**
     * Where the spend went. The service writes a single row when the caller names
     * one job, so the common case stays one click — but this is the ONLY path from
     * spend to a job. There is deliberately no `orderId` shortcut: a second path is
     * how half the spend goes missing from the report that joins the other one.
     */
    allocations: z.array(allocationInputSchema).default([]),
    attachmentAssetIds: z.array(uuid).default([]),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = createExpenseSchema
    .partial()
    .extend({ id: uuid })
    // `allocations` is a full REPLACE when present and untouched when absent —
    // a partial merge would make "remove the last allocation" unexpressible.
    .describe('Allocations, when present, replace the existing set in full');
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const listExpensesSchema = z.object({
    propertyId: uuid.nullish(),
    categoryId: uuid.nullish(),
    vendorId: uuid.nullish(),
    source: expenseSourceSchema.nullish(),
    /** Filter on `incurredAt` — the period the cost belongs to, never `paidAt`. */
    from: z.coerce.date().nullish(),
    to: z.coerce.date().nullish(),
    /** true = only unpaid (the payables view); false = only paid. */
    unpaidOnly: z.boolean().nullish(),
    search: z.string().trim().max(200).nullish(),
    limit: z.int().min(1).max(200).default(50),
    cursor: uuid.nullish(),
});
// NOTE: this is the SERVICE contract — real numbers, real booleans. It is not
// safe to hand `request.query` to directly, because every value there is a
// string and `z.int()` rejects "50". The route that reads it off a query string
// re-declares those two fields with `queryInt`/`queryBool` from
// `@sparx/api-core/query`; doing it there rather than here keeps this file's
// zod-only, browser-importable promise intact.
export type ListExpensesInput = z.infer<typeof listExpensesSchema>;

/* ── Recurring ─────────────────────────────────────────────────────────────── */

export const createRecurringSchema = z
    .object({
        propertyId: uuid.nullish(),
        name: z.string().trim().min(1).max(200),
        categoryId: uuid,
        vendorId: uuid.nullish(),
        amountCents,
        currency: currency.default('USD'),
        cadence: recurringCadenceSchema,
        dayOfMonth: z.int().min(1).max(31).nullish(),
        startsOn: z.coerce.date(),
        endsOn: z.coerce.date().nullish(),
        autoGenerate: z.boolean().default(true),
        isActive: z.boolean().default(true),
        notes: z.string().trim().nullish(),
    })
    .refine((value) => !value.endsOn || value.endsOn >= value.startsOn, {
        message: 'The end date cannot be before the start date',
        path: ['endsOn'],
    });
export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;

/** `.partial()` is unavailable on a refined object, so the update shape restates
 *  the fields and keeps the same cross-field rule. */
export const updateRecurringSchema = z
    .object({
        id: uuid,
        propertyId: uuid.nullish(),
        name: z.string().trim().min(1).max(200).optional(),
        categoryId: uuid.optional(),
        vendorId: uuid.nullish(),
        amountCents: amountCents.optional(),
        currency: currency.optional(),
        cadence: recurringCadenceSchema.optional(),
        dayOfMonth: z.int().min(1).max(31).nullish(),
        startsOn: z.coerce.date().optional(),
        endsOn: z.coerce.date().nullish(),
        autoGenerate: z.boolean().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().trim().nullish(),
    })
    .refine((value) => !value.endsOn || !value.startsOn || value.endsOn >= value.startsOn, {
        message: 'The end date cannot be before the start date',
        path: ['endsOn'],
    });
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;
