// The brand partition for staff logins.
//
// Both products mount ONE Better Auth instance against ONE `users` table, so
// until this existed a person who signed up on one brand signed in to the other
// with the same password. Not two accounts — one row, authenticating on every
// deployment that mounted the instance.
//
// This hands Better Auth's stock `prismaAdapter` a PROXY over `authPrisma` that
// does two things to the `user` model and nothing else: it ANDs the deployment's
// brand into every read, and it stamps that brand onto every create. All of
// Better Auth's audited where/select/join logic is reused verbatim — the same
// approach, and for the same reason, as the tenant-scoped client the shopper
// instance uses (@wizeworks/customer-auth's tenant-adapter.ts).
//
// ── WHY THE ADAPTER AND NOT THE CALL SITES ──────────────────────────────────
//
// The riskiest lookup is not ours to edit. `accountLinking.trustedProviders`
// flows into Better Auth's own `findOAuthUser`, which resolves a user by the
// provider's verified email platform-wide and links onto whatever it finds. So
// does password sign-in, magic link, email OTP, password reset, email
// verification and One Tap. There is no `where` clause of ours in any of them.
// What they DO share is a single `DBAdapter` object — there is no per-plugin
// adapter — so scoping the client underneath it is the only thing that reaches
// all of them at once, and the only thing that cannot be forgotten by the next
// plugin somebody registers.
//
// ── WHY A FILTER AND NOT ROW-LEVEL SECURITY ─────────────────────────────────
//
// RLS is how the shopper instance does it, and it does not transfer.
// `authPrisma` connects as `sparx_owner`, the table owner, so a policy only
// bites under FORCE — and 20260527162200_auth_tables_no_force_rls dropped FORCE
// from users/sessions/accounts precisely so auth could read them before a tenant
// is known. FORCE applies to every policy on a table at once, so putting it back
// would re-arm `users_tenant_isolation` and lock out sign-in itself. The
// database still backstops this: `users_brand_email_unique` means two brands can
// never collide on one address even if a call site escapes the proxy.
//
// ── THE FAILURE THIS CLOSES IS SILENT ───────────────────────────────────────
//
// Better Auth's Prisma adapter resolves users with `findFirst`, never
// `findUnique`. So dropping the global unique on `email` WITHOUT this filter
// would not raise anything — it would return whichever brand's row Postgres
// handed back first, which is worse than the leak it replaced because it is
// non-deterministic. The filter is not a hardening pass on the migration; it is
// the half that makes the migration safe.

import type { PrismaClient } from '@prisma/client';
import { currentPlatformBrand } from '@wizeworks/brand-core';
import { authPrisma } from './prisma';

/** The Prisma delegate key this proxy scopes. Sessions and accounts are keyed by
 *  `user_id` and carry no brand of their own — deliberately untouched. A session
 *  cookie minted under the other brand still dies correctly, because resolving
 *  its user by id returns nothing through this filter. */
const SCOPED_MODEL = 'user';

/** Prisma's generated `where` key for `@@unique([platformBrand, email])`.
 *
 *  It is the FIELD NAMES joined by an underscore, not the `map:` value — `map:`
 *  names the database constraint and leaves the client key alone. Same shape as
 *  `organizationId_userId` on `members`, whose constraint is mapped to
 *  `members_org_user_unique` while the client still addresses it by its fields. */
const BRAND_EMAIL_KEY = 'platformBrand_email';

type Args = Record<string, unknown>;
type DelegateMethod = (args?: unknown) => unknown;
type ModelDelegate = Record<string, DelegateMethod | undefined>;

/**
 * The brand this process signs people in as.
 *
 * `currentPlatformBrand()` falls back to the default brand when `PLATFORM_BRAND`
 * is unset, which is the safe direction rather than a gap: a deployment that
 * forgets to declare itself scopes to the WRONG brand and its customers cannot
 * sign in — loud, and recoverable by setting one variable. It cannot resolve to
 * "no filter", which is the only outcome that would leak.
 */
function brand(): string {
  const key = currentPlatformBrand();
  if (!key) {
    // Unreachable via currentPlatformBrand()'s own contract; here so that a
    // future change to that contract fails closed rather than unscoped.
    throw new Error('brand-scoped auth: no platform brand resolved; refusing an unscoped query.');
  }
  return key;
}

/** AND the brand onto a filter. Wrapping rather than spreading because the
 *  incoming `where` may carry its own root `OR` or `AND` from Better Auth's
 *  clause builder, and a spread would sit beside them rather than constrain
 *  them. */
function scopedWhere(where: unknown): Args {
  return { AND: [(where ?? {}) as Args, { platformBrand: brand() }] };
}

/**
 * Narrow a `where` that Prisma requires to be UNIQUE.
 *
 * Better Auth's adapter decides between `update` and `updateMany` by asking its
 * OWN schema whether a field is unique — and in that schema `user.email` still
 * is. So `updateUserByEmail` (password reset, email change) arrives here as
 * `update({ where: { email } })`, and `email` on its own is no longer a valid
 * `UserWhereUniqueInput`. Rewriting it to the compound key is what keeps those
 * two flows working; without it they throw at Prisma rather than doing the wrong
 * thing, which is why they are the first flows to test.
 *
 * An `id` where needs no rewrite — it is already unique — and simply gains the
 * brand as an extra filter, which Prisma accepts on a unique where.
 */
function scopedUniqueWhere(where: unknown): Args {
  const w = { ...((where ?? {}) as Args) };
  const platformBrand = brand();

  if (typeof w.email === 'string' && w.id === undefined) {
    const { email, ...rest } = w;
    return { ...rest, [BRAND_EMAIL_KEY]: { platformBrand, email } };
  }

  return { ...w, platformBrand };
}

/** Every delegate method the Prisma adapter calls on a model, and what each one
 *  needs done to it.
 *
 *  An unlisted method THROWS rather than passing through. A query this file does
 *  not understand is a query it cannot scope, and an unscoped read of `users` is
 *  the exact defect the whole partition exists to prevent — so the failure has to
 *  be loud. If a Better Auth upgrade starts calling something new, the first sign
 *  should be an error naming the method, not a person signing in to the wrong
 *  product. */
function scopeArgs(method: string, rawArgs: unknown): unknown {
  const args = { ...((rawArgs ?? {}) as Args) };

  switch (method) {
    // Reads and bulk writes: a plain filter, so AND the brand on.
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'findMany':
    case 'count':
    case 'updateMany':
    case 'deleteMany':
      return { ...args, where: scopedWhere(args.where) };

    // Prisma demands a unique `where` for these.
    case 'findUnique':
    case 'findUniqueOrThrow':
    case 'update':
    case 'delete':
      return { ...args, where: scopedUniqueWhere(args.where) };

    // The brand is written LAST, so it wins over anything in the payload. This
    // proxy is the guarantee that a row lands on the right product, and a
    // guarantee a caller can overwrite by passing a field is not one — it would
    // fail open in exactly the case worth catching, a payload carrying the other
    // brand's key.
    case 'create':
      return { ...args, data: { ...((args.data ?? {}) as Args), platformBrand: brand() } };

    case 'upsert':
      return {
        ...args,
        where: scopedUniqueWhere(args.where),
        create: { ...((args.create ?? {}) as Args), platformBrand: brand() },
      };

    default:
      throw new Error(
        `brand-scoped auth: no brand scoping defined for user.${method}; refusing an unscoped query.`
      );
  }
}

/** A delegate whose every method is brand-scoped before it reaches Prisma. */
function scopedDelegate(target: ModelDelegate): ModelDelegate {
  return new Proxy<ModelDelegate>(
    {},
    {
      get(_t, prop: string | symbol) {
        // Symbols pass straight through. They are never query methods —
        // `Symbol.toStringTag`, `Symbol.iterator` and the promise-detection
        // probes runtimes make — and stringifying one would look up
        // "Symbol(Symbol.toStringTag)" on the delegate, which is not a key on
        // anything and would quietly answer undefined for all of them.
        if (typeof prop === 'symbol') return Reflect.get(target, prop) as never;

        const fn = target[prop];
        if (typeof fn !== 'function') return fn;
        return (args?: unknown) => fn.call(target, scopeArgs(prop, args));
      },
    }
  );
}

/** Re-scope a transaction client so the filter survives inside `$transaction`.
 *
 *  Better Auth's `consumeOne` is the one path that opens a transaction, and with
 *  the adapter's default `transaction: false` the client it hands the callback
 *  is the RAW one. Proxying the Prisma client rather than the adapter is what
 *  lets this be closed here instead of being a hole nobody sees. */
function scopedTx(tx: object): object {
  return new Proxy(tx, {
    get(target, prop) {
      const value = Reflect.get(target, prop) as unknown;
      if (prop === SCOPED_MODEL && value && typeof value === 'object') {
        return scopedDelegate(value as ModelDelegate);
      }
      return value;
    },
  });
}

/**
 * The client handed to `prismaAdapter` — and ONLY to it.
 *
 * `authPrisma` keeps its own export and stays unscoped on purpose: the members
 * and invitations reads, `mcp-oauth.ts`'s raw join and the operator console all
 * legitimately span brands, and narrowing them would break reads that are
 * supposed to see everything.
 */
export const brandScopedAuthPrisma: PrismaClient = new Proxy(authPrisma, {
  get(target, prop) {
    if (prop === '$transaction') {
      return (arg: unknown, ...rest: unknown[]) => {
        const real = Reflect.get(target, '$transaction') as (...a: unknown[]) => unknown;
        // Better Auth only ever uses the callback form; the array form is passed
        // through so an unexpected caller behaves like plain Prisma.
        if (typeof arg !== 'function') return real.call(target, arg, ...rest);
        return real.call(
          target,
          (tx: object) => (arg as (c: object) => unknown)(scopedTx(tx)),
          ...rest
        );
      };
    }
    if (prop === SCOPED_MODEL) {
      const delegate = Reflect.get(target, prop) as unknown;
      if (delegate && typeof delegate === 'object') {
        return scopedDelegate(delegate as ModelDelegate);
      }
      return delegate;
    }
    return Reflect.get(target, prop) as unknown;
  },
});
