// The expense spine — record, split, correct, and find spend.
//
// Everything a business paid for something it CONSUMED. Not stock purchases: a
// purchase order converts cash into inventory value and becomes cost when the
// goods sell, which the inventory cost tables already record (docs/148 §1, locked
// decision #2). Filing a PO here would double-count every part.

import { withTenant, type FinanceExpense, type Prisma, type TxClient } from '@wizeworks/db';

import { ExpenseNotFoundError, OverAllocatedError } from './errors';
import type {
  AllocationInput,
  CreateExpenseInput,
  ExpenseSource,
  ListExpensesInput,
  UpdateExpenseInput,
} from './schemas';

/** An expense with everything the detail pane renders in one read. */
export type ExpenseWithDetail = Prisma.FinanceExpenseGetPayload<{
  include: {
    category: true;
    vendor: true;
    allocations: true;
    attachments: { include: { asset: true } };
  };
}>;

const DETAIL_INCLUDE = {
  category: true,
  vendor: true,
  allocations: true,
  attachments: { include: { asset: true } },
} as const;

/**
 * Allocations may split an expense across jobs but never exceed it.
 *
 * Under-allocating is valid and meaningful: the remainder is OVERHEAD, the cost
 * of being open, and the rollup reports it as such rather than forcing it onto a
 * job that did not incur it. Over-allocating charges jobs for money nobody spent,
 * which is always a bug.
 *
 * Compared on absolute value so a vendor credit (negative spend) splits the same
 * way a bill does, instead of the sign inverting the comparison.
 */
export function assertAllocationsFit(
  amountCents: number,
  allocations: readonly AllocationInput[]
): void {
  if (allocations.length === 0) return;
  const allocated = allocations.reduce((sum, a) => sum + a.amountCents, 0);
  if (Math.abs(allocated) > Math.abs(amountCents)) {
    throw new OverAllocatedError(allocated, amountCents);
  }
}

/** Spend not tied to any job — what it costs to keep the doors open. */
export function unallocatedCents(
  amountCents: number,
  allocations: readonly { amountCents: number }[]
): number {
  return amountCents - allocations.reduce((sum, a) => sum + a.amountCents, 0);
}

export async function createExpense(
  tenantId: string,
  input: CreateExpenseInput,
  opts: { source?: ExpenseSource; sourceType?: string; sourceId?: string; tx?: TxClient } = {}
): Promise<ExpenseWithDetail> {
  assertAllocationsFit(input.amountCents, input.allocations);

  const run = (tx: TxClient): Promise<ExpenseWithDetail> =>
    tx.financeExpense.create({
      data: {
        tenantId,
        propertyId: input.propertyId ?? null,
        categoryId: input.categoryId,
        vendorId: input.vendorId ?? null,
        description: input.description,
        source: opts.source ?? 'manual',
        // Both halves or neither — a source_type with no source_id cannot be
        // matched on the next run, which turns an idempotent deriver into one
        // that duplicates. A CHECK constraint enforces the same pairing.
        sourceType: opts.sourceType ?? null,
        sourceId: opts.sourceType ? (opts.sourceId ?? null) : null,
        amountCents: input.amountCents,
        currency: input.currency,
        taxCents: input.taxCents,
        incurredAt: input.incurredAt,
        paidAt: input.paidAt ?? null,
        dueAt: input.dueAt ?? null,
        paymentMethod: input.paymentMethod ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        allocations: {
          create: input.allocations.map((a) => ({
            tenantId,
            targetType: a.targetType,
            targetId: a.targetId,
            targetLabel: a.targetLabel ?? null,
            amountCents: a.amountCents,
          })),
        },
        attachments: {
          create: input.attachmentAssetIds.map((assetId) => ({ tenantId, assetId })),
        },
      },
      include: DETAIL_INCLUDE,
    });

  return opts.tx ? run(opts.tx) : withTenant({ tenantId }, run);
}

/**
 * Record a derived expense idempotently.
 *
 * The `(tenantId, sourceType, sourceId)` unique is what makes every deriver and
 * importer safe to re-run: a corrected timesheet or a replayed event UPDATES the
 * row rather than doubling the month. This is the only write path derivers use.
 */
export async function upsertDerivedExpense(
  tenantId: string,
  sourceType: string,
  sourceId: string,
  input: CreateExpenseInput,
  source: ExpenseSource,
  tx?: TxClient
): Promise<FinanceExpense> {
  assertAllocationsFit(input.amountCents, input.allocations);

  const run = async (client: TxClient): Promise<FinanceExpense> => {
    const data = {
      propertyId: input.propertyId ?? null,
      categoryId: input.categoryId,
      vendorId: input.vendorId ?? null,
      description: input.description,
      amountCents: input.amountCents,
      currency: input.currency,
      taxCents: input.taxCents,
      incurredAt: input.incurredAt,
      paidAt: input.paidAt ?? null,
      dueAt: input.dueAt ?? null,
      paymentMethod: input.paymentMethod ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
    };

    const expense = await client.financeExpense.upsert({
      where: { tenantId_sourceType_sourceId: { tenantId, sourceType, sourceId } },
      update: data,
      create: { tenantId, source, sourceType, sourceId, ...data },
    });

    // Allocations are replaced wholesale rather than merged: a re-derivation is
    // the authority on how its own cost splits, and merging would accumulate a
    // stale allocation every time a timesheet was corrected.
    await client.financeExpenseAllocation.deleteMany({ where: { expenseId: expense.id } });
    if (input.allocations.length > 0) {
      await client.financeExpenseAllocation.createMany({
        data: input.allocations.map((a) => ({
          tenantId,
          expenseId: expense.id,
          targetType: a.targetType,
          targetId: a.targetId,
          targetLabel: a.targetLabel ?? null,
          amountCents: a.amountCents,
        })),
      });
    }
    return expense;
  };

  return tx ? run(tx) : withTenant({ tenantId }, run);
}

export async function getExpense(tenantId: string, id: string): Promise<ExpenseWithDetail> {
  return withTenant({ tenantId }, async (tx) => {
    const expense = await tx.financeExpense.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!expense) throw new ExpenseNotFoundError(id);
    return expense;
  });
}

export async function updateExpense(
  tenantId: string,
  input: UpdateExpenseInput
): Promise<ExpenseWithDetail> {
  const { id, allocations, attachmentAssetIds, ...rest } = input;

  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.financeExpense.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new ExpenseNotFoundError(id);

    const nextAmount = rest.amountCents ?? existing.amountCents;
    if (allocations) assertAllocationsFit(nextAmount, allocations);

    await tx.financeExpense.update({
      where: { id },
      data: {
        ...(rest.propertyId !== undefined ? { propertyId: rest.propertyId ?? null } : {}),
        ...(rest.categoryId !== undefined ? { categoryId: rest.categoryId } : {}),
        ...(rest.vendorId !== undefined ? { vendorId: rest.vendorId ?? null } : {}),
        ...(rest.description !== undefined ? { description: rest.description } : {}),
        ...(rest.amountCents !== undefined ? { amountCents: rest.amountCents } : {}),
        ...(rest.currency !== undefined ? { currency: rest.currency } : {}),
        ...(rest.taxCents !== undefined ? { taxCents: rest.taxCents } : {}),
        ...(rest.incurredAt !== undefined ? { incurredAt: rest.incurredAt } : {}),
        ...(rest.paidAt !== undefined ? { paidAt: rest.paidAt ?? null } : {}),
        ...(rest.dueAt !== undefined ? { dueAt: rest.dueAt ?? null } : {}),
        ...(rest.paymentMethod !== undefined ? { paymentMethod: rest.paymentMethod ?? null } : {}),
        ...(rest.reference !== undefined ? { reference: rest.reference ?? null } : {}),
        ...(rest.notes !== undefined ? { notes: rest.notes ?? null } : {}),
      },
    });

    // Present = replace in full; absent = leave alone. A partial merge would make
    // "remove the last allocation" unexpressible.
    if (allocations) {
      await tx.financeExpenseAllocation.deleteMany({ where: { expenseId: id } });
      if (allocations.length > 0) {
        await tx.financeExpenseAllocation.createMany({
          data: allocations.map((a) => ({
            tenantId,
            expenseId: id,
            targetType: a.targetType,
            targetId: a.targetId,
            targetLabel: a.targetLabel ?? null,
            amountCents: a.amountCents,
          })),
        });
      }
    }

    if (attachmentAssetIds) {
      await tx.financeExpenseAttachment.deleteMany({ where: { expenseId: id } });
      if (attachmentAssetIds.length > 0) {
        await tx.financeExpenseAttachment.createMany({
          data: attachmentAssetIds.map((assetId) => ({ tenantId, expenseId: id, assetId })),
        });
      }
    }

    const updated = await tx.financeExpense.findFirst({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!updated) throw new ExpenseNotFoundError(id);
    return updated;
  });
}

/** Mark spend paid (or un-paid, when someone mis-clicked). Separate from update
 *  because it is the one field a list row edits inline, and routing it through
 *  the full update shape would make a one-tap action a full-form write. */
export async function setExpensePaid(
  tenantId: string,
  id: string,
  paidAt: Date | null,
  paymentMethod?: string | null
): Promise<FinanceExpense> {
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.financeExpense.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new ExpenseNotFoundError(id);
    return tx.financeExpense.update({
      where: { id },
      data: {
        paidAt,
        ...(paymentMethod !== undefined ? { paymentMethod: paymentMethod ?? null } : {}),
      },
    });
  });
}

/** Soft delete — the row leaves every list and every total, but an expense that
 *  was already exported to the tenant's accounting system still has a record on
 *  this side of the handoff, which is what makes a later reconciliation possible. */
export async function deleteExpense(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const existing = await tx.financeExpense.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new ExpenseNotFoundError(id);
    await tx.financeExpense.update({ where: { id }, data: { deletedAt: new Date() } });
  });
}

export interface ExpenseListPage {
  items: ExpenseWithDetail[];
  nextCursor: string | null;
  /** Total spend matching the filter, ignoring pagination — the figure the list
   *  header shows, which must not change as someone scrolls. */
  totalCents: number;
}

export async function listExpenses(
  tenantId: string,
  input: ListExpensesInput
): Promise<ExpenseListPage> {
  const where: Prisma.FinanceExpenseWhereInput = {
    deletedAt: null,
    ...(input.propertyId !== undefined && input.propertyId !== null
      ? { propertyId: input.propertyId }
      : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.vendorId ? { vendorId: input.vendorId } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.unpaidOnly === true ? { paidAt: null } : {}),
    ...(input.unpaidOnly === false ? { paidAt: { not: null } } : {}),
    ...(input.from || input.to
      ? {
          incurredAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lte: input.to } : {}),
          },
        }
      : {}),
    ...(input.search
      ? {
          OR: [
            { description: { contains: input.search, mode: 'insensitive' as const } },
            { reference: { contains: input.search, mode: 'insensitive' as const } },
            { vendor: { name: { contains: input.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  return withTenant({ tenantId }, async (tx) => {
    const [rows, sum] = await Promise.all([
      tx.financeExpense.findMany({
        where,
        include: DETAIL_INCLUDE,
        // Newest cost first, id as the tiebreak so a page boundary can never
        // repeat or skip a row when several share an `incurredAt` date.
        orderBy: [{ incurredAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      }),
      tx.financeExpense.aggregate({ _sum: { amountCents: true }, where }),
    ]);

    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
      totalCents: sum._sum.amountCents ?? 0,
    };
  });
}

/** Everything charged to one job — the cost side of job profitability. */
export async function expensesForTarget(
  tenantId: string,
  targetType: string,
  targetId: string
): Promise<{ allocatedCents: number; expenses: ExpenseWithDetail[] }> {
  return withTenant({ tenantId }, async (tx) => {
    const allocations = await tx.financeExpenseAllocation.findMany({
      where: { targetType, targetId, expense: { deletedAt: null } },
      include: { expense: { include: DETAIL_INCLUDE } },
    });
    return {
      allocatedCents: allocations.reduce((sum, a) => sum + a.amountCents, 0),
      expenses: allocations.map((a) => a.expense),
    };
  });
}
