// b2bAccountContactService — links a Customer to a Company with a role
// (wizeworks/packages/db/prisma/schema/62-b2b-contacts.prisma). This is the write path
// that was previously missing entirely: pricing (contract price), checkout
// (net-terms eligibility), and the storefront B2B portal (invoices/quotes/
// orders visibility) all key off an ACTIVE row here, but nothing ever
// created one.
//
// `Customer.companyId` is the customer's "primary account" pointer (per
// the schema's own doc comment) — set here the first time a customer is
// added as a contact, and left untouched when they are later added to a
// SECOND account, so their default pricing account never silently changes
// underneath them.
//
// Switching a membership OFF does clear it, when it pointed here. It used not
// to, and the customer's own screen went on naming a business that had stopped
// pricing them — an answer no screen contradicted, because the pointer is the
// only thing the customer screen reads and the active row is the only thing
// pricing reads. Both directions of that pair now live in `trade-membership.ts`,
// which the customer editor calls too. Issue 744.

import { CreateB2bAccountContactInput, UpdateB2bAccountContactInput } from '@wizeworks/crm-schemas';
import { withTenant } from '@wizeworks/db';
import type { B2bAccountContact, Customer } from '@wizeworks/db';
import { indexEntity } from '@wizeworks/events';

import { writeAuditLog } from '../audit';
import { membershipDeactivated, membershipRestored } from './trade-membership';
import type { ServiceContext } from '../errors';
import { CrmConflictError, CrmNotFoundError } from '../errors';

export interface B2bAccountContactRow extends B2bAccountContact {
  customer: Pick<Customer, 'id' | 'firstName' | 'lastName' | 'email' | 'companyName'>;
}

export async function list(
  ctx: ServiceContext,
  accountId: string
): Promise<B2bAccountContactRow[]> {
  return withTenant(ctx, (tx) =>
    tx.b2bAccountContact.findMany({
      where: { accountId },
      orderBy: { createdAt: 'asc' },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, companyName: true },
        },
      },
    })
  );
}

export async function create(
  ctx: ServiceContext,
  accountId: string,
  rawInput: unknown
): Promise<B2bAccountContactRow> {
  const input = CreateB2bAccountContactInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const account = await tx.company.findUnique({ where: { id: accountId } });
    if (account?.deletedAt !== null) {
      throw new CrmNotFoundError('Company', accountId);
    }
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (customer?.deletedAt !== null) {
      throw new CrmNotFoundError('Customer', input.customerId);
    }

    const existing = await tx.b2bAccountContact.findFirst({
      where: { tenantId: ctx.tenantId, accountId, customerId: input.customerId },
    });
    if (existing?.isActive) {
      throw new CrmConflictError(
        'This customer is already an active contact on this account.',
        'customerId'
      );
    }

    const contact = existing
      ? await tx.b2bAccountContact.update({
          where: { id: existing.id },
          data: { role: input.role, isActive: true },
        })
      : await tx.b2bAccountContact.create({
          data: {
            tenantId: ctx.tenantId,
            accountId,
            customerId: input.customerId,
            role: input.role,
          },
        });

    // Primary-account pointer + customer type promotion, set only the first
    // time — a customer's default pricing account shouldn't shift just
    // because they're later added to a second account as e.g. a viewer.
    if (!customer.companyId || customer.type !== 'b2b') {
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          companyId: customer.companyId ?? accountId,
          // Any non-wholesale relationship (retail / partner / vendor) becomes a
          // wholesale (`b2b`) contact once on a trade account — only an existing
          // b2b contact keeps its type. Written the once (see the guard above).
          type: customer.type === 'b2b' ? customer.type : 'b2b',
        },
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: existing ? 'crm.b2b_account_contact.reactivated' : 'crm.b2b_account_contact.created',
      entityType: 'B2bAccountContact',
      entityId: contact.id,
      diff: { after: { accountId, customerId: input.customerId, role: input.role } },
    });

    return tx.b2bAccountContact.findUniqueOrThrow({
      where: { id: contact.id },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, companyName: true },
        },
      },
    });
  });

  await reindexContact(ctx, result.customerId);
  return result;
}

/**
 * The person's search document names every trade account they are an active
 * contact on, and a membership row is not the customer row, so nothing else here
 * announces the change. After commit, like every index signal.
 *
 * Without it a contact added on the account's screen could not be found by the
 * account's name, and one switched off went on being found by it, until somebody
 * happened to edit them (Gillett Diesel, 2026-10-03: two of the three people on
 * Wasatch Front Utility Contractors, LLC could not be found by typing "Wasatch").
 */
async function reindexContact(ctx: ServiceContext, customerId: string): Promise<void> {
  await indexEntity({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    entityType: 'customer',
    recordId: customerId,
  });
}

export async function update(
  ctx: ServiceContext,
  accountId: string,
  contactId: string,
  rawInput: unknown
): Promise<B2bAccountContactRow> {
  const input = UpdateB2bAccountContactInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const before = await tx.b2bAccountContact.findUnique({ where: { id: contactId } });
    if (before?.accountId !== accountId) {
      throw new CrmNotFoundError('B2bAccountContact', contactId);
    }

    const updated = await tx.b2bAccountContact.update({
      where: { id: contactId },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, companyName: true },
        },
      },
    });

    // The pointer follows the membership, BOTH ways. Switched off, the
    // customer's own screen must stop naming this business as the one that
    // prices them; switched back on, it must name it again. The pointer is what
    // that screen reads and it is not what pricing reads, so either direction
    // left alone shows a person filed one way and charged the other. Issue 744.
    if (input.isActive === false && before.isActive) {
      await membershipDeactivated(tx, updated.customerId, accountId);
    } else if (input.isActive === true && !before.isActive) {
      await membershipRestored(tx, updated.customerId, accountId);
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.b2b_account_contact.updated',
      entityType: 'B2bAccountContact',
      entityId: updated.id,
      diff: {
        before: { role: before.role, isActive: before.isActive },
        after: { role: updated.role, isActive: updated.isActive },
      },
    });

    return updated;
  });

  await reindexContact(ctx, result.customerId);
  return result;
}
