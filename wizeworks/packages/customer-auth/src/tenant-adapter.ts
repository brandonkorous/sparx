// Tenant-scoping database adapter for the customer Better Auth instance
// (docs/27 v2 §3.2). This is the load-bearing piece of the application-level
// multi-tenancy: it hands Better Auth's stock `prismaAdapter` a PROXY over the
// shared @wizeworks/db client that does exactly three things and nothing else, so all
// of Better Auth's audited where/select/join logic is reused verbatim:
//
//   1. Remaps the OAuth provider's and jwt() plugin's model keys (oauthClient,
//      oauthResource, oauthClientResource, oauthRefreshToken, oauthAccessToken,
//      oauthConsent, oauthClientAssertion, jwks) onto the tenant-scoped
//      Customer* models, so the customer instance can NEVER touch the STAFF
//      oauth tables or the staff signing keys. The core four are remapped the
//      supported way via `modelName` options in server.ts.
//   2. Runs every model op inside withTenant(<ambient tenant>, …) — SET LOCAL
//      app.tenant_id on the sparx_app connection — so Postgres RLS scopes it. The
//      tenant comes from the request-scoped `tenantStore` (fail-closed: no tenant
//      in context ⇒ throw, never an unscoped query).
//   3. Spells a customer user addressed by EMAIL ALONE as the unique key it is
//      here, (tenant, email). Better Auth marks an address confirmed with
//      `update({ where: { email } })`, which a store unique per tenant rejects,
//      so every "confirm it's you" link failed (sparx persona issue 329).
//
// Correctness rests on the DB: FORCE RLS + `@@unique([tenant_id, email])` +
// `tenant_id DEFAULT current_tenant_id()`. This Proxy guarantees the GUC is set.

import { prisma, tenantStore, withTenant, type TxClient } from '@wizeworks/db';

// Better Auth model key → real @wizeworks/db Prisma delegate key. Core keys are the
// SAME on both sides (set via server.ts `modelName` options); only the plugin
// keys are remapped. A plugin key missing here would reach the staff table of
// the same name, so every model the provider and jwt() declare is listed.
const PLUGIN_MODEL_REMAP: Record<string, string> = {
  oauthClient: 'customerOauthClient',
  oauthResource: 'customerOauthResource',
  oauthClientResource: 'customerOauthClientResource',
  oauthRefreshToken: 'customerOauthRefreshToken',
  oauthAccessToken: 'customerOauthAccessToken',
  oauthConsent: 'customerOauthConsent',
  oauthClientAssertion: 'customerOauthClientAssertion',
  jwks: 'customerJwks',
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

/** Methods whose `where` must name a unique key. */
const UNIQUE_WHERE_METHODS = new Set(['update', 'delete', 'findUnique', 'upsert']);

/** `{ where: { email } }` on a customer user, as `{ where: { tenantId_email } }`.
 *  Anything else is returned untouched. Exported for its test. */
export function withTenantEmailKey(
  model: string,
  method: string,
  args: unknown,
  tenantId: string
): unknown {
  if (model !== 'customerUser' || !UNIQUE_WHERE_METHODS.has(method)) return args;
  const where = (args as { where?: Record<string, unknown> } | null)?.where;
  if (!where || typeof where.email !== 'string' || Object.keys(where).length !== 1) return args;
  return {
    ...(args as Record<string, unknown>),
    where: { tenantId_email: { tenantId, email: where.email } },
  };
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
        return (args: unknown) => {
          const scope = currentTenant();
          const keyed = withTenantEmailKey(key, name, args, scope.tenantId);
          return withTenant(scope, (tx) => invokeOnTx(tx, key, name, keyed));
        };
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

interface RuntimeDataModel {
  models: Record<string, unknown>;
}

/** Prisma's model name for a delegate key: `customerJwks` → `CustomerJwks`. */
function modelName(delegateKey: string): string {
  return delegateKey.charAt(0).toUpperCase() + delegateKey.slice(1);
}

/**
 * The data model as Better Auth should see it: each plugin key answered by the
 * model it is really written to. Better Auth 1.7 checks its tables against the
 * client's `_runtimeDataModel` before its first query and refuses every request
 * on a mismatch. Read through untouched, `jwks` named the STAFF key table, whose
 * `platform_brand` this instance never writes, so the check failed although no
 * write ever goes there. Exported for its test.
 */
export function remappedDataModel(real: RuntimeDataModel): RuntimeDataModel {
  const models = { ...real.models };
  for (const [baKey, realDelegate] of Object.entries(PLUGIN_MODEL_REMAP)) {
    const target = real.models[modelName(realDelegate)];
    if (target) models[modelName(baKey)] = target;
  }
  return { ...real, models };
}

let dataModel: RuntimeDataModel | undefined;

/** The client handed to `prismaAdapter`. Intercepts model access + `$transaction`
 *  to enforce tenant scoping and plugin-key remapping; everything else is the
 *  real @wizeworks/db client. */
export const tenantScopedClient: typeof prisma = new Proxy(prisma, {
  get(target, prop) {
    if (prop === '_runtimeDataModel') {
      const real = Reflect.get(target, prop) as RuntimeDataModel | undefined;
      if (!real || typeof real !== 'object' || !('models' in real)) return real;
      return (dataModel ??= remappedDataModel(real));
    }
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
