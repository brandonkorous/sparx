import type { Prisma, PrismaClient } from '@prisma/client';

import { prisma as defaultPrisma } from './client';

// `Prisma.TransactionClient` is the subset of PrismaClient methods that work
// inside a `$transaction(callback)` — no nested transactions, no $connect, etc.
export type TxClient = Prisma.TransactionClient;

export interface TenantContext {
  tenantId: string;
  userId?: string;
  /**
   * A CEILING on which site this caller may touch (docs/131 §3.2) — set when the
   * credential itself is site-scoped, currently an `sk_live_` API key issued for
   * one business.
   *
   * Deliberately NOT named `propertyId`: that means "the site this call TARGETS"
   * (see `PropertyContext` in the builder services), and the two are different
   * ideas. A target is what you asked for; a ceiling is the most you are allowed
   * to ask for. Conflating them is how a restriction silently becomes a default.
   *
   * `withTenant` ignores this — it is not a second security boundary. `tenant_id`
   * plus RLS remains THE boundary; this narrows an already-authenticated tenant
   * caller to one of its own sites, and is enforced in the application tier at
   * the MCP dispatch point and in `toPropertyContext`.
   */
  restrictToPropertyId?: string | null;
  /**
   * An ALREADY-OPEN, tenant-scoped transaction to compose into. When set,
   * `withTenant` runs `fn` directly on it instead of opening a fresh
   * transaction — so several service calls (and, in the automation engine, the
   * per-step effect + the step-record write) commit ATOMICALLY as one unit.
   *
   * Contract: the caller has already set the tenant GUC on this tx (i.e. it came
   * from an enclosing `withTenant({ tenantId })`), and `tenantId` here MUST match
   * that GUC. We do NOT re-assert the GUC (re-setting it could clobber the
   * enclosing scope), so passing a `tx` whose GUC differs from `tenantId` is a
   * caller bug. Prisma forbids nested `$transaction`, the other reason we reuse
   * rather than wrap.
   */
  tx?: TxClient;
}

// Postgres rejects parameter placeholders for `SET LOCAL`, so we validate the
// id matches the UUID shape before interpolating it. This is the only place in
// the codebase that should string-format a value into raw SQL.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid UUID for ${field}: ${value}`);
  }
}

/**
 * Run `fn` inside a transaction with `app.tenant_id` (and optionally
 * `app.user_id`) set on the connection. Row Level Security policies on
 * tenant-scoped tables filter against these GUCs — every API request handler
 * that touches tenant data must wrap its DB work in `withTenant`.
 *
 * Uses SET LOCAL so the GUC is scoped to the transaction and released on
 * commit/rollback. The transaction is the unit of connection-pinning Prisma
 * provides; without it the next query could land on a different pooled
 * connection that doesn't have the GUC set.
 *
 * @example
 *   const orders = await withTenant({ tenantId: req.tenant.id }, (tx) =>
 *     tx.order.findMany({ where: { status: 'pending' } })
 *   );
 *
 * Pass `context.tx` to compose into an enclosing transaction (see TenantContext.tx).
 */
export interface WithTenantOptions {
  /**
   * How long the transaction may run, in milliseconds.
   *
   * Prisma's default is **5 seconds**, which is the right guard for a request
   * handler and the wrong one for a bulk write. Furnishing a new apparel tenant
   * spends 4.25s inserting 559 rows inside one `withTenant`, so it failed twice
   * and succeeded on the third attempt purely on timing — and a rolled-back
   * transaction leaves no trace of how close it came (issue 164).
   *
   * Set it only where the work is genuinely bulk. Everywhere else, five seconds
   * failing loudly is a feature.
   */
  timeoutMs?: number;
}

export function withTenant<T>(
  context: TenantContext,
  fn: (tx: TxClient) => Promise<T>,
  client: PrismaClient = defaultPrisma,
  options: WithTenantOptions = {}
): Promise<T> {
  assertUuid(context.tenantId, 'tenantId');
  if (context.userId !== undefined) {
    assertUuid(context.userId, 'userId');
  }

  // Compose into an already-open transaction (the GUC is the caller's
  // responsibility — see TenantContext.tx). No nested $transaction, no re-SET.
  if (context.tx) {
    return fn(context.tx);
  }

  return client.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${context.tenantId}'`);
      if (context.userId !== undefined) {
        await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${context.userId}'`);
      }
      return fn(tx);
    },
    // `maxWait` is time to GET a connection, `timeout` is time to use it — the
    // distinction advisory-tick-lock.ts already records. Omitted entirely when
    // nobody asked, so Prisma's defaults keep governing every ordinary call.
    options.timeoutMs ? { maxWait: 10_000, timeout: options.timeoutMs } : undefined
  );
}

/**
 * Run `fn` inside a transaction with NO tenant context — `app.tenant_id` is
 * explicitly cleared so `current_tenant_id()` returns NULL for every query.
 *
 * This is the read path for GLOBAL, cross-tenant data that has its own RLS
 * posture rather than tenant isolation — e.g. the public marketplace catalog
 * (docs/60 §6.3), whose `marketplace_visibility` policy shows only published
 * rows when no tenant is set. Clearing the GUC inside the transaction (rather
 * than relying on a fresh connection) guarantees a pooled connection that a
 * previous `withTenant` ran on can't leak its tenant id into this read.
 *
 * Do NOT use this to bypass tenant isolation on tenant-scoped tables — those
 * stay FORCE-RLS and return zero rows with no tenant set, by design.
 */
export function withSystem<T>(
  fn: (tx: TxClient) => Promise<T>,
  client: PrismaClient = defaultPrisma
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = ''`);
    return fn(tx);
  });
}
