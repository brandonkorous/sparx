import { AsyncLocalStorage } from 'node:async_hooks';

// Request-scoped tenant context (docs/27 §3.1).
//
// `withTenant(tenantId, fn)` takes the tenant EXPLICITLY — the caller threads it
// into every DB call. That works for handler code we write, but not for a
// third-party data layer that calls its adapter itself (the customer Better Auth
// instance: `auth.api.signIn(...)` → adapter → `prisma.user.findFirst(...)`, with
// no seam to pass a tenant through). Those ops need the tenant from AMBIENT
// context instead.
//
// For a shopper the tenant is known BEFORE auth — it's the storefront host — so a
// Fastify preHandler resolves it once and runs the whole request inside
// `tenantStore.run(tenantId, …)`. The customer-auth tenant-scoping adapter
// (wizeworks/packages/customer-auth) reads `getTenantIdOrThrow()` to set `app.tenant_id`
// on every Better Auth query. AsyncLocalStorage keeps this correct across every
// `await` in the request without a global mutable that a concurrent request
// could clobber.
//
// This is a NARROW primitive — the explicit `withTenant(tenantId, fn)` remains
// the norm everywhere we control the call path. `tenantStore` exists only for the
// customer-auth adapter seam; do not reach for it to avoid threading a tenant you
// already have in hand.

export interface TenantScope {
  tenantId: string;
}

const storage = new AsyncLocalStorage<TenantScope>();

export const tenantStore = {
  /** Run `fn` with `tenantId` as the ambient request tenant. Nesting replaces the
   *  scope for the inner run (last-writer-wins), matching AsyncLocalStorage. */
  run<T>(tenantId: string, fn: () => T): T {
    return storage.run({ tenantId }, fn);
  },

  /** The ambient tenant id, or null when called outside a `run(...)`. Prefer
   *  `getTenantIdOrThrow` on any path where a missing tenant is a bug. */
  getTenantId(): string | null {
    return storage.getStore()?.tenantId ?? null;
  },

  /** The ambient tenant id — throws if there is none. FAIL-CLOSED: a tenant-scoped
   *  op that reaches here with no context must abort, never run unscoped (which,
   *  under FORCE RLS, would either return zero rows or — worse, on a non-forced
   *  path — leak). The customer-auth adapter calls this before every query. */
  getTenantIdOrThrow(): string {
    const id = storage.getStore()?.tenantId;
    if (!id) {
      throw new Error(
        'tenantStore: no tenant in context — a tenant-scoped operation ran outside tenantStore.run(). ' +
          'This is a fail-closed guard against unscoped cross-tenant queries.'
      );
    }
    return id;
  },
};
