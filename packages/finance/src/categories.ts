// Expense categories — the owner's words for what money went on.
//
// The seeded set below is the module's whole opinion about accounting, and it is
// deliberately small. A non-technical owner does not have a chart of accounts and
// will not build one; picking "6420 · Repairs & Maintenance" from a list of 180 is
// how the feature goes unused by week two. Nineteen buckets in plain language,
// each with its `kind` already correct, so most tenants never open this screen.
//
// Every seeded row is `isSystem` — renameable and recolorable (the owner's
// vocabulary wins over ours wherever it is only a label) but never deletable,
// because derivers find `wages` and `software` by slug.

import { withTenant, type FinanceExpenseCategory, type TxClient } from '@sparx/db';

import { CategoryInUseError, ExpenseCategoryNotFoundError, SystemCategoryError } from './errors';
import type { CreateCategoryInput, ExpenseKind, UpdateCategoryInput } from './schemas';

/** A seeded category. `slug` is the stable machine handle a deriver targets. */
export interface SeedCategory {
    slug: string;
    name: string;
    kind: ExpenseKind;
    sortOrder: number;
}

/**
 * The categories every finance tenant starts with.
 *
 * Two absences are deliberate:
 *
 *  - There is NO "stock purchases" / "inventory" category. Buying stock is not an
 *    expense — it converts cash into inventory value, which becomes cost when the
 *    goods sell, and `inventory_cost_consumption` already records that. A category
 *    here would invite someone to file a purchase order and double-count every
 *    part (docs/148 §1, locked decision #2).
 *  - There is NO "merchant/processor fees" category, for the same reason: the
 *    rollup reads fees from the order + payment tables. A hand-typed fee expense
 *    would be counted twice.
 */
export const SEED_CATEGORIES: readonly SeedCategory[] = [
    // What it costs to deliver the work itself.
    { slug: 'parts', name: 'Parts & materials', kind: 'cost_of_sale', sortOrder: 10 },
    { slug: 'subcontractors', name: 'Subcontractors', kind: 'cost_of_sale', sortOrder: 11 },
    { slug: 'freight', name: 'Freight & shipping', kind: 'cost_of_sale', sortOrder: 12 },

    // People. Separated from operating because for a service business this is the
    // largest single number, and burying it in "operating" makes the split useless.
    { slug: 'wages', name: 'Wages', kind: 'labor', sortOrder: 20 },
    { slug: 'payroll-taxes', name: 'Payroll taxes', kind: 'labor', sortOrder: 21 },
    { slug: 'staff-benefits', name: 'Staff benefits', kind: 'labor', sortOrder: 22 },

    // The cost of being open.
    { slug: 'rent', name: 'Rent', kind: 'operating', sortOrder: 30 },
    { slug: 'utilities', name: 'Utilities', kind: 'operating', sortOrder: 31 },
    { slug: 'insurance', name: 'Insurance', kind: 'operating', sortOrder: 32 },
    { slug: 'software', name: 'Software & subscriptions', kind: 'operating', sortOrder: 33 },
    { slug: 'marketing', name: 'Marketing & advertising', kind: 'operating', sortOrder: 34 },
    { slug: 'vehicle', name: 'Vehicle & fuel', kind: 'operating', sortOrder: 35 },
    { slug: 'equipment', name: 'Tools & equipment', kind: 'operating', sortOrder: 36 },
    { slug: 'repairs', name: 'Repairs & maintenance', kind: 'operating', sortOrder: 37 },
    { slug: 'professional', name: 'Accountant & legal', kind: 'operating', sortOrder: 38 },
    { slug: 'office', name: 'Office supplies', kind: 'operating', sortOrder: 39 },
    { slug: 'travel', name: 'Travel & meals', kind: 'operating', sortOrder: 40 },
    { slug: 'training', name: 'Training', kind: 'operating', sortOrder: 41 },
    { slug: 'bank-charges', name: 'Bank charges', kind: 'operating', sortOrder: 42 },
    { slug: 'other', name: 'Other', kind: 'operating', sortOrder: 99 },
];

/** Slugs a deriver depends on. Named so a future rename of the constant breaks
 *  loudly at compile time rather than quietly at runtime. */
export const WAGES_CATEGORY_SLUG = 'wages';
export const SOFTWARE_CATEGORY_SLUG = 'software';

/** What a seed run actually did. `created` is the honest measurement — see below. */
export interface SeedCategoriesResult {
    /** Every seeded category as it now stands, existing rows included. */
    categories: FinanceExpenseCategory[];
    /** How many rows this run BROUGHT INTO EXISTENCE. Zero on a repeat run. */
    created: number;
}

/**
 * Write the seeded set for a tenant. Idempotent on `(tenantId, slug)` — safe on
 * every module enable, which matters because a tenant can turn finance off and
 * back on and must not end up with two "Wages".
 *
 * Returns `created` separately from `categories` because the two are different
 * numbers and only one of them is a measurement. The upsert loop touches all
 * 20 rows on every run, so `categories.length` is 20 whether this call seeded a
 * brand-new tenant or re-ran against one that was already complete — reporting
 * it as "seeded" tells an operator that work happened when none did. The
 * pre-read below is what lets a repeat run say zero and mean it.
 *
 * Accepts an optional open transaction so an industry starter can stamp several
 * modules' presets atomically (the ModulePreset contract in @sparx/modules).
 */
export async function seedCategories(
    tenantId: string,
    tx?: TxClient
): Promise<SeedCategoriesResult> {
    const run = async (client: TxClient): Promise<SeedCategoriesResult> => {
        // Read before write, inside the same transaction, so the comparison can't
        // race a concurrent enable.
        const before = await client.financeExpenseCategory.findMany({
            where: { tenantId, slug: { in: SEED_CATEGORIES.map((s) => s.slug) } },
            select: { slug: true },
        });
        const existing = new Set(before.map((row) => row.slug));

        const categories: FinanceExpenseCategory[] = [];
        for (const seed of SEED_CATEGORIES) {
            categories.push(
                await client.financeExpenseCategory.upsert({
                    where: { tenantId_slug: { tenantId, slug: seed.slug } },
                    // Only ever writes the machine-owned fields. A tenant who renamed
                    // "Wages" to "Payroll" keeps their word through the next enable — an
                    // upsert that reset `name` would silently undo their edit.
                    update: { kind: seed.kind, isSystem: true },
                    create: {
                        tenantId,
                        slug: seed.slug,
                        name: seed.name,
                        kind: seed.kind,
                        isSystem: true,
                        sortOrder: seed.sortOrder,
                    },
                })
            );
        }

        return {
            categories,
            created: SEED_CATEGORIES.filter((seed) => !existing.has(seed.slug)).length,
        };
    };

    return tx ? run(tx) : withTenant({ tenantId }, run);
}

/** Resolve a seeded category by slug — how a deriver finds "the wages bucket"
 *  without matching on a name the owner is free to change. */
export async function categoryBySlug(
    tenantId: string,
    slug: string,
    tx?: TxClient
): Promise<FinanceExpenseCategory | null> {
    const run = (client: TxClient) =>
        client.financeExpenseCategory.findUnique({ where: { tenantId_slug: { tenantId, slug } } });
    return tx ? run(tx) : withTenant({ tenantId }, run);
}

export async function listCategories(
    tenantId: string,
    opts: { includeArchived?: boolean } = {}
): Promise<FinanceExpenseCategory[]> {
    return withTenant({ tenantId }, (tx) =>
        tx.financeExpenseCategory.findMany({
            where: opts.includeArchived ? {} : { archivedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })
    );
}

export async function createCategory(
    tenantId: string,
    input: CreateCategoryInput
): Promise<FinanceExpenseCategory> {
    return withTenant({ tenantId }, (tx) =>
        tx.financeExpenseCategory.create({
            data: {
                tenantId,
                // Tenant-invented categories carry no slug: the slug namespace belongs to
                // the seeded set that derivers address, and letting a tenant mint 'wages'
                // would let them collide with it.
                slug: null,
                name: input.name,
                kind: input.kind,
                color: input.color ?? null,
                exportCode: input.exportCode ?? null,
                sortOrder: input.sortOrder,
                isSystem: false,
            },
        })
    );
}

export async function updateCategory(
    tenantId: string,
    input: UpdateCategoryInput
): Promise<FinanceExpenseCategory> {
    const { id, ...rest } = input;
    return withTenant({ tenantId }, async (tx) => {
        const existing = await tx.financeExpenseCategory.findUnique({ where: { id } });
        if (!existing) throw new ExpenseCategoryNotFoundError(id);
        return tx.financeExpenseCategory.update({
            where: { id },
            data: {
                ...(rest.name !== undefined ? { name: rest.name } : {}),
                ...(rest.kind !== undefined ? { kind: rest.kind } : {}),
                ...(rest.color !== undefined ? { color: rest.color ?? null } : {}),
                ...(rest.exportCode !== undefined ? { exportCode: rest.exportCode ?? null } : {}),
                ...(rest.sortOrder !== undefined ? { sortOrder: rest.sortOrder } : {}),
            },
        });
    });
}

/** Hide a category without touching the history filed under it. This is what the
 *  UI offers instead of delete for anything already in use. */
export async function archiveCategory(
    tenantId: string,
    id: string,
    archived = true
): Promise<FinanceExpenseCategory> {
    return withTenant({ tenantId }, async (tx) => {
        const existing = await tx.financeExpenseCategory.findUnique({ where: { id } });
        if (!existing) throw new ExpenseCategoryNotFoundError(id);
        return tx.financeExpenseCategory.update({
            where: { id },
            data: { archivedAt: archived ? new Date() : null },
        });
    });
}

/**
 * Delete a category outright. Refuses a seeded one, and refuses one with spend
 * against it — the DB would refuse the second case anyway (ON DELETE RESTRICT),
 * but a foreign-key violation is not a sentence anyone can act on.
 */
export async function deleteCategory(tenantId: string, id: string): Promise<void> {
    await withTenant({ tenantId }, async (tx) => {
        const existing = await tx.financeExpenseCategory.findUnique({ where: { id } });
        if (!existing) throw new ExpenseCategoryNotFoundError(id);
        if (existing.isSystem) throw new SystemCategoryError(existing.name);

        const inUse = await tx.financeExpense.count({ where: { categoryId: id } });
        if (inUse > 0) throw new CategoryInUseError(existing.name, inUse);

        // A recurring template pointing here would also be orphaned by the delete
        // (ON DELETE RESTRICT again), and it is a likelier surprise than an expense:
        // a template generates silently, so nobody remembers it is there.
        const templates = await tx.financeRecurringExpense.count({ where: { categoryId: id } });
        if (templates > 0) throw new CategoryInUseError(existing.name, templates);

        await tx.financeExpenseCategory.delete({ where: { id } });
    });
}
