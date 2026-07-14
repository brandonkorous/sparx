// b2bAccountContactService — links a Customer to a B2BAccount with a role
// (packages/db/prisma/schema/62-b2b-contacts.prisma). This is the write path
// that was previously missing entirely: pricing (contract price), checkout
// (net-terms eligibility), and the storefront B2B portal (invoices/quotes/
// orders visibility) all key off an ACTIVE row here, but nothing ever
// created one.
//
// `Customer.b2bAccountId` is the customer's "primary account" pointer (per
// the schema's own doc comment) — set here the first time a customer is
// added as a contact, and left untouched afterward even if they're later
// added to (or removed from) other accounts, so their default pricing
// account never silently changes underneath them.

import { CreateB2bAccountContactInput, UpdateB2bAccountContactInput } from '@sparx/crm-schemas';
import { withTenant } from '@sparx/db';
import type { B2bAccountContact, Customer } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmConflictError, CrmNotFoundError } from '../errors';

export interface B2bAccountContactRow extends B2bAccountContact {
  customer: Pick<Customer, 'id' | 'firstName' | 'lastName' | 'email' | 'company'>;
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
          select: { id: true, firstName: true, lastName: true, email: true, company: true },
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
    const account = await tx.b2BAccount.findUnique({ where: { id: accountId } });
    if (account?.deletedAt !== null) {
      throw new CrmNotFoundError('B2BAccount', accountId);
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
    if (!customer.b2bAccountId || customer.type !== 'b2b') {
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          b2bAccountId: customer.b2bAccountId ?? accountId,
          type: customer.type === 'prospect' || customer.type === 'retail' ? 'b2b' : customer.type,
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
          select: { id: true, firstName: true, lastName: true, email: true, company: true },
        },
      },
    });
  });

  return result;
}

export async function update(
  ctx: ServiceContext,
  accountId: string,
  contactId: string,
  rawInput: unknown
): Promise<B2bAccountContactRow> {
  const input = UpdateB2bAccountContactInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
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
          select: { id: true, firstName: true, lastName: true, email: true, company: true },
        },
      },
    });

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
}
