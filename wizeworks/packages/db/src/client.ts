import { PrismaClient } from '@prisma/client';

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

/**
 * The connection URL, with `connection_limit` applied from `DB_CONNECTION_LIMIT`.
 *
 * Prisma sizes its pool as `physical_cpus * 2 + 1` unless the URL says otherwise. Every
 * container here requests a fraction of a core, so Prisma sees ONE cpu and opens a pool
 * of THREE — which is fine for a worker that handles one message at a time, and far too
 * small for api-rest, which runs eight background ticks (social sweeps, scheduled
 * publish, email dispatch, sitebuilder publish, webhook delivery, …) alongside every
 * HTTP request, all sharing those three connections.
 *
 * The result was not a slow API, it was silent data loss: 154 pool timeouts in 45
 * minutes (P2024/P2028), every tick dying mid-transaction. `email-dispatch` is the only
 * publisher of `email.send`, so it never got far enough to publish and NO transactional
 * email had ever been sent on this deployment — the JetStream consumer sat at
 * `delivered: 0` for three days.
 *
 * Why a per-process env var rather than putting the parameter in `DATABASE_URL`: that
 * URL lives in the SHARED `sparx-app-secrets` and is mounted by ~20 services via
 * `envFrom`, so a limit set there multiplies across all of them. api-rest is the process
 * that needs a bigger pool; the single-consumer workers do not.
 *
 * Unset = Prisma's own default, i.e. exactly the previous behaviour.
 */
function connectionUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  const limit = process.env.DB_CONNECTION_LIMIT?.trim();
  if (!raw || !limit) return undefined;
  try {
    const url = new URL(raw);
    // An explicit parameter already in the URL wins — it is the more specific statement.
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', limit);
    }
    return url.toString();
  } catch {
    // A malformed URL is Prisma's error to report, with its much better message.
    return undefined;
  }
}

const datasourceUrl = connectionUrl();

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

export const prisma: PrismaClient =
  globalForPrisma.__sparxPrisma ??
  (new PrismaClient({
    log: logQueries ? ['query', 'warn', 'error'] : ['warn', 'error'],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  }).$extends(withDerivedFields) as unknown as PrismaClient);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__sparxPrisma = prisma;
}
