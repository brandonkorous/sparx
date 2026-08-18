// Tenant-scoping database adapter for the customer Better Auth instance
// (docs/27 v2 §3.2). This is the load-bearing piece of the application-level
// multi-tenancy: it hands Better Auth's stock `prismaAdapter` a PROXY over the
// shared @wizeworks/db client that does exactly two things and nothing else, so all
// of Better Auth's audited where/select/join logic is reused verbatim:
//
//   1. Remaps the mcp() plugin's fixed OAuth model keys (oauthApplication /
//      oauthAccessToken / oauthConsent — NOT config-overridable, verified in the
//      installed better-auth) onto the tenant-scoped CustomerOauth* models, so
//      the customer instance can NEVER touch the STAFF oauth tables. The core
//      four are remapped the supported way via `modelName` options in server.ts.
//   2. Runs every model op inside withTenant(<ambient tenant>, …) — SET LOCAL
//      app.tenant_id on the sparx_app connection — so Postgres RLS scopes it. The
//      tenant comes from the request-scoped `tenantStore` (fail-closed: no tenant
//      in context ⇒ throw, never an unscoped query).
//
// Correctness rests on the DB: FORCE RLS + `@@unique([tenant_id, email])` +
// `tenant_id DEFAULT current_tenant_id()`. This Proxy guarantees the GUC is set.

import { prisma, tenantStore, withTenant, type TxClient } from '@wizeworks/db';

// Better Auth model key → real @wizeworks/db Prisma delegate key. Core keys are the
// SAME on both sides (set via server.ts `modelName` options); only the three
// plugin keys are remapped.
const PLUGIN_MODEL_REMAP: Record<string, string> = {
  oauthApplication: 'customerOauthApplication',
  oauthAccessToken: 'customerOauthAccessToken',
  oauthConsent: 'customerOauthConsent',
};

// Every model key Better Auth's adapter may address on this instance. Anything
// outside this set (symbols, $connect, internal props) passes through untouched.
const BA_MODEL_KEYS = new Set<string>([
  'customerUser',
  'customerSession',
  'customerAccount',
  'customerVerification',
  ...Object.keys(PLUGIN_MODEL_REMAP),
]);

type DelegateMethod = (args: unknown) => Promise<unknown>;
type ModelDelegate = Record<string, DelegateMethod | undefined>;

function realKey(baModel: string): string {
  return PLUGIN_MODEL_REMAP[baModel] ?? baModel;
}

/** Ambient tenant — fail-closed. The customer-auth service always calls Better
 *  Auth inside `tenantStore.run(tenantId, …)`, so this is set for every op. */
function currentTenant(): { tenantId: string } {
  return { tenantId: tenantStore.getTenantIdOrThrow() };
}

/** Invoke `tx[modelKey][method](args)` on the tenant-scoped transaction. */
function invokeOnTx(
  tx: TxClient,
  modelKey: string,
  method: string,
  args: unknown
): Promise<unknown> {
  const model = (tx as unknown as Record<string, ModelDelegate | undefined>)[modelKey];
  const fn = model?.[method];
  if (!fn) throw new Error(`customer-auth adapter: no method ${modelKey}.${method}`);
  return fn(args);
}

/** A per-model delegate whose every method runs inside a tenant-scoped
 *  transaction on the real model (GUC set → RLS enforces the scope). */
function scopedDelegate(baModel: string): ModelDelegate {
  const key = realKey(baModel);
  return new Proxy<ModelDelegate>(
    {},
    {
      get(_t, method: string | symbol) {
        const name = typeof method === 'string' ? method : method.toString();
        return (args: unknown) =>
          withTenant(currentTenant(), (tx) => invokeOnTx(tx, key, name, args));
      },
    }
  );
}

/** A tx wrapper that remaps model keys — handed to Better Auth's `consumeOne`
 *  (the only path that calls `db.$transaction(cb)`), so its `tx[model]` accesses
 *  hit the remapped delegate ON THE SAME tenant-scoped transaction. */
function txScopedClient(tx: TxClient): TxClient {
  return new Proxy(tx, {
    get(target, prop) {
      if (typeof prop === 'string' && BA_MODEL_KEYS.has(prop)) {
        return (target as unknown as Record<string, unknown>)[realKey(prop)];
      }
      return Reflect.get(target, prop) as unknown;
    },
  });
}

/** The client handed to `prismaAdapter`. Intercepts model access + `$transaction`
 *  to enforce tenant scoping and plugin-key remapping; everything else is the
 *  real @wizeworks/db client. */
export const tenantScopedClient: typeof prisma = new Proxy(prisma, {
  get(target, prop) {
    if (prop === '$transaction') {
      return (arg: unknown) => {
        // Better Auth's adapter only uses the callback form (consumeOne).
        if (typeof arg === 'function') {
          return withTenant(currentTenant(), (tx) =>
            (arg as (c: TxClient) => Promise<unknown>)(txScopedClient(tx))
          );
        }
        const realTx = Reflect.get(target, '$transaction') as (a: unknown) => unknown;
        return realTx(arg);
      };
    }
    if (typeof prop === 'string' && BA_MODEL_KEYS.has(prop)) {
      return scopedDelegate(prop);
    }
    return Reflect.get(target, prop) as unknown;
  },
});
