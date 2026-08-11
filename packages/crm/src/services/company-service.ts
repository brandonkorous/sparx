// companyService — the organisation a contact belongs to (docs/144 §11).
//
// Renamed from b2bAccountService. Same row, same columns, different name: the
// record was always the platform's company, it just lived under a table named
// after the first thing that needed one. The B2B module still layers
// quote / credit-hold / approval workflows on top, and its tables still FK back
// here rather than redefining the company.
//
// What this service will NOT do is guess. `matchByEmailDomain` answers "which
// company owns this address" and writes nothing — the caller decides whether to
// offer it, and a person decides whether to accept. Auto-association is how a
// CRM ends up quietly asserting that the freelancer on gmail.com works for
// Google, and nobody notices until a mail merge goes out.

import { CreateCompanyInput, UpdateCompanyInput } from '@sparx/crm-schemas';
import { withTenant } from '@sparx/db';
import type { Company, Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';
import { changedProperties, resolvePropertyBag, toJsonInput } from './custom-properties';
import { schemaFor } from './object-def-service';
import { crmSettings } from './crm-settings-service';

/** A company as the LIST needs it: the record plus how many contacts sit under
 *  it. `_count` is Prisma's own shape and goes over the wire as-is, so the
 *  surface reads `row._count.customers` rather than a second request per row. */
export type CompanyWithContactCount = Company & { _count: { customers: number } };

export interface ListCompaniesFilter {
  status?: 'active' | 'credit_hold' | 'suspended' | 'inactive';
  assignedRepId?: string | null;
  q?: string;
  /** Exact email-domain match — `acme.com`. Used by the association offer. */
  domain?: string;
  take?: number;
  skip?: number;
}

/**
 * Domains nobody works "for".
 *
 * Without this list the first consumer contact a business adds teaches the CRM
 * that gmail.com is a company, and from then on every personal address is
 * offered that company — which is worse than no feature, because it is a
 * suggestion that looks considered.
 *
 * Deliberately short and deliberately hard-coded: it covers the handful of
 * providers that account for nearly every personal address, and a tenant with an
 * unusual one simply never adds it as a company domain. A configurable blocklist
 * would be a settings screen nobody opens.
 */
const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'gmx.de',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'qq.com',
  '163.com',
  'comcast.net',
  'verizon.net',
  'sbcglobal.net',
  'btinternet.com',
]);

/** The domain part of an address, lowercased. Null for anything that is not one. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return null;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null;
}

/** What a matched domain produced, and why it produced nothing when it didn't. */
export interface DomainMatch {
  company: Company | null;
  domain: string | null;
  /** Present only when there is no company, so the surface can say which it was. */
  reason?: 'no-domain' | 'public-domain' | 'disabled' | 'no-match';
}

/**
 * Which company owns this email address (docs/144 §11).
 *
 * Reads only. Returns `{ company: null, reason }` rather than throwing, because
 * every one of the four ways this comes back empty is ordinary — and a caller
 * that has to catch an exception to render "no suggestion" will end up not
 * calling it at all.
 */
export async function matchByEmailDomain(
  ctx: ServiceContext,
  email: string,
  propertyId: string | null = null
): Promise<DomainMatch> {
  const domain = emailDomain(email);
  if (!domain) return { company: null, domain: null, reason: 'no-domain' };
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return { company: null, domain, reason: 'public-domain' };
  }

  const settings = await crmSettings(ctx, propertyId);
  if (!settings.domainAssociation) return { company: null, domain, reason: 'disabled' };

  const company = await withTenant(ctx, (tx) =>
    tx.company.findFirst({
      where: { deletedAt: null, domains: { has: domain } },
      // Oldest first: when two companies claim a domain — which happens after a
      // merge that was never tidied up — the one that has had it longest is the
      // one the rest of the data already points at.
      orderBy: { createdAt: 'asc' },
    })
  );

  return company ? { company, domain } : { company: null, domain, reason: 'no-match' };
}

export async function list(
  ctx: ServiceContext,
  filter: ListCompaniesFilter = {}
): Promise<{ items: CompanyWithContactCount[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.CompanyWhereInput = {
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.assignedRepId !== undefined ? { assignedRepId: filter.assignedRepId } : {}),
      ...(filter.q ? { companyName: { contains: filter.q, mode: 'insensitive' } } : {}),
      ...(filter.domain ? { domains: { has: filter.domain.toLowerCase() } } : {}),
    };

    const [items, total] = await Promise.all([
      tx.company.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
        // HOW MANY PEOPLE WE KNOW THERE. For a business not selling on account
        // this is the only number on the row that means anything — a company
        // with nine contacts and one with none are a client and a business card,
        // and the credit limit says the same nothing about both.
        include: { _count: { select: { customers: true } } },
      }),
      tx.company.count({ where }),
    ]);

    return { items, total };
  });
}

export async function get(ctx: ServiceContext, accountId: string): Promise<Company> {
  const account = await withTenant(ctx, (tx) =>
    tx.company.findUnique({ where: { id: accountId } })
  );
  if (account?.deletedAt !== null) {
    throw new CrmNotFoundError('Company', accountId);
  }
  return account;
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<Company> {
  const input = CreateCompanyInput.parse(rawInput);

  const account = await withTenant(ctx, async (tx) => {
    // Tenant-declared extra fields on a company (docs/144 §3). The object key is
    // `company`, not `b2b_account` — the vocabulary a business owner uses should
    // not have to change under them when §11 renames the table.
    const customProperties = resolvePropertyBag({
      schema: await schemaFor(ctx, 'company', tx),
      existing: {},
      incoming: input.customProperties ?? {},
    });

    const created = await tx.company.create({
      data: {
        tenantId: ctx.tenantId,
        companyName: input.companyName,
        taxId: input.taxId ?? null,
        website: input.website ?? null,
        domains: input.domains,
        pricingTier: input.pricingTier ?? null,
        creditLimit: input.creditLimit,
        paymentTerms: input.paymentTerms ?? null,
        discountPercent: input.discountPercent,
        status: input.status,
        assignedRepId: input.assignedRepId ?? null,
        fleetSize: input.fleetSize ?? null,
        engineProfiles: input.engineProfiles,
        notes: input.notes ?? null,
        tags: input.tags ?? [],
        ...(customProperties !== undefined
          ? { customProperties: toJsonInput(customProperties) }
          : {}),
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.b2b_account.created',
      entityType: 'Company',
      entityId: created.id,
      diff: { after: { id: created.id, companyName: created.companyName } },
    });

    return created;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.b2b_account.created',
    payload: { companyId: account.id, companyName: account.companyName },
    dedupeKey: `crm.b2b_account.created:${account.id}`,
  });

  return account;
}

export async function update(
  ctx: ServiceContext,
  accountId: string,
  rawInput: unknown
): Promise<Company> {
  const input = UpdateCompanyInput.parse(rawInput);

  // Captured inside the transaction, read after it commits — the property-changed
  // event must never be emitted for a write that rolled back.
  let changedPropertyKeys: string[] = [];

  const result = await withTenant(ctx, async (tx) => {
    const before = await tx.company.findUnique({ where: { id: accountId } });
    if (before?.deletedAt !== null) {
      throw new CrmNotFoundError('Company', accountId);
    }

    const customProperties = resolvePropertyBag({
      schema: await schemaFor(ctx, 'company', tx),
      existing: before.customProperties,
      incoming: input.customProperties,
    });

    const updated = await tx.company.update({
      where: { id: accountId },
      data: {
        ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
        ...(input.website !== undefined ? { website: input.website } : {}),
        ...(input.domains !== undefined ? { domains: input.domains } : {}),
        ...(input.pricingTier !== undefined ? { pricingTier: input.pricingTier } : {}),
        ...(input.creditLimit !== undefined ? { creditLimit: input.creditLimit } : {}),
        ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms } : {}),
        ...(input.discountPercent !== undefined ? { discountPercent: input.discountPercent } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.assignedRepId !== undefined ? { assignedRepId: input.assignedRepId } : {}),
        ...(input.fleetSize !== undefined ? { fleetSize: input.fleetSize } : {}),
        ...(input.engineProfiles !== undefined ? { engineProfiles: input.engineProfiles } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(customProperties !== undefined
          ? { customProperties: toJsonInput(customProperties) }
          : {}),
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.b2b_account.updated',
      entityType: 'Company',
      entityId: updated.id,
      diff: { before: { status: before.status }, after: { status: updated.status } },
    });

    changedPropertyKeys = changedProperties(before.customProperties, updated.customProperties);
    return updated;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.b2b_account.updated',
    payload: { companyId: result.id, status: result.status },
    dedupeKey: `crm.b2b_account.updated:${result.id}:${result.updatedAt.toISOString()}`,
  });

  if (changedPropertyKeys.length > 0) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: 'crm.property.changed',
      payload: { objectKey: 'company', recordId: result.id, properties: changedPropertyKeys },
      dedupeKey: `crm.property.changed:${result.id}:${result.updatedAt.toISOString()}`,
    });
  }

  return result;
}

export async function softDelete(ctx: ServiceContext, accountId: string): Promise<Company> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.company.findUnique({ where: { id: accountId } });
    if (before?.deletedAt !== null) {
      throw new CrmNotFoundError('Company', accountId);
    }
    const updated = await tx.company.update({
      where: { id: accountId },
      data: { deletedAt: new Date() },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.b2b_account.deleted',
      entityType: 'Company',
      entityId: updated.id,
      diff: null,
    });
    return updated;
  });
}
