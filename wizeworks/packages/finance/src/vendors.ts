// Vendors — who got paid.
//
// A table rather than free text on the expense, because "spend by vendor" is one
// of the three questions this module exists to answer and free text answers it
// wrong the first time someone types "Napa" and "NAPA Auto Parts". It is also the
// unit the accounting connectors map on: QuickBooks and Xero both key a bill to a
// Vendor record, so an export without a stable vendor identity lands unassigned.
//
// `supplierId` / `companyId` are FK-less by design (docs/148 §3) — finance must
// run with inventory and crm both off, and a hard FK would couple a standalone
// finance tenant to modules it never bought. They are resolved here only when
// those modules are on.

import { withTenant, type FinanceVendor } from '@wizeworks/db';

import { VendorNotFoundError } from './errors';
import type { CreateVendorInput, UpdateVendorInput } from './schemas';

export async function listVendors(
  tenantId: string,
  opts: { includeArchived?: boolean; search?: string } = {}
): Promise<FinanceVendor[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.financeVendor.findMany({
      where: {
        ...(opts.includeArchived ? {} : { archivedAt: null }),
        ...(opts.search ? { name: { contains: opts.search, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { name: 'asc' },
    })
  );
}

export async function getVendor(tenantId: string, id: string): Promise<FinanceVendor> {
  return withTenant({ tenantId }, async (tx) => {
    const vendor = await tx.financeVendor.findUnique({ where: { id } });
    if (!vendor) throw new VendorNotFoundError(id);
    return vendor;
  });
}

export async function createVendor(
  tenantId: string,
  input: CreateVendorInput
): Promise<FinanceVendor> {
  return withTenant({ tenantId }, (tx) =>
    tx.financeVendor.create({
      data: {
        tenantId,
        name: input.name,
        supplierId: input.supplierId ?? null,
        companyId: input.companyId ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        website: input.website ?? null,
        address: input.address ?? null,
        accountRef: input.accountRef ?? null,
        paymentTerms: input.paymentTerms ?? null,
        notes: input.notes ?? null,
      },
    })
  );
}

export async function updateVendor(
  tenantId: string,
  input: UpdateVendorInput
): Promise<FinanceVendor> {
  const { id, ...rest } = input;
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.financeVendor.findUnique({ where: { id } });
    if (!existing) throw new VendorNotFoundError(id);
    return tx.financeVendor.update({
      where: { id },
      data: {
        ...(rest.name !== undefined ? { name: rest.name } : {}),
        ...(rest.supplierId !== undefined ? { supplierId: rest.supplierId ?? null } : {}),
        ...(rest.companyId !== undefined ? { companyId: rest.companyId ?? null } : {}),
        ...(rest.email !== undefined ? { email: rest.email ?? null } : {}),
        ...(rest.phone !== undefined ? { phone: rest.phone ?? null } : {}),
        ...(rest.website !== undefined ? { website: rest.website ?? null } : {}),
        ...(rest.address !== undefined ? { address: rest.address ?? null } : {}),
        ...(rest.accountRef !== undefined ? { accountRef: rest.accountRef ?? null } : {}),
        ...(rest.paymentTerms !== undefined ? { paymentTerms: rest.paymentTerms ?? null } : {}),
        ...(rest.notes !== undefined ? { notes: rest.notes ?? null } : {}),
      },
    });
  });
}

/**
 * Archive rather than delete, always.
 *
 * A vendor with history is a payee on last year's books; removing it would blank
 * the "who did we pay" column on every expense that referenced it (the FK is
 * ON DELETE SET NULL). Archiving keeps the history readable and takes the name
 * out of the picker, which is the only thing anyone actually wanted.
 */
export async function archiveVendor(
  tenantId: string,
  id: string,
  archived = true
): Promise<FinanceVendor> {
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.financeVendor.findUnique({ where: { id } });
    if (!existing) throw new VendorNotFoundError(id);
    return tx.financeVendor.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });
  });
}

/** Total spend against a vendor over an optional window — the number the vendor
 *  list shows beside each name. Sums `incurredAt`, never `paidAt` (docs/148 §1). */
export async function vendorSpendCents(
  tenantId: string,
  vendorId: string,
  window: { from?: Date; to?: Date } = {}
): Promise<number> {
  return withTenant({ tenantId }, async (tx) => {
    const result = await tx.financeExpense.aggregate({
      _sum: { amountCents: true },
      where: {
        vendorId,
        deletedAt: null,
        ...(window.from || window.to
          ? {
              incurredAt: {
                ...(window.from ? { gte: window.from } : {}),
                ...(window.to ? { lte: window.to } : {}),
              },
            }
          : {}),
      },
    });
    return result._sum.amountCents ?? 0;
  });
}
