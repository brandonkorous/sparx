// Activity + Audit — the read side of the awareness layer (docs/124 Phase 2).
//
//   GET /v1/activity  → the human feed: audit rows turned into sentences
//   GET /v1/audit     → the same rows, raw, for forensics
//
// Both read ONE table (`audit_logs`) which is already written from ~337 sites
// across every module. Nothing here writes, and there is no new table: the
// activity feed is a PROJECTION of audit, never a second copy of it. That is
// the rule the whole layer rests on — see docs/124.
//
// The split is audience, not data. `/v1/activity` answers "what's been going
// on?" for a business owner, so it humanizes the action, resolves the actor to
// a name, and pulls a subject out of the diff. `/v1/audit` answers "who did
// what, exactly?" for someone investigating, so it hands back the row as
// stored — ip, user agent, full before/after diff — and dresses up nothing.
//
// The same filters serve an ENTITY TIMELINE: `?entityType=Product&entityId=…`
// is "the history of this one thing", which is why no separate endpoint exists
// for it.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { requireAuth } from '@sparx/api-core/auth';
import {
  moduleForAction,
  sentenceForAction,
  subjectFromDiff,
  READ_ONLY_ACTION_PREFIXES,
} from '../../lib/activity-language.js';

const Query = z.object({
  /** Narrow to one record — this is what makes an entity timeline. */
  entityType: z.string().max(100).optional(),
  entityId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  /**
   * Comma-separated action PREFIXES, e.g. `crm.order.created,crm.customer`.
   * Prefixes rather than exact matches so a caller can ask for a whole family
   * (`commerce.product`) without enumerating its verbs.
   */
  action: z.string().max(400).optional(),
  /** Keyset cursor: return rows strictly older than this ISO instant. */
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

type QueryInput = z.infer<typeof Query>;

function whereFrom(
  input: QueryInput,
  options: { excludeReads: boolean }
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  // Reads are audit, not activity — see READ_ONLY_ACTION_PREFIXES. Excluded in
  // SQL rather than after the fetch, so `limit` still means "50 things that
  // happened" instead of "50 rows, some of which we then threw away".
  if (options.excludeReads) {
    where.NOT = READ_ONLY_ACTION_PREFIXES.map((prefix) => ({
      action: { startsWith: prefix },
    }));
  }

  if (input.entityType) where.entityType = input.entityType;
  if (input.entityId) where.entityId = input.entityId;
  if (input.actorId) where.actorId = input.actorId;
  if (input.before) where.createdAt = { lt: new Date(input.before) };

  const prefixes = (input.action ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (prefixes.length > 0) {
    where.OR = prefixes.map((prefix) => ({ action: { startsWith: prefix } }));
  }

  return where;
}

/** Names for the actors on this page, in one query rather than N.
 *  Staff only — a `system`/`api`/`mcp` actor has no user row, and that's fine:
 *  the feed says "sparx" for those rather than inventing a person. */
async function actorNames(
  tx: Parameters<Parameters<typeof withRequestTenant>[1]>[0],
  ids: readonly string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const users = await tx.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return new Map(
    users.map((user) => {
      // A present-but-blank name must fall through to the email, which `??`
      // would not do — hence the explicit emptiness check rather than `||`.
      const name = user.name?.trim();
      return [user.id, name && name.length > 0 ? name : user.email];
    })
  );
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const activityRoutes: FastifyPluginAsync = async (app) => {
  // ──────────────────────────────────────────────────────────────────────
  // GET /v1/activity — the human feed
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/activity', async (request) => {
    requireAuth(request);
    const input = Query.parse(request.query);

    const { rows, names } = await withRequestTenant(request, async (tx) => {
      const found = await tx.auditLog.findMany({
        where: whereFrom(input, { excludeReads: true }),
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          actorId: true,
          actorType: true,
          diff: true,
          createdAt: true,
        },
      });
      const ids = found.map((row) => row.actorId).filter((id): id is string => id !== null);
      return { rows: found, names: await actorNames(tx, ids) };
    });

    const items = rows.map((row) => ({
      id: row.id,
      at: row.createdAt.toISOString(),
      action: row.action,
      module: moduleForAction(row.action),
      title: sentenceForAction(row.action),
      subject: subjectFromDiff(row.diff),
      entityType: row.entityType,
      entityId: row.entityId,
      actor: {
        id: row.actorId,
        type: row.actorType,
        // A null name is meaningful — it says "not a person did this".
        name: row.actorId ? (names.get(row.actorId) ?? null) : null,
      },
    }));

    return ok({ items });
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET /v1/audit — the forensic view, unembellished
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/audit', async (request) => {
    requireAuth(request);
    const input = Query.parse(request.query);

    const rows = await withRequestTenant(request, async (tx) =>
      tx.auditLog.findMany({
        where: whereFrom(input, { excludeReads: false }),
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      })
    );

    return ok({
      entries: rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actorId: row.actorId,
        actorType: row.actorType,
        diff: row.diff,
        // Null on most rows: the per-module `writeAuditLog` helpers have no
        // request to read them from (docs/124). Reported honestly rather than
        // defaulted to a placeholder that would look like real evidence.
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  });
};

export default activityRoutes;
