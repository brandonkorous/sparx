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
  CreateCustomerInput,
  SubscribeCustomerInput,
  UpdateCustomerInput,
} from '@sparx/crm-schemas';
import { NEWSLETTER_SEGMENT_SLUG } from '@sparx/crm-schemas/builtins';
import { withTenant } from '@sparx/db';
import type { Customer, CustomerAddress, Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';
import { ensureBuiltInSegment } from './segment-service';

export { merge, findLikelyDuplicates } from './merge-service';
export type { MergeResult, DuplicateGroup } from './merge-service';

// ─────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────

export interface ListCustomersFilter {
  type?: 'prospect' | 'retail' | 'b2b';
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
      ...(filter.assignedRepId !== undefined ? { assignedRepId: filter.assignedRepId } : {}),
      ...(filter.b2bAccountId !== undefined ? { b2bAccountId: filter.b2bAccountId } : {}),
      ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
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
    const created = await tx.customer.create({
      data: {
        tenantId: ctx.tenantId,
        type: input.type,
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
          type: 'prospect',
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

    const updated = await tx.customer.update({
      where: { id: customerId },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.company !== undefined ? { company: input.company } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
        ...(input.b2bAccountId !== undefined ? { b2bAccountId: input.b2bAccountId } : {}),
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

    return updated;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.customer.updated',
    payload: { customerId: result.id },
    dedupeKey: `crm.customer.updated:${result.id}:${result.updatedAt.toISOString()}`,
  });

  return result;
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
