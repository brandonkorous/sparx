// Current-user — preferences, favorites, recents.
//
//   GET    /v1/me/preferences                       → user preferences blob
//   PATCH  /v1/me/preferences                       → patch preferences
//   GET    /v1/me/favorites                         → ordered favorites
//   POST   /v1/me/favorites                         → add one
//   DELETE /v1/me/favorites/:actionId               → remove one
//   PUT    /v1/me/favorites/order                   → reorder all
//   GET    /v1/me/recents                           → recents (limit ?take)
//   POST   /v1/me/recents                           → record visit
//   DELETE /v1/me/recents                           → clear recents
//
// Preferences live on the User row (Better Auth's auth table). Favorites
// and recents are tenant-scoped shell tables (FORCE RLS) — they go through
// `withRequestTenant` so SET LOCAL app.tenant_id lets RLS enforce isolation.
//
// Manifest-id validation (the equivalent of `findFavoritableById` in the
// dashboard) lives client-side — the manifests are presentation metadata
// that don't belong in api-rest. We trust the dashboard to send valid ids;
// duplicate inserts are absorbed via upsert + the unique constraint.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@sparx/db';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { requireAuth } from '@sparx/api-core/auth';
import { LEGAL_DOC_VERSIONS, staleLegalDocs, type LegalDocType } from '@sparx/legal';

const LEGAL_DOC_TYPES = ['terms', 'privacy', 'dpa', 'aup'] as const;
const LegalAcceptBody = z.object({
  docTypes: z.array(z.enum(LEGAL_DOC_TYPES)).min(1).max(4),
});

const DEFAULT_DETAIL_VIEWS = ['drawer', 'modal', 'fullPage', 'newTab'] as const;
const DEFAULT_LIST_VIEWS = ['table', 'card'] as const;

// Product-tour state (docs/132). Rides the same preferences blob as the view
// defaults — the merge-patch below preserves keys it doesn't own, so a
// `{ tour: … }` patch lands without touching them. No new table.
//
// `dismissed` is tier-2 only: the owner declined a module's first-open offer
// card without running its tour. The two tour branches — `welcome` (tier 1) and
// `modules` (tier 2) — are written by independent client flows, so the PATCH
// handler deep-merges `tour` (see below); a shallow overlay would drop whichever
// branch the current patch does not carry.
const TOUR_STATUSES = ['in-progress', 'completed', 'skipped', 'dismissed'] as const;
const TOUR_MODULES = ['builder', 'commerce', 'cms', 'crm', 'email', 'scheduling', 'b2b'] as const;
const TourOutcome = z.object({
  status: z.enum(TOUR_STATUSES),
  version: z.number().int().min(0).max(10_000),
  lastStepId: z.string().min(1).max(60).optional(),
  at: z.string().min(1).max(40),
});
const TourPrefs = z.object({
  welcome: TourOutcome.optional(),
  // `partialRecord`, not `record`: in Zod v4 an enum-keyed `z.record` is
  // EXHAUSTIVE — it rejects any object missing an enum key. A tour patch only
  // ever carries the one module just answered (`{ modules: { commerce } }`), so
  // `record` 422'd every write (and would reject the partial map on read-back
  // too, degrading `tour` to `{}`). `partialRecord` allows the subset.
  modules: z.partialRecord(z.enum(TOUR_MODULES), TourOutcome).optional(),
});

const PreferencesPatch = z.object({
  defaultDetailView: z.enum(DEFAULT_DETAIL_VIEWS).optional(),
  defaultListView: z.enum(DEFAULT_LIST_VIEWS).optional(),
  tour: TourPrefs.optional(),
});

const ActionIdParam = z.object({
  actionId: z.string().min(1).max(255),
});

const FavoriteCreate = z.object({
  actionId: z.string().min(1).max(255),
});

const ReorderBody = z.object({
  orderedActionIds: z.array(z.string().min(1).max(255)).max(1000),
});

const RecordVisitBody = z.object({
  actionId: z.string().min(1).max(255),
});

const RecentsQuery = z.object({
  take: z.coerce.number().int().min(1).max(100).optional(),
});

const DEFAULT_PREFERENCES = {
  defaultDetailView: 'drawer' as const,
  defaultListView: 'table' as const,
};

function parsePreferences(raw: unknown): {
  defaultDetailView: (typeof DEFAULT_DETAIL_VIEWS)[number];
  defaultListView: (typeof DEFAULT_LIST_VIEWS)[number];
  tour: z.infer<typeof TourPrefs>;
} {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFERENCES, tour: {} };
  const obj = raw as Record<string, unknown>;
  const view = obj.defaultDetailView;
  const listView = obj.defaultListView;
  // Tolerant parse: a malformed/legacy tour blob degrades to "not seen" rather
  // than 400ing an unrelated preferences read.
  const tour = TourPrefs.safeParse(obj.tour);
  return {
    defaultDetailView:
      typeof view === 'string' && (DEFAULT_DETAIL_VIEWS as readonly string[]).includes(view)
        ? (view as (typeof DEFAULT_DETAIL_VIEWS)[number])
        : DEFAULT_PREFERENCES.defaultDetailView,
    defaultListView:
      typeof listView === 'string' && (DEFAULT_LIST_VIEWS as readonly string[]).includes(listView)
        ? (listView as (typeof DEFAULT_LIST_VIEWS)[number])
        : DEFAULT_PREFERENCES.defaultListView,
    tour: tour.success ? tour.data : {},
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; no top-level await needed because route registration is sync.
const meRoutes: FastifyPluginAsync = async (app) => {
  // Preferences live on the `users` row. `users` is ENABLE + NO FORCE RLS with
  // a `tenant_id = current_tenant_id()` policy: Better Auth (sparx_owner) owns
  // the table and bypasses it, but api-rest runs as sparx_app and is subject to
  // the policy — so these MUST go through `withRequestTenant` to set the
  // `app.tenant_id` GUC. A bare `prisma.user.*` here sees zero rows (GET) and
  // throws P2025 on update.
  app.get('/v1/me/preferences', async (request) => {
    const auth = requireAuth(request);
    const row = await withRequestTenant(request, (tx) =>
      tx.user.findUnique({
        where: { id: auth.actorId },
        select: { preferences: true },
      })
    );
    return ok(parsePreferences(row?.preferences ?? null));
  });

  app.patch('/v1/me/preferences', async (request) => {
    const auth = requireAuth(request);
    const input = PreferencesPatch.parse(request.body);
    const next = await withRequestTenant(request, async (tx) => {
      const before = await tx.user.findUnique({
        where: { id: auth.actorId },
        select: { preferences: true },
      });
      // Overlay the view defaults onto the WHOLE existing blob rather than
      // rewriting it: `users.preferences` also holds other per-user settings
      // this endpoint does not own (e.g. notification preferences under
      // `notifications`, see routes/v1/notification-preferences.ts). Replacing
      // the object with only the view keys silently dropped those.
      const base =
        before?.preferences &&
        typeof before.preferences === 'object' &&
        !Array.isArray(before.preferences)
          ? (before.preferences as Record<string, unknown>)
          : {};
      // `tour` is a nested blob with two independent branches — `welcome` (tier 1)
      // and `modules` (tier 2) — written by separate client flows. A shallow
      // overlay of `input.tour` would replace the whole `tour` object, dropping the
      // branch this patch doesn't carry (writing a module outcome would erase
      // `welcome`, and completing the welcome tour would erase every module
      // outcome). Deep-merge the tour sub-object, and its `modules` map one level
      // deeper, so each branch composes independently.
      const asRecord = (value: unknown): Record<string, unknown> =>
        value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};
      let mergedTour: Record<string, unknown> | undefined;
      if (input.tour) {
        const baseTour = asRecord(base.tour);
        const baseModules = asRecord(baseTour.modules);
        const mergedModules = { ...baseModules, ...(input.tour.modules ?? {}) };
        mergedTour = {
          ...baseTour,
          ...input.tour,
          ...(Object.keys(mergedModules).length > 0 ? { modules: mergedModules } : {}),
        };
      }
      // The deep-merged blob carries `unknown`-typed values (the tour branch is
      // built structurally), so it is asserted to Prisma's JSON input type — it is
      // by construction a plain JSON object.
      const merged = {
        ...base,
        ...input,
        ...(mergedTour ? { tour: mergedTour } : {}),
      } as Prisma.InputJsonObject;
      await tx.user.update({
        where: { id: auth.actorId },
        data: { preferences: merged },
      });
      // Return only the keys this endpoint owns — the response contract is the
      // view defaults, not the whole blob.
      return parsePreferences(merged);
    });
    return ok(next);
  });

  app.get('/v1/me/favorites', async (request) => {
    const auth = requireAuth(request);
    const rows = await withRequestTenant(request, (tx) =>
      tx.userFavorite.findMany({
        where: { userId: auth.actorId, tenantId: auth.tenantId },
        orderBy: { position: 'asc' },
        select: { actionId: true, position: true, createdAt: true },
      })
    );
    return ok(rows);
  });

  app.post('/v1/me/favorites', async (request, reply) => {
    const auth = requireAuth(request);
    const { actionId } = FavoriteCreate.parse(request.body);
    const row = await withRequestTenant(request, async (tx) => {
      const max = await tx.userFavorite.aggregate({
        where: { userId: auth.actorId, tenantId: auth.tenantId },
        _max: { position: true },
      });
      const nextPos = (max._max.position ?? -1) + 1;
      return tx.userFavorite.upsert({
        where: {
          userId_tenantId_actionId: {
            userId: auth.actorId,
            tenantId: auth.tenantId,
            actionId,
          },
        },
        create: {
          userId: auth.actorId,
          tenantId: auth.tenantId,
          actionId,
          position: nextPos,
        },
        update: {},
        select: { actionId: true, position: true, createdAt: true },
      });
    });
    reply.code(201);
    return ok(row);
  });

  app.delete('/v1/me/favorites/:actionId', async (request, reply) => {
    const auth = requireAuth(request);
    const { actionId } = ActionIdParam.parse(request.params);
    await withRequestTenant(request, (tx) =>
      tx.userFavorite.deleteMany({
        where: { userId: auth.actorId, tenantId: auth.tenantId, actionId },
      })
    );
    reply.code(204);
  });

  app.put('/v1/me/favorites/order', async (request) => {
    const auth = requireAuth(request);
    const { orderedActionIds } = ReorderBody.parse(request.body);
    await withRequestTenant(request, async (tx) => {
      // Two-phase rewrite — mirrors the original service. The unique
      // (user_id, tenant_id, position) index check would fire mid-shuffle,
      // so push every row to a negative interim position first.
      for (let i = 0; i < orderedActionIds.length; i += 1) {
        const id = orderedActionIds[i];
        if (!id) continue;
        await tx.userFavorite.updateMany({
          where: { userId: auth.actorId, tenantId: auth.tenantId, actionId: id },
          data: { position: -(i + 1) },
        });
      }
      for (let i = 0; i < orderedActionIds.length; i += 1) {
        const id = orderedActionIds[i];
        if (!id) continue;
        await tx.userFavorite.updateMany({
          where: { userId: auth.actorId, tenantId: auth.tenantId, actionId: id },
          data: { position: i },
        });
      }
    });
    return ok({ reordered: orderedActionIds.length });
  });

  app.get('/v1/me/recents', async (request) => {
    const auth = requireAuth(request);
    const q = RecentsQuery.parse(request.query);
    const rows = await withRequestTenant(request, (tx) =>
      tx.userRecent.findMany({
        where: { userId: auth.actorId, tenantId: auth.tenantId },
        orderBy: { lastVisitedAt: 'desc' },
        take: q.take ?? 20,
        select: { actionId: true, lastVisitedAt: true },
      })
    );
    return ok(rows);
  });

  app.post('/v1/me/recents', async (request) => {
    const auth = requireAuth(request);
    const { actionId } = RecordVisitBody.parse(request.body);
    await withRequestTenant(request, (tx) =>
      tx.userRecent.upsert({
        where: {
          userId_tenantId_actionId: {
            userId: auth.actorId,
            tenantId: auth.tenantId,
            actionId,
          },
        },
        create: { userId: auth.actorId, tenantId: auth.tenantId, actionId },
        update: { lastVisitedAt: new Date() },
      })
    );
    return ok({ recorded: true });
  });

  app.delete('/v1/me/recents', async (request, reply) => {
    const auth = requireAuth(request);
    await withRequestTenant(request, (tx) =>
      tx.userRecent.deleteMany({
        where: { userId: auth.actorId, tenantId: auth.tenantId },
      })
    );
    reply.code(204);
  });

  // ── Platform legal acceptance (docs/42 §6) ───────────────────────────────
  // platform_legal_acceptance is ENABLE + NO FORCE (like `users`) — read by
  // the owner connection during sign-up, but api-rest runs as sparx_app and is
  // subject to the policy, so these go through withRequestTenant.
  app.get('/v1/me/legal-status', async (request) => {
    const auth = requireAuth(request);
    const rows = await withRequestTenant(request, (tx) =>
      tx.platformLegalAcceptance.findMany({
        where: { userId: auth.actorId },
        orderBy: { acceptedAt: 'desc' },
        select: { docType: true, docVersion: true, acceptedAt: true },
      })
    );
    // Latest accepted version per doc (rows are newest-first).
    const accepted: Partial<Record<LegalDocType, string>> = {};
    for (const r of rows) {
      if (!(r.docType in accepted)) accepted[r.docType as LegalDocType] = r.docVersion;
    }
    return ok({ current: LEGAL_DOC_VERSIONS, accepted, stale: staleLegalDocs(accepted) });
  });

  app.post('/v1/me/legal-accept', async (request) => {
    const auth = requireAuth(request);
    const { docTypes } = LegalAcceptBody.parse(request.body);
    const ua = request.headers['user-agent'];
    const ipAddress = request.ip || null;
    const userAgent = typeof ua === 'string' ? ua : null;
    await withRequestTenant(request, (tx) =>
      tx.platformLegalAcceptance.createMany({
        data: docTypes.map((docType) => ({
          tenantId: auth.tenantId,
          userId: auth.actorId,
          docType,
          docVersion: LEGAL_DOC_VERSIONS[docType].version,
          ipAddress,
          userAgent,
        })),
      })
    );
    return ok({ accepted: docTypes });
  });
};

export default meRoutes;
