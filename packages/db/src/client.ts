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

export const prisma: PrismaClient =
  globalForPrisma.__sparxPrisma ??
  new PrismaClient({
    log: logQueries ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__sparxPrisma = prisma;
}
