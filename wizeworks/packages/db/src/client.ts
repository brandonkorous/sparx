import { PrismaClient } from '@prisma/client';
import { connectionLimit, connectionUrl } from './connection-limit';

// Single PrismaClient per process. Next.js dev mode reloads modules on every
// request, which would otherwise leak connections — we cache on `globalThis`.

const globalForPrisma = globalThis as unknown as {
  __sparxPrisma?: PrismaClient;
};

// QUERY LOGGING IS OPT-IN, not implied by `NODE_ENV=development`.
//
// It used to be on for every dev process, which meant every `pnpm dev` printed the
// full SQL of every statement — parameter placeholders and all — across five apps and
// the API at once. The signal-to-noise was bad enough that real warnings scrolled past
// unread, which is the actual cost: a log nobody can read is not a log.
//
// It got worse when api-rest started publishing its own marketplace catalog on boot:
// ~140 upserts, each printing a full multi-line INSERT … ON CONFLICT … RETURNING every
// time the service restarts.
//
// `warn` and `error` stay on everywhere — those are the ones worth seeing. Set
// `PRISMA_LOG_QUERIES=1` when you are actually debugging a query.
const logQueries = process.env.PRISMA_LOG_QUERIES === '1';

// Every process gets a small pool unless it asks for more; see ./connection-limit.
const pool = connectionLimit(process.env);
const datasourceUrl = connectionUrl(process.env);
if (datasourceUrl) console.info(`[db] connection_limit=${pool.limit} (${pool.source})`);

/**
 * `customer.company` — the field name every consumer already reads.
 *
 * The COLUMN is `customers.company_name` and the Prisma field is `companyName`,
 * because `Customer.company` had to be freed up for the relation to the Company
 * record (docs/144 §11). That is an internal rename. It is NOT a wire rename:
 * `company` is the key in the create/update schema, in the segment source
 * `customer.company`, in the scoring paths and in the CSV import header, and it
 * is what every payload carrying a customer has always published.
 *
 * Doing this as a computed field rather than a serializer is the whole point. A
 * customer does not only cross the wire from the customers routes — it rides
 * along inside a deal, a ticket, an order, a cart, a booking and a chat thread,
 * about 120 places in all, every one of them a plain Prisma `include`. A
 * serializer would have to be remembered at each of them, and at each new one
 * forever after; this is derived once, at the client, and is therefore correct
 * everywhere by construction — including places nobody has written yet.
 *
 * `needs` makes Prisma fetch `companyName` even under a narrowing `select`, so
 * the value is never quietly null. Raw SQL bypasses extensions and builds its
 * own shapes, which is fine — it always did.
 *
 * ── WHAT THIS COSTS, AND THE GUARD THAT COLLECTS IT ───────────────────────
 *
 * `Customer.company` is ALSO the relation to the Company record, and this
 * computed field SHADOWS it. A query that asks for the relation is accepted,
 * runs, and hands back the computed string instead — silently. MEASURED
 * 2026-09-20 against the running database:
 *
 *     company read directly   { companyName: 'Loom and Larder' }
 *     relation via customer   { companyId: '9b6d…', company: null }
 *     same join in raw SQL    [{ company_name: 'Loom and Larder' }]
 *
 * Two screens were built on that join and neither had ever rendered a business
 * name: the order detail's "Wholesale customer" line and the wholesale
 * approvals queue (issue 751). Both now fetch the business under a name of
 * its own — see `accountsFor` in @wizeworks/crm's order-service.
 *
 * `pnpm check:shadowed` reads the pairs below and fails the build on any
 * select of a shadowed name, at any depth and under any relation that leads to
 * the model, and on any read of one as if it were the relation
 * (`customer.company.creditLimit`). The client is cast back to `PrismaClient`
 * below, so TypeScript still types `customer.company` as the account and will
 * not catch either. Adding a computed field here therefore adds a
 * name that platform queries may no longer join on, which is a real cost and
 * is why this list is one entry long.
 */
const withDerivedFields = {
  result: {
    customer: {
      company: {
        needs: { companyName: true },
        compute: (customer: { companyName: string | null }): string | null => customer.companyName,
      },
    },
  },
} as const;

/**
 * WizeLens query tracing. A service or app that traces itself (api-rest's
 * lib/wizelens.ts, a Next.js app's instrumentation.ts) puts a Prisma extension
 * here BEFORE this module loads. Unset everywhere else, so the client is
 * exactly what it was.
 */
const wizelensExtension = (globalThis as { __wizelensPrisma?: { name: string } }).__wizelensPrisma;

/**
 * A one-method view of the client, on purpose: Prisma's own `$extends` typing
 * over an already-extended client is "excessively deep" (TS2589) for tsc.
 */
interface Extendable {
  $extends(extension: unknown): unknown;
}

function createClient(): PrismaClient {
  const client = new PrismaClient({
    log: logQueries ? ['query', 'warn', 'error'] : ['warn', 'error'],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  }).$extends(withDerivedFields) as unknown as PrismaClient;
  if (!wizelensExtension) return client;
  return (client as unknown as Extendable).$extends(wizelensExtension) as PrismaClient;
}

export const prisma: PrismaClient = globalForPrisma.__sparxPrisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__sparxPrisma = prisma;
}
