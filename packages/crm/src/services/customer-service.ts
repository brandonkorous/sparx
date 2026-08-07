// customerService — read/write API for customers.
//
// Every other transport (Server Actions, REST, GraphQL, MCP) wraps these
// functions. Per locked decision #7, a bug fixed here is fixed everywhere
// at once. Every state-changing function:
//   1. Validates input against the Zod schema in @sparx/crm-schemas
//   2. Wraps DB work in withTenant() (RLS context set per transaction)
//   3. Writes an audit_logs row inside the same transaction
//   4. Publishes a Pub/Sub event AFTER the transaction commits — never
//      before, so a rolled-back write never emits a phantom event.

import {
  BulkAssignCustomersInput,
  BulkTagCustomersInput,
  CreateCustomerAddressInput,
  CreateCustomerDocumentInput,
  CreateCustomerInput,
  SubscribeCustomerInput,
  UpdateCustomerAddressInput,
  UpdateCustomerInput,
  type CustomerType,
  type LeadStatus,
  type LifecycleStage,
} from '@sparx/crm-schemas';
import { NEWSLETTER_SEGMENT_SLUG } from '@sparx/crm-schemas/builtins';
import { withTenant } from '@sparx/db';
import type { Customer, CustomerAddress, CustomerDocument, Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import { changedProperties, resolvePropertyBag, toJsonInput } from './custom-properties';
import { schemaFor } from './object-def-service';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';
import { ensureBuiltInSegment } from './segment-service';

export { merge, findLikelyDuplicates } from './merge-service';
export type { MergeResult, DuplicateGroup } from './merge-service';

// ─────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────

export interface ListCustomersFilter {
  type?: CustomerType;
  lifecycleStage?: LifecycleStage;
  leadStatus?: LeadStatus;
  assignedRepId?: string | null;
  b2bAccountId?: string | null;
  // Membership site filter (docs/58 D2) — customers belonging to one site.
  propertyId?: string;
  tag?: string;
  q?: string; // full-text-ish: matches first/last/company/email substring
  includeDeleted?: boolean;
  take?: number;
  skip?: number;
  // Sort: lastOrderAt desc | totalSpent desc | updatedAt desc | createdAt desc
  sortBy?: 'lastOrderAt' | 'totalSpent' | 'updatedAt' | 'createdAt';
}

export async function list(
  ctx: ServiceContext,
  filter: ListCustomersFilter = {}
): Promise<{ items: Customer[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.CustomerWhereInput = {
      ...(filter.includeDeleted ? {} : { deletedAt: null }),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.lifecycleStage ? { lifecycleStage: filter.lifecycleStage } : {}),
      ...(filter.leadStatus ? { leadStatus: filter.leadStatus } : {}),
      ...(filter.assignedRepId !== undefined ? { assignedRepId: filter.assignedRepId } : {}),
      ...(filter.b2bAccountId !== undefined ? { b2bAccountId: filter.b2bAccountId } : {}),
      // docs/58 D2: a site-scoped list shows customers belonging to THAT site
      // PLUS global (null-property) customers — null is treated as visible
      // everywhere. Composed as `AND: [{ OR }]` so it never key-collides with the
      // search `OR` below (mirrors the content/product site-visibility fragment).
      ...(filter.propertyId
        ? { AND: [{ OR: [{ propertyId: null }, { propertyId: filter.propertyId }] }] }
        : {}),
      ...(filter.tag ? { tags: { has: filter.tag } } : {}),
      ...(filter.q
        ? {
            OR: [
              { email: { contains: filter.q, mode: 'insensitive' } },
              { firstName: { contains: filter.q, mode: 'insensitive' } },
              { lastName: { contains: filter.q, mode: 'insensitive' } },
              { company: { contains: filter.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const sortField = filter.sortBy ?? 'updatedAt';
    const [items, total] = await Promise.all([
      tx.customer.findMany({
        where,
        orderBy: { [sortField]: 'desc' },
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
      }),
      tx.customer.count({ where }),
    ]);

    return { items, total };
  });
}

export async function get(ctx: ServiceContext, customerId: string): Promise<Customer> {
  const customer = await withTenant(ctx, (tx) =>
    tx.customer.findUnique({ where: { id: customerId } })
  );
  if (customer?.deletedAt !== null) {
    throw new CrmNotFoundError('Customer', customerId);
  }
  return customer;
}

/** Top N customers by total_spent. Used by the dashboard rep dashboard,
 *  the MCP get_top_customers tool, and the segment evaluator's projection
 *  builder. Read-only — no event, no audit log. */
export async function getTopBySpend(
  ctx: ServiceContext,
  args: { limit?: number; type?: 'retail' | 'b2b' } = {}
): Promise<Customer[]> {
  return withTenant(ctx, (tx) =>
    tx.customer.findMany({
      where: {
        deletedAt: null,
        ...(args.type ? { type: args.type } : {}),
        totalSpent: { gt: 0 },
      },
      orderBy: { totalSpent: 'desc' },
      take: Math.min(args.limit ?? 10, 100),
    })
  );
}

/** Customers with no order in the last N days. Drives the at-risk segment
 *  and the MCP get_inactive_customers tool. */
export async function getInactive(
  ctx: ServiceContext,
  args: { days: number; limit?: number }
): Promise<Customer[]> {
  const threshold = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000);
  return withTenant(ctx, (tx) =>
    tx.customer.findMany({
      where: {
        deletedAt: null,
        orderCount: { gt: 0 }, // exclude prospects who've never ordered
        OR: [{ lastOrderAt: { lt: threshold } }, { lastOrderAt: null }],
      },
      orderBy: { lastOrderAt: 'asc' },
      take: Math.min(args.limit ?? 50, 500),
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<Customer> {
  const input = CreateCustomerInput.parse(rawInput);

  const customer = await withTenant(ctx, async (tx) => {
    // The tenant's declared extra fields (docs/144 §3), validated + calculated
    // inside the same transaction that writes the row, so a bad property can
    // never leave a half-created contact behind.
    const customProperties = resolvePropertyBag({
      schema: await schemaFor(ctx, 'contact', tx),
      existing: {},
      incoming: input.customProperties ?? {},
    });

    const created = await tx.customer.create({
      data: {
        tenantId: ctx.tenantId,
        type: input.type,
        lifecycleStage: input.lifecycleStage,
        leadStatus: input.leadStatus ?? null,
        // The owning site (docs/58 D2); null → global. The api-rest route
        // defaults this to the active site for multi-site tenants.
        propertyId: input.propertyId ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        company: input.company ?? null,
        jobTitle: input.jobTitle ?? null,
        b2bAccountId: input.b2bAccountId ?? null,
        assignedRepId: input.assignedRepId ?? null,
        preferredContactMethod: input.preferredContactMethod ?? null,
        doNotContact: input.doNotContact,
        gdprConsent: input.gdprConsent ?? {},
        tags: input.tags ?? [],
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        ...(customProperties !== undefined
          ? { customProperties: toJsonInput(customProperties) }
          : {}),
        avatarMediaAssetId: input.avatarMediaAssetId ?? null,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.customer.created',
      entityType: 'Customer',
      entityId: created.id,
      diff: { before: null, after: serializeCustomer(created) },
    });

    return created;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.customer.created',
    payload: { customerId: customer.id, type: customer.type, email: customer.email },
    dedupeKey: `crm.customer.created:${customer.id}`,
  });

  return customer;
}

// Marketing opt-in from the public storefront (the "Email signup" block,
// docs/51 §7). Idempotent on the (tenant, property, email) identity: a fresh
// email becomes a `prospect` with `marketing` consent; a repeat submit (or an
// existing customer — e.g. someone who checked out) folds `marketing` into the
// consent scope and clears any prior `doNotContact`, never erroring on the
// unique constraint. Returns the customer plus whether it was newly created so
// the caller can decide (it deliberately does NOT leak that to the public).
export async function subscribe(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ customer: Customer; created: boolean }> {
  const input = SubscribeCustomerInput.parse(rawInput);
  const propertyId = input.propertyId ?? null;
  const grantedAt = new Date().toISOString();

  const outcome = await withTenant(ctx, async (tx) => {
    // Re-subscribe: union the existing consent scope with `marketing`, keep the
    // earliest grant timestamp, and lift any do-not-contact flag. A deleted row
    // is restored (deletedAt → null) so the opt-in actually takes effect.
    const resubscribe = async (existing: Customer) => {
      const prior = (existing.gdprConsent ?? {}) as {
        grantedAt?: string;
        source?: string;
        scope?: string[];
        ipAddress?: string;
      };
      const scope = Array.from(new Set([...(prior.scope ?? []), 'marketing']));
      // Add the list tag (idempotent) and capture the signup context once — never
      // clobber an earlier note, so the first "what are you building?" answer wins.
      const priorMeta = (existing.metadata ?? {}) as Record<string, unknown>;
      const nextTags =
        input.list && !existing.tags.includes(input.list) ? [...existing.tags, input.list] : null;
      const nextMeta =
        priorMeta.signup === undefined && (input.list || input.note || input.metadata)
          ? ({ ...priorMeta, ...buildSignupMeta(input, grantedAt) } as Prisma.InputJsonValue)
          : null;
      const updated = await tx.customer.update({
        where: { id: existing.id },
        data: {
          doNotContact: false,
          deletedAt: null,
          ...(existing.firstName ? {} : input.firstName ? { firstName: input.firstName } : {}),
          ...(existing.lastName ? {} : input.lastName ? { lastName: input.lastName } : {}),
          ...(nextTags ? { tags: nextTags } : {}),
          ...(nextMeta ? { metadata: nextMeta } : {}),
          gdprConsent: {
            ...prior,
            grantedAt: prior.grantedAt ?? grantedAt,
            source: prior.source ?? input.source,
            scope,
            ...(prior.ipAddress || input.ipAddress
              ? { ipAddress: prior.ipAddress ?? input.ipAddress }
              : {}),
          },
        },
      });
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: null,
        actorType: 'system',
        action: 'crm.customer.subscribed',
        entityType: 'Customer',
        entityId: updated.id,
        diff: { before: serializeCustomer(existing), after: serializeCustomer(updated) },
      });
      return { customer: updated, created: false };
    };

    // Match the unique identity directly (includes soft-deleted rows so a
    // re-subscribe resurrects rather than colliding on the constraint).
    const existing = await tx.customer.findFirst({
      where: { tenantId: ctx.tenantId, propertyId, email: input.email },
    });
    if (existing) return resubscribe(existing);

    // No row yet → create. A concurrent first-time submit (two tabs) can race
    // between the find above and this insert; the unique constraint catches the
    // loser, which then falls through to the re-subscribe path on the row the
    // winner created — so a double-submit is still idempotent, never a 500.
    try {
      const created = await tx.customer.create({
        data: {
          tenantId: ctx.tenantId,
          // Opted into email only → the `subscriber` lifecycle stage, retail
          // relationship. Not a sales lead being worked, so no lead status.
          type: 'retail',
          lifecycleStage: 'subscriber',
          propertyId,
          email: input.email,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          doNotContact: false,
          tags: input.list ? [input.list] : [],
          metadata: buildSignupMeta(input, grantedAt) as Prisma.InputJsonValue,
          gdprConsent: {
            grantedAt,
            source: input.source,
            scope: ['marketing'],
            ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
          },
        },
      });
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: null,
        actorType: 'system',
        action: 'crm.customer.subscribed',
        entityType: 'Customer',
        entityId: created.id,
        diff: { before: null, after: serializeCustomer(created) },
      });
      return { customer: created, created: true };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const racedRow = await tx.customer.findFirst({
        where: { tenantId: ctx.tenantId, propertyId, email: input.email },
      });
      if (!racedRow) throw err;
      return resubscribe(racedRow);
    }
  });

  // Make the subscriber emailable: ensure the built-in "Newsletter Subscribers"
  // segment exists (covers tenants that activated CRM before it was a built-in),
  // then drive the in-process segment evaluator so it materializes membership.
  // Broadcasts resolve recipients from segment_members, so this is what turns an
  // opt-in into a reachable audience. Best-effort — a failure here must not undo
  // the consent capture (the durable source of truth), which already committed.
  try {
    await ensureBuiltInSegment(ctx, NEWSLETTER_SEGMENT_SLUG);
  } catch {
    // Segment seeding is recoverable on the next subscribe / activation.
  }

  // If this opt-in joined a named list that has a matching built-in segment
  // (e.g. 'early-access'), ensure that segment too so the cohort is a distinct,
  // broadcast-targetable slice — narrower than all Newsletter Subscribers.
  if (input.list) {
    try {
      await ensureBuiltInSegment(ctx, input.list);
    } catch {
      // Not a built-in list slug (or a transient miss) — the tag still makes the
      // contact filterable; a real built-in materializes on a later subscribe.
    }
  }

  // Publish on the CRM bus: webhooks + (in prod) the Pub/Sub tee, AND — via the
  // platform-bus fan-out installed with the consumers — the in-process segment
  // evaluator, which re-projects the customer and writes the segment_member.
  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.customer.subscribed',
    payload: {
      customerId: outcome.customer.id,
      email: outcome.customer.email,
      propertyId,
      created: outcome.created,
    },
    dedupeKey: `crm.customer.subscribed:${outcome.customer.id}:${grantedAt}`,
  });

  return outcome;
}

export async function update(
  ctx: ServiceContext,
  customerId: string,
  rawInput: unknown
): Promise<Customer> {
  const input = UpdateCustomerInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const before = await tx.customer.findUnique({ where: { id: customerId } });
    if (before?.deletedAt !== null) {
      throw new CrmNotFoundError('Customer', customerId);
    }

    // Merged onto what is stored, not replacing it: a PATCH carrying one extra
    // detail means "change this one", never "delete the other nine".
    const customProperties = resolvePropertyBag({
      schema: await schemaFor(ctx, 'contact', tx),
      existing: before.customProperties,
      incoming: input.customProperties,
    });

    const updated = await tx.customer.update({
      where: { id: customerId },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.lifecycleStage !== undefined ? { lifecycleStage: input.lifecycleStage } : {}),
        ...(input.leadStatus !== undefined ? { leadStatus: input.leadStatus } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.company !== undefined ? { company: input.company } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
        ...(input.b2bAccountId !== undefined ? { b2bAccountId: input.b2bAccountId } : {}),
        // Site (re)assignment (docs/58 D2): a uuid moves the customer to that
        // site; `null` clears it → global (visible from every site). `undefined`
        // (absent) leaves the assignment untouched.
        ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
        ...(input.assignedRepId !== undefined ? { assignedRepId: input.assignedRepId } : {}),
        ...(input.preferredContactMethod !== undefined
          ? { preferredContactMethod: input.preferredContactMethod }
          : {}),
        ...(input.doNotContact !== undefined ? { doNotContact: input.doNotContact } : {}),
        ...(input.gdprConsent !== undefined ? { gdprConsent: input.gdprConsent } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
        ...(input.avatarMediaAssetId !== undefined
          ? { avatarMediaAssetId: input.avatarMediaAssetId }
          : {}),
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
      action: 'crm.customer.updated',
      entityType: 'Customer',
      entityId: updated.id,
      diff: { before: serializeCustomer(before), after: serializeCustomer(updated) },
    });

    return {
      updated,
      changed: changedProperties(before.customProperties, updated.customProperties),
    };
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.customer.updated',
    payload: { customerId: result.updated.id },
    dedupeKey: `crm.customer.updated:${result.updated.id}:${result.updated.updatedAt.toISOString()}`,
  });

  // Only when a DECLARED property actually moved (docs/144 §9). An edit to a
  // phone number must not wake every workflow watching this object.
  if (result.changed.length > 0) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: 'crm.property.changed',
      payload: {
        objectKey: 'contact',
        recordId: result.updated.id,
        properties: result.changed,
      },
      dedupeKey: `crm.property.changed:${result.updated.id}:${result.updated.updatedAt.toISOString()}`,
    });
  }

  return result.updated;
}

export async function softDelete(ctx: ServiceContext, customerId: string): Promise<Customer> {
  const result = await withTenant(ctx, async (tx) => {
    const before = await tx.customer.findUnique({ where: { id: customerId } });
    if (before?.deletedAt !== null) {
      throw new CrmNotFoundError('Customer', customerId);
    }
    const updated = await tx.customer.update({
      where: { id: customerId },
      data: { deletedAt: new Date() },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.customer.deleted',
      entityType: 'Customer',
      entityId: updated.id,
      diff: { before: serializeCustomer(before), after: serializeCustomer(updated) },
    });
    return updated;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.customer.deleted',
    payload: { customerId: result.id },
    dedupeKey: `crm.customer.deleted:${result.id}`,
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// Bulk operations
// ─────────────────────────────────────────────────────────────────────────
// Bulk paths share the per-row audit log (one row per customer touched) so
// undo/forensics has the same granularity as the single-update path. We
// trade the audit-log volume for clear lineage — the alternative (one
// audit row for the bulk) loses the per-customer trail.

export async function bulkAssign(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ updatedCount: number }> {
  const input = BulkAssignCustomersInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const updateResult = await tx.customer.updateMany({
      where: { id: { in: input.customerIds }, deletedAt: null },
      data: { assignedRepId: input.assignedRepId },
    });

    // Per-row audit. updateMany doesn't return the rows so we re-fetch them
    // and write one audit row per id — small overhead, big traceability win.
    for (const id of input.customerIds) {
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'user' : 'system',
        action: 'crm.customer.assigned',
        entityType: 'Customer',
        entityId: id,
        diff: { after: { assignedRepId: input.assignedRepId } },
      });
    }

    return { updatedCount: updateResult.count };
  });

  // One event per touched id — the segment evaluator and email automations
  // are per-customer; batching at the publish layer would force consumers
  // to re-explode the array.
  await Promise.all(
    input.customerIds.map((customerId) =>
      publishCrmEvent({
        tenantId: ctx.tenantId,
        topic: 'crm.customer.updated',
        payload: { customerId, change: 'assignedRepId' },
        dedupeKey: `crm.customer.updated:assigned:${customerId}:${Date.now()}`,
      })
    )
  );

  return result;
}

export async function bulkTag(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ updatedCount: number }> {
  const input = BulkTagCustomersInput.parse(rawInput);
  if (!input.addTags?.length && !input.removeTags?.length) {
    return { updatedCount: 0 };
  }

  return withTenant(ctx, async (tx) => {
    const customers = await tx.customer.findMany({
      where: { id: { in: input.customerIds }, deletedAt: null },
      select: { id: true, tags: true },
    });

    let updatedCount = 0;
    for (const c of customers) {
      const next = new Set(c.tags);
      input.addTags?.forEach((t) => next.add(t));
      input.removeTags?.forEach((t) => next.delete(t));
      const nextTags = [...next];
      if (sameTags(c.tags, nextTags)) continue;

      await tx.customer.update({ where: { id: c.id }, data: { tags: nextTags } });
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'user' : 'system',
        action: 'crm.customer.tags_updated',
        entityType: 'Customer',
        entityId: c.id,
        diff: { before: { tags: c.tags }, after: { tags: nextTags } },
      });
      updatedCount++;
    }

    return { updatedCount };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Address management
// ─────────────────────────────────────────────────────────────────────────

/** Every address on a customer, default-first then oldest-first. The single
 *  `get` deliberately does NOT include addresses (it stays a cheap one-row read
 *  used by every transport); a surface that needs the addresses asks for them
 *  explicitly, exactly like the B2B account contacts read. 404s on an
 *  unknown/soft-deleted customer so a stale link fails cleanly. */
export async function listAddresses(
  ctx: ServiceContext,
  customerId: string
): Promise<CustomerAddress[]> {
  return withTenant(ctx, async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: customerId, deletedAt: null } });
    if (!customer) throw new CrmNotFoundError('Customer', customerId);
    return tx.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  });
}

export async function addAddress(
  ctx: ServiceContext,
  customerId: string,
  rawInput: unknown
): Promise<CustomerAddress> {
  const input = CreateCustomerAddressInput.parse({ ...(rawInput as object), customerId });
  return withTenant(ctx, async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: customerId, deletedAt: null } });
    if (!customer) throw new CrmNotFoundError('Customer', customerId);

    if (input.isDefault) {
      await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
    }

    return tx.customerAddress.create({
      data: {
        tenantId: ctx.tenantId,
        customerId,
        type: input.type,
        label: input.label,
        isDefault: input.isDefault,
        recipientName: input.recipientName,
        company: input.company,
        line1: input.line1,
        line2: input.line2,
        city: input.city,
        region: input.region ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country,
        phone: input.phone ?? null,
      },
    });
  });
}

/** Edit one address in place. Only the keys present in `rawInput` change (a PATCH
 *  over the address, mirroring the customer PATCH) — an absent key is left as-is,
 *  so the caller can flip `isDefault` without resending the whole address. Making
 *  THIS address the default clears the flag on every other address on the same
 *  customer, so a customer never has two defaults. 404s on an address that is not
 *  this customer's, so a stale link fails cleanly rather than editing a stranger's
 *  row. */
export async function updateAddress(
  ctx: ServiceContext,
  customerId: string,
  addressId: string,
  rawInput: unknown
): Promise<CustomerAddress> {
  const input = UpdateCustomerAddressInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.customerAddress.findFirst({ where: { id: addressId, customerId } });
    if (!existing) throw new CrmNotFoundError('CustomerAddress', addressId);

    if (input.isDefault) {
      await tx.customerAddress.updateMany({
        where: { customerId, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const data: Prisma.CustomerAddressUpdateInput = {};
    if (input.type !== undefined) data.type = input.type;
    if (input.label !== undefined) data.label = input.label;
    if (input.isDefault !== undefined) data.isDefault = input.isDefault;
    if (input.recipientName !== undefined) data.recipientName = input.recipientName;
    if (input.company !== undefined) data.company = input.company;
    if (input.line1 !== undefined) data.line1 = input.line1;
    if (input.line2 !== undefined) data.line2 = input.line2;
    if (input.city !== undefined) data.city = input.city;
    if (input.region !== undefined) data.region = input.region;
    if (input.postalCode !== undefined) data.postalCode = input.postalCode;
    if (input.country !== undefined) data.country = input.country;
    if (input.phone !== undefined) data.phone = input.phone;

    return tx.customerAddress.update({ where: { id: addressId }, data });
  });
}

/** Remove one address. 404s on an address that is not this customer's, so a
 *  stale link cannot delete a stranger's row. */
export async function removeAddress(
  ctx: ServiceContext,
  customerId: string,
  addressId: string
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.customerAddress.findFirst({ where: { id: addressId, customerId } });
    if (!existing) throw new CrmNotFoundError('CustomerAddress', addressId);
    await tx.customerAddress.delete({ where: { id: addressId } });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Document management
// ─────────────────────────────────────────────────────────────────────────

/** Every file attached to a customer, newest first. The bytes live in the media
 *  pipeline; these rows are the links + labels. 404s on an unknown/soft-deleted
 *  customer so a stale link fails cleanly. */
export async function listDocuments(
  ctx: ServiceContext,
  customerId: string
): Promise<CustomerDocument[]> {
  return withTenant(ctx, async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: customerId, deletedAt: null } });
    if (!customer) throw new CrmNotFoundError('Customer', customerId);
    return tx.customerDocument.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  });
}

/** Attach an already-uploaded media asset to a customer as a document. The
 *  upload itself happens through the media pipeline; this only records the link. */
export async function addDocument(
  ctx: ServiceContext,
  customerId: string,
  rawInput: unknown
): Promise<CustomerDocument> {
  const input = CreateCustomerDocumentInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: customerId, deletedAt: null } });
    if (!customer) throw new CrmNotFoundError('Customer', customerId);
    return tx.customerDocument.create({
      data: {
        tenantId: ctx.tenantId,
        customerId,
        mediaAssetId: input.mediaAssetId,
        label: input.label ?? null,
      },
    });
  });
}

/** Detach a document. The row goes; the underlying media asset is left alone (it
 *  may be referenced elsewhere). 404s on a document that is not this customer's. */
export async function removeDocument(
  ctx: ServiceContext,
  customerId: string,
  documentId: string
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.customerDocument.findFirst({
      where: { id: documentId, customerId },
    });
    if (!existing) throw new CrmNotFoundError('CustomerDocument', documentId);
    await tx.customerDocument.delete({ where: { id: documentId } });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────

/** Builds the customer.metadata payload for a marketing opt-in — the list slug,
 *  the free-text note ("what are you building?"), the source, and any extra
 *  first-party context — nested under a `signup` key so it never collides with
 *  other metadata a customer accrues later. */
function buildSignupMeta(
  input: SubscribeCustomerInput,
  capturedAt: string
): Record<string, unknown> {
  const signup: Record<string, unknown> = { ...(input.metadata ?? {}) };
  if (input.list) signup.list = input.list;
  if (input.note) signup.note = input.note;
  signup.source = input.source;
  signup.capturedAt = capturedAt;
  return { signup };
}

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((t, i) => t === sb[i]);
}

// ─────────────────────────────────────────────────────────────────────────
// Lead capture (site forms, docs/115)
// ─────────────────────────────────────────────────────────────────────────

export interface CaptureLeadInput {
  /** The site the lead came from (docs/58 membership scoping). */
  propertyId?: string | null;
  email: string;
  /** Full name — split best-effort into first/last. */
  name?: string | null;
  phone?: string | null;
  /** Organization the lead represents. Filled only when the row has none. */
  company?: string | null;
  /** Origin tag stored in metadata (e.g. 'form'). */
  source?: string;
  /** Extra metadata merged under the captured `source` — the caller's own keys
   *  (e.g. the sparx tenant a platform signup came from). Merged into an existing
   *  row's metadata on re-capture; the caller's keys win, everything else is kept. */
  metadata?: Record<string, unknown>;
  /** Tags unioned onto the row — never removes tags a human added. */
  tags?: string[];
}

/** Upsert a PROSPECT from an inbound lead (a contact-form submission) WITHOUT
 *  implying marketing consent — a form submitter asked us to reply, not to be
 *  marketed to (that's the difference from `subscribe`). Idempotent on
 *  (tenant, property, email); fills name/phone only when the existing row is
 *  missing them, and never clobbers CRM data. Handles the concurrent-insert race
 *  like `subscribe`. */
export async function captureLead(
  ctx: ServiceContext,
  input: CaptureLeadInput
): Promise<{ customer: Customer; created: boolean }> {
  const propertyId = input.propertyId ?? null;
  const { firstName, lastName } = splitName(input.name);

  return withTenant(ctx, async (tx) => {
    // Fill blanks only; resurrect a soft-deleted row so the lead is reachable.
    const link = async (existing: Customer) => {
      const data: Prisma.CustomerUpdateInput = {};
      if (!existing.firstName && firstName) data.firstName = firstName;
      if (!existing.lastName && lastName) data.lastName = lastName;
      if (!existing.phone && input.phone) data.phone = input.phone;
      if (!existing.company && input.company) data.company = input.company;
      if (existing.deletedAt) data.deletedAt = null;
      // Caller metadata is merged (its keys win) rather than replacing the object,
      // so a re-capture never drops what an earlier capture or a human recorded.
      // Written only when the merge actually changes something — a repeated
      // capture of identical data shouldn't churn `updated_at`.
      if (input.metadata) {
        const prior = (existing.metadata ?? {}) as Record<string, unknown>;
        const merged = { ...prior, ...input.metadata };
        if (JSON.stringify(merged) !== JSON.stringify(prior)) {
          data.metadata = merged as Prisma.InputJsonValue;
        }
      }
      const newTags = (input.tags ?? []).filter((t) => !existing.tags.includes(t));
      if (newTags.length > 0) data.tags = [...existing.tags, ...newTags];
      if (Object.keys(data).length === 0) return { customer: existing, created: false };
      const updated = await tx.customer.update({ where: { id: existing.id }, data });
      return { customer: updated, created: false };
    };

    const existing = await tx.customer.findFirst({
      where: { tenantId: ctx.tenantId, propertyId, email: input.email },
    });
    if (existing) return link(existing);

    try {
      const created = await tx.customer.create({
        data: {
          tenantId: ctx.tenantId,
          // An inbound form submission is a fresh lead to work, on a retail
          // relationship until we know otherwise.
          type: 'retail',
          lifecycleStage: 'lead',
          leadStatus: 'new',
          propertyId,
          email: input.email,
          firstName,
          lastName,
          phone: input.phone ?? null,
          company: input.company ?? null,
          tags: input.tags ?? [],
          metadata: { source: input.source ?? 'form', ...input.metadata },
        },
      });
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: null,
        actorType: 'system',
        action: 'crm.customer.captured',
        entityType: 'Customer',
        entityId: created.id,
        diff: { before: null, after: serializeCustomer(created) },
      });
      return { customer: created, created: true };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const raced = await tx.customer.findFirst({
        where: { tenantId: ctx.tenantId, propertyId, email: input.email },
      });
      if (!raced) throw err;
      return link(raced);
    }
  });
}

/** Split a free-text full name into first/last (first token vs the rest). Both
 *  null when empty. */
function splitName(full: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  const trimmed = (full ?? '').trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const sp = trimmed.indexOf(' ');
  if (sp === -1) return { firstName: trimmed, lastName: null };
  return { firstName: trimmed.slice(0, sp), lastName: trimmed.slice(sp + 1).trim() || null };
}

// Serializes a Customer for audit-log JSON. Drops volatile fields that
// would otherwise produce a noisy diff. Decimal columns are stringified
// because Prisma's Decimal type isn't JSON-safe out of the box.
/** A Prisma unique-constraint violation (P2002), checked structurally so we
 *  don't pull the Prisma runtime in just for the error class. Used by
 *  `subscribe` to turn a concurrent-insert race into the idempotent path. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

function serializeCustomer(c: Customer): Record<string, unknown> {
  return {
    id: c.id,
    type: c.type,
    lifecycleStage: c.lifecycleStage,
    leadStatus: c.leadStatus,
    authUserId: c.authUserId,
    b2bAccountId: c.b2bAccountId,
    assignedRepId: c.assignedRepId,
    email: c.email,
    phone: c.phone,
    firstName: c.firstName,
    lastName: c.lastName,
    company: c.company,
    jobTitle: c.jobTitle,
    preferredContactMethod: c.preferredContactMethod,
    doNotContact: c.doNotContact,
    tags: c.tags,
    totalSpent: c.totalSpent.toString(),
    orderCount: c.orderCount,
    deletedAt: c.deletedAt?.toISOString() ?? null,
  };
}
