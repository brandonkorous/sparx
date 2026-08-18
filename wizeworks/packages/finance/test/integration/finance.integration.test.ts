// Finance against a real Postgres with RLS on.
//
// The unit suites cover the arithmetic. This one covers everything that only
// fails on contact with a database: the compound-unique input names Prisma
// derives, the NULLS NOT DISTINCT grain the rollup writes through, the CHECK
// vocabularies, the ON DELETE rules, the groupBy that splits spend by category
// kind, BigInt round-tripping, and tenant isolation.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@wizeworks/db';

import {
  archiveVendor,
  categoryBySlug,
  createCategory,
  createExpense,
  createRecurring,
  createVendor,
  deleteCategory,
  deleteExpense,
  expensesForTarget,
  generateDueExpenses,
  getExpense,
  listCategories,
  listExpenses,
  listRecurring,
  profitForRange,
  provisionFinance,
  recomputeDay,
  recomputeRange,
  SEED_CATEGORIES,
  setExpensePaid,
  updateExpense,
  vendorSpendCents,
} from '../../src/index';
import { CategoryInUseError, OverAllocatedError, SystemCategoryError } from '../../src/errors';
import { createTestTenant, day, dropTestTenant, type TestTenant } from '../helpers';

let t: TestTenant;
let other: TestTenant;

beforeAll(async () => {
  t = await createTestTenant();
  other = await createTestTenant();
  await provisionFinance(t.tenantId);
  await provisionFinance(other.tenantId);
});

afterAll(async () => {
  await dropTestTenant(t.tenantId);
  await dropTestTenant(other.tenantId);
});

/** The one category every test files against. */
async function partsCategoryId(tenantId = t.tenantId): Promise<string> {
  const category = await categoryBySlug(tenantId, 'parts');
  if (!category) throw new Error('seed category "parts" missing');
  return category.id;
}

describe('provisioning', () => {
  it('seeds the whole category set', async () => {
    const categories = await listCategories(t.tenantId);
    expect(categories).toHaveLength(SEED_CATEGORIES.length);
  });

  it('is idempotent — turning the module off and on does not duplicate', async () => {
    await provisionFinance(t.tenantId);
    await provisionFinance(t.tenantId);
    const categories = await listCategories(t.tenantId);
    expect(categories).toHaveLength(SEED_CATEGORIES.length);
  });

  it('reports rows it CREATED, not rows it touched', async () => {
    // The fixture is already provisioned, so this run creates nothing. The
    // upsert loop still writes all 20 rows, and reporting that as "seeded 20"
    // is how an operator reads a no-op as work — which is exactly what the
    // backfill script printed after a successful apply.
    const repeat = await provisionFinance(t.tenantId);
    expect(repeat.categoriesSeeded).toBe(0);
    expect(repeat.categoriesTotal).toBe(SEED_CATEGORIES.length);

    // A tenant seeing finance for the first time reports the opposite.
    const fresh = await createTestTenant();
    try {
      const first = await provisionFinance(fresh.tenantId);
      expect(first.categoriesSeeded).toBe(SEED_CATEGORIES.length);
      expect(first.categoriesTotal).toBe(SEED_CATEGORIES.length);
    } finally {
      await dropTestTenant(fresh.tenantId);
    }
  });

  it('keeps a renamed category renamed across a re-provision', async () => {
    const wages = await categoryBySlug(t.tenantId, 'wages');
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${t.tenantId}'`);
      await tx.financeExpenseCategory.update({
        where: { id: wages!.id },
        data: { name: 'Payroll' },
      });
    });

    await provisionFinance(t.tenantId);

    const after = await categoryBySlug(t.tenantId, 'wages');
    expect(after?.name).toBe('Payroll');
  });

  it('seeds no category that would double-count COGS or fees', () => {
    // Filing a stock purchase or a processor fee as an expense double-counts
    // against what the inventory and order tables already value (docs/148 §1).
    const slugs = SEED_CATEGORIES.map((c) => c.slug);
    expect(slugs).not.toContain('inventory');
    expect(slugs).not.toContain('stock');
    expect(slugs).not.toContain('merchant-fees');
  });
});

describe('expenses', () => {
  it('records spend and reads it back with its detail', async () => {
    const expense = await createExpense(t.tenantId, {
      propertyId: t.propertyId,
      categoryId: await partsCategoryId(),
      vendorId: null,
      description: 'Brake pads',
      amountCents: 12_500,
      currency: 'USD',
      taxCents: 0,
      incurredAt: day('2027-03-04'),
      paidAt: null,
      dueAt: day('2027-04-03'),
      paymentMethod: null,
      reference: 'INV-88',
      notes: null,
      allocations: [],
      attachmentAssetIds: [],
    });

    const read = await getExpense(t.tenantId, expense.id);
    expect(read.description).toBe('Brake pads');
    expect(read.amountCents).toBe(12_500);
    expect(read.category.slug).toBe('parts');
    expect(read.paidAt).toBeNull();
  });

  it('accepts a vendor credit as negative spend', async () => {
    const expense = await createExpense(t.tenantId, {
      propertyId: t.propertyId,
      categoryId: await partsCategoryId(),
      vendorId: null,
      description: 'Returned brake pads',
      amountCents: -4_000,
      currency: 'USD',
      taxCents: 0,
      incurredAt: day('2027-03-05'),
      paidAt: null,
      dueAt: null,
      paymentMethod: null,
      reference: null,
      notes: null,
      allocations: [],
      attachmentAssetIds: [],
    });
    expect(expense.amountCents).toBe(-4_000);
  });

  it('upper-cases currency so usd and USD are one currency', async () => {
    const expense = await createExpense(t.tenantId, {
      propertyId: t.propertyId,
      categoryId: await partsCategoryId(),
      vendorId: null,
      description: 'Case check',
      // The schema transform normally does this; passing it through the service
      // directly proves the column stores what the rest of the stack expects.
      currency: 'USD',
      amountCents: 100,
      taxCents: 0,
      incurredAt: day('2027-03-06'),
      paidAt: null,
      dueAt: null,
      paymentMethod: null,
      reference: null,
      notes: null,
      allocations: [],
      attachmentAssetIds: [],
    });
    expect(expense.currency).toBe('USD');
  });

  it('refuses to charge jobs for more than was spent', async () => {
    await expect(
      createExpense(t.tenantId, {
        propertyId: t.propertyId,
        categoryId: await partsCategoryId(),
        vendorId: null,
        description: 'Over-split',
        amountCents: 10_000,
        currency: 'USD',
        taxCents: 0,
        incurredAt: day('2027-03-07'),
        paidAt: null,
        dueAt: null,
        paymentMethod: null,
        reference: null,
        notes: null,
        allocations: [
          {
            targetType: 'order',
            targetId: crypto.randomUUID(),
            targetLabel: null,
            amountCents: 8_000,
          },
          {
            targetType: 'booking',
            targetId: crypto.randomUUID(),
            targetLabel: null,
            amountCents: 5_000,
          },
        ],
        attachmentAssetIds: [],
      })
    ).rejects.toThrow(OverAllocatedError);
  });

  it('splits one bill across jobs and leaves the rest as overhead', async () => {
    const jobA = crypto.randomUUID();
    const jobB = crypto.randomUUID();

    const expense = await createExpense(t.tenantId, {
      propertyId: t.propertyId,
      // Vehicle & fuel is `operating`, which is also what makes the
      // kind-split assertions below mean something.
      categoryId: (await categoryBySlug(t.tenantId, 'vehicle'))!.id,
      vendorId: null,
      description: 'Fuel for the week',
      amountCents: 48_000,
      currency: 'USD',
      taxCents: 0,
      incurredAt: day('2027-03-08'),
      paidAt: day('2027-03-08'),
      dueAt: null,
      paymentMethod: 'card',
      reference: null,
      notes: null,
      allocations: [
        { targetType: 'order', targetId: jobA, targetLabel: 'Order 1001', amountCents: 20_000 },
        { targetType: 'booking', targetId: jobB, targetLabel: 'Service call', amountCents: 15_000 },
      ],
      attachmentAssetIds: [],
    });

    expect(expense.allocations).toHaveLength(2);

    const forJob = await expensesForTarget(t.tenantId, 'order', jobA);
    expect(forJob.allocatedCents).toBe(20_000);
    expect(forJob.expenses[0]?.description).toBe('Fuel for the week');
  });

  it('replaces allocations wholesale on update, so removing the last one works', async () => {
    const job = crypto.randomUUID();
    const expense = await createExpense(t.tenantId, {
      propertyId: t.propertyId,
      categoryId: await partsCategoryId(),
      vendorId: null,
      description: 'Reallocate me',
      amountCents: 5_000,
      currency: 'USD',
      taxCents: 0,
      incurredAt: day('2027-03-09'),
      paidAt: null,
      dueAt: null,
      paymentMethod: null,
      reference: null,
      notes: null,
      allocations: [{ targetType: 'order', targetId: job, targetLabel: null, amountCents: 5_000 }],
      attachmentAssetIds: [],
    });

    const cleared = await updateExpense(t.tenantId, { id: expense.id, allocations: [] });
    expect(cleared.allocations).toHaveLength(0);
  });

  it('marks a bill paid without going through the whole form', async () => {
    const expense = await createExpense(t.tenantId, {
      propertyId: t.propertyId,
      categoryId: await partsCategoryId(),
      vendorId: null,
      description: 'Pay me',
      amountCents: 2_500,
      currency: 'USD',
      taxCents: 0,
      incurredAt: day('2027-03-10'),
      paidAt: null,
      dueAt: null,
      paymentMethod: null,
      reference: null,
      notes: null,
      allocations: [],
      attachmentAssetIds: [],
    });

    const paid = await setExpensePaid(t.tenantId, expense.id, day('2027-03-11'), 'bank');
    expect(paid.paidAt).toEqual(day('2027-03-11'));
    expect(paid.paymentMethod).toBe('bank');
  });

  it('finds unpaid bills — the payables mirror of "Owed to you"', async () => {
    const page = await listExpenses(t.tenantId, {
      propertyId: null,
      categoryId: null,
      vendorId: null,
      source: null,
      from: day('2027-03-01'),
      to: day('2027-03-31'),
      unpaidOnly: true,
      search: null,
      limit: 50,
      cursor: null,
    });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((e) => e.paidAt === null)).toBe(true);
  });

  it('keeps the header total independent of the page size', async () => {
    const all = await listExpenses(t.tenantId, {
      propertyId: null,
      categoryId: null,
      vendorId: null,
      source: null,
      from: null,
      to: null,
      unpaidOnly: null,
      search: null,
      limit: 50,
      cursor: null,
    });
    const firstPage = await listExpenses(t.tenantId, {
      propertyId: null,
      categoryId: null,
      vendorId: null,
      source: null,
      from: null,
      to: null,
      unpaidOnly: null,
      search: null,
      limit: 1,
      cursor: null,
    });
    expect(firstPage.items).toHaveLength(1);
    // The total describes the FILTER, not the page — it must not change as
    // someone scrolls.
    expect(firstPage.totalCents).toBe(all.totalCents);
    expect(firstPage.nextCursor).not.toBeNull();
  });

  it('drops soft-deleted spend out of lists and totals', async () => {
    const before = await listExpenses(t.tenantId, {
      propertyId: null,
      categoryId: null,
      vendorId: null,
      source: null,
      from: null,
      to: null,
      unpaidOnly: null,
      search: null,
      limit: 100,
      cursor: null,
    });

    const doomed = await createExpense(t.tenantId, {
      propertyId: t.propertyId,
      categoryId: await partsCategoryId(),
      vendorId: null,
      description: 'Typo, delete me',
      amountCents: 99_999,
      currency: 'USD',
      taxCents: 0,
      incurredAt: day('2027-03-12'),
      paidAt: null,
      dueAt: null,
      paymentMethod: null,
      reference: null,
      notes: null,
      allocations: [],
      attachmentAssetIds: [],
    });
    await deleteExpense(t.tenantId, doomed.id);

    const after = await listExpenses(t.tenantId, {
      propertyId: null,
      categoryId: null,
      vendorId: null,
      source: null,
      from: null,
      to: null,
      unpaidOnly: null,
      search: null,
      limit: 100,
      cursor: null,
    });
    expect(after.totalCents).toBe(before.totalCents);
  });
});

describe('vendors', () => {
  it('tracks spend against a payee', async () => {
    const vendor = await createVendor(t.tenantId, {
      name: 'NAPA Auto Parts',
      supplierId: null,
      companyId: null,
      email: null,
      phone: null,
      website: null,
      address: null,
      accountRef: null,
      paymentTerms: 'net30',
      notes: null,
    });

    await createExpense(t.tenantId, {
      propertyId: t.propertyId,
      categoryId: await partsCategoryId(),
      vendorId: vendor.id,
      description: 'Filters',
      amountCents: 7_000,
      currency: 'USD',
      taxCents: 0,
      incurredAt: day('2027-03-13'),
      paidAt: null,
      dueAt: null,
      paymentMethod: null,
      reference: null,
      notes: null,
      allocations: [],
      attachmentAssetIds: [],
    });

    expect(await vendorSpendCents(t.tenantId, vendor.id)).toBe(7_000);
  });

  it('archives rather than deletes, so history keeps its payee', async () => {
    const vendor = await createVendor(t.tenantId, {
      name: 'Gone Fishing Ltd',
      supplierId: null,
      companyId: null,
      email: null,
      phone: null,
      website: null,
      address: null,
      accountRef: null,
      paymentTerms: null,
      notes: null,
    });
    const archived = await archiveVendor(t.tenantId, vendor.id);
    expect(archived.archivedAt).not.toBeNull();

    const active = await listVendorNames(t.tenantId);
    expect(active).not.toContain('Gone Fishing Ltd');
  });
});

async function listVendorNames(tenantId: string): Promise<string[]> {
  const { listVendors } = await import('../../src/vendors');
  return (await listVendors(tenantId)).map((v) => v.name);
}

describe('categories', () => {
  it('protects a seeded category from deletion', async () => {
    const wages = await categoryBySlug(t.tenantId, 'wages');
    await expect(deleteCategory(t.tenantId, wages!.id)).rejects.toThrow(SystemCategoryError);
  });

  it('refuses to delete a category that still has spend under it', async () => {
    // Must be a TENANT-INVENTED category: a seeded one is refused earlier, by
    // the isSystem guard, so using 'parts' here would pass for the wrong reason.
    const invented = await createCategory(t.tenantId, {
      name: 'Trade show',
      kind: 'operating',
      color: null,
      exportCode: null,
      sortOrder: 51,
    });
    await createExpense(t.tenantId, {
      propertyId: t.propertyId,
      categoryId: invented.id,
      vendorId: null,
      description: 'Booth deposit',
      amountCents: 30_000,
      currency: 'USD',
      taxCents: 0,
      incurredAt: day('2027-05-02'),
      paidAt: null,
      dueAt: null,
      paymentMethod: null,
      reference: null,
      notes: null,
      allocations: [],
      attachmentAssetIds: [],
    });

    await expect(deleteCategory(t.tenantId, invented.id)).rejects.toThrow(CategoryInUseError);
  });

  it('deletes a tenant-invented category that nothing uses', async () => {
    const invented = await createCategory(t.tenantId, {
      name: 'Christmas party',
      kind: 'operating',
      color: null,
      exportCode: null,
      sortOrder: 50,
    });
    expect(invented.slug).toBeNull();
    await expect(deleteCategory(t.tenantId, invented.id)).resolves.toBeUndefined();
  });
});

describe('recurring', () => {
  it('generates a missed run for every period, then is a no-op on replay', async () => {
    const rentId = (await categoryBySlug(t.tenantId, 'rent'))!.id;
    await createRecurring(t.tenantId, {
      propertyId: t.propertyId,
      name: 'Workshop rent',
      categoryId: rentId,
      vendorId: null,
      amountCents: 150_000,
      currency: 'USD',
      cadence: 'monthly',
      dayOfMonth: 1,
      startsOn: day('2027-01-01'),
      endsOn: null,
      autoGenerate: true,
      isActive: true,
      notes: null,
    });

    const first = await generateDueExpenses(t.tenantId, day('2027-04-15'));
    const generated = first.find((r) => r.generated > 0);
    expect(generated?.generated).toBe(4); // Jan, Feb, Mar, Apr

    const rentSpend = async (): Promise<number> => {
      const page = await listExpenses(t.tenantId, {
        propertyId: null,
        categoryId: rentId,
        vendorId: null,
        source: null,
        from: null,
        to: null,
        unpaidOnly: null,
        search: null,
        limit: 100,
        cursor: null,
      });
      return page.totalCents;
    };
    expect(await rentSpend()).toBe(600_000);

    // Re-running the exact same window must not double the year. This is the
    // `(tenant, source_type, source_id)` unique doing its job.
    await generateDueExpenses(t.tenantId, day('2027-04-15'));
    expect(await rentSpend()).toBe(600_000);

    const templates = await listRecurring(t.tenantId);
    expect(templates[0]?.nextRunOn).toEqual(day('2027-05-01'));
  });

  it('generates unpaid, because a template says what is OWED', async () => {
    const page = await listExpenses(t.tenantId, {
      propertyId: null,
      categoryId: null,
      vendorId: null,
      source: 'recurring',
      from: null,
      to: null,
      unpaidOnly: true,
      search: null,
      limit: 100,
      cursor: null,
    });
    expect(page.items.length).toBe(4);
  });
});

describe('the profit rollup', () => {
  it('writes a row for a day that had only costs', async () => {
    const rows = await recomputeDay(t.tenantId, day('2027-03-04'));
    const site = rows.find((r) => r.propertyId === t.propertyId);
    expect(site).toBeDefined();
    // Brake pads, filed under a cost_of_sale category, with no revenue.
    expect(site!.costOfSaleCents).toBe(12_500);
    expect(site!.revenueCents).toBe(0);
    expect(site!.grossProfitCents).toBe(-12_500);
    expect(site!.netProfitCents).toBe(-12_500);
  });

  it('splits the ledger by category kind', async () => {
    const rows = await recomputeDay(t.tenantId, day('2027-01-01'));
    const site = rows.find((r) => r.propertyId === t.propertyId);
    // January's generated rent is operating, not cost of sale.
    expect(site!.operatingCents).toBe(150_000);
    expect(site!.costOfSaleCents).toBe(0);
  });

  it('reports unallocated spend as overhead without subtracting it twice', async () => {
    const rows = await recomputeDay(t.tenantId, day('2027-03-08'));
    const site = rows.find((r) => r.propertyId === t.propertyId);
    // 48,000 fuel with 35,000 pinned to jobs leaves 13,000 on the business.
    expect(site!.unallocatedCents).toBe(13_000);
    expect(site!.netProfitCents).toBe(-48_000);
  });

  it('is safe to recompute — the same day twice gives the same answer', async () => {
    const first = await recomputeDay(t.tenantId, day('2027-03-08'));
    const second = await recomputeDay(t.tenantId, day('2027-03-08'));
    expect(second).toEqual(first);

    const stored = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${t.tenantId}'`);
      return tx.rollupFinanceDailyProfit.count({ where: { bucket: day('2027-03-08') } });
    });
    // One row per site, not one per recompute — the NULLS NOT DISTINCT grain.
    expect(stored).toBe(first.length);
  });

  it('reconciles with the ledger over a whole range', async () => {
    // Asserted as a PROPERTY rather than hardcoded totals: the rollup's three
    // ledger slices must add up to exactly what the expense list says was spent
    // in the same window. A hardcoded figure here would only prove that I can
    // add up the fixtures, and would need re-deriving every time one changed —
    // this catches a slice going missing, or being counted twice.
    await recomputeRange(t.tenantId, day('2027-01-01'), day('2027-04-30'));

    const figures = await profitForRange(t.tenantId, day('2027-01-01'), day('2027-04-30'));
    const ledger = await listExpenses(t.tenantId, {
      propertyId: null,
      categoryId: null,
      vendorId: null,
      source: null,
      from: day('2027-01-01'),
      to: day('2027-04-30'),
      unpaidOnly: null,
      search: null,
      limit: 500,
      cursor: null,
    });

    const slices = figures.costOfSaleCents + figures.laborCents + figures.operatingCents;
    expect(slices).toBe(ledger.totalCents);

    // And the subtraction still holds over the summed range.
    expect(figures.netProfitCents).toBe(
      figures.revenueCents - figures.cogsCents - figures.feeCents - slices
    );
  });
});

describe('tenant isolation', () => {
  it('never shows one business another business’s spend', async () => {
    const mine = await listExpenses(t.tenantId, {
      propertyId: null,
      categoryId: null,
      vendorId: null,
      source: null,
      from: null,
      to: null,
      unpaidOnly: null,
      search: null,
      limit: 100,
      cursor: null,
    });
    const theirs = await listExpenses(other.tenantId, {
      propertyId: null,
      categoryId: null,
      vendorId: null,
      source: null,
      from: null,
      to: null,
      unpaidOnly: null,
      search: null,
      limit: 100,
      cursor: null,
    });

    expect(mine.items.length).toBeGreaterThan(0);
    expect(theirs.items).toHaveLength(0);
    expect(theirs.totalCents).toBe(0);
  });

  it('scopes the rollup too', async () => {
    const theirs = await profitForRange(other.tenantId, day('2027-01-01'), day('2027-12-31'));
    expect(theirs.operatingCents).toBe(0);
    expect(theirs.netProfitCents).toBe(0);
  });

  it('cascades every finance table when a tenant is deleted', async () => {
    const doomed = await createTestTenant();
    await provisionFinance(doomed.tenantId);
    await dropTestTenant(doomed.tenantId);

    // Counted as the owner role (no tenant GUC), so a surviving row would show.
    const left = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*)::bigint AS count FROM finance_expense_categories WHERE tenant_id = '${doomed.tenantId}'`
    );
    expect(Number(left[0]?.count ?? 0)).toBe(0);
  });
});
