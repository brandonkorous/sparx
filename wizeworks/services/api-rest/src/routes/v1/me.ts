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
import type { Prisma } from '@wizeworks/db';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth } from '@wizeworks/api-core/auth';
import { prisma, withSystem } from '@wizeworks/db';
import { brandLegal, staleLegalDocs, type LegalDocType } from '@wizeworks/legal';

/**
 * Which brand this tenant signed up under.
 *
 * Read through `withSystem` for the same reason every other brand lookup does:
 * `tenants` is the non-RLS dispatch row and carries no tenant policy, so a
 * request-scoped read would match nothing. See routes/v1/usage.ts.
 */
async function tenantBrand(tenantId: string): Promise<string | null> {
  const tenant = await withSystem(() =>
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { platformBrand: true } })
  );
  return tenant?.platformBrand ?? null;
}

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
// The KEY SPACE for tier-2 tours — one entry per tool a console can teach.
//
// It began as sparx's seven, which was the set sparx sells as separate modules.
// The Piggles console teaches thirteen, because Piggles ships every app enabled
// (its RULE #2) and so a brand-new owner meets Stock and Money on day one just as
// squarely as Sell. Neither console has to use all of them; an unused key simply
// never appears in a record.
//
// Adding a key is safe and needs no migration — this is a JSON blob, and a key
// that no client writes is a key that never exists. Removing one is not: an
// existing record carrying it would fail this parse and degrade that user's whole
// tour branch to `{}`, re-offering every tour they have already answered.
const TOUR_MODULES = [
  // The console's OWN screens — what Piggles calls Home and sparx calls the
  // workbench. Keyed on the module both fronts, so neither brand's word for it
  // reaches storage.
  'platform',
  'builder',
  'commerce',
  'cms',
  'crm',
  'email',
  'scheduling',
  'b2b',
  'inventory',
  'invoicing',
  'finance',
  'staff',
  'automations',
  'connections',
  'seo',
  'partners',
] as const;
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

// Cookie/tracking consent, recorded against the ACCOUNT rather than a cookie.
//
// It rides this blob for the same reason the tour state does — it is per-user,
// it is small, and the merge-patch below preserves keys it does not own — but it
// is READ-ONLY here, and deliberately absent from `PreferencesPatch` below.
//
// The decision is taken and written on the surface where a customer deals with
// the vendor (Piggles: getpiggles.com; sparx: its own account settings), which
// has a session and direct database access. The CONSOLE only ever renders it and
// gates its analytics on it. Accepting a patch here would give the operating app
// a way to change a consent record — which is the one thing a tracked surface
// must not be able to do to its own tracking permission.
//
// `at` is required alongside the flags: consent that cannot be dated cannot be
// evidenced. A record missing it degrades to "no decision", which re-asks.
const ConsentPrefs = z.object({
  analytics: z.boolean(),
  at: z.string().min(1).max(40),
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
  consent: z.infer<typeof ConsentPrefs> | null;
} {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFERENCES, tour: {}, consent: null };
  const obj = raw as Record<string, unknown>;
  const view = obj.defaultDetailView;
  const listView = obj.defaultListView;
  // Tolerant parse: a malformed/legacy tour blob degrades to "not seen" rather
  // than 400ing an unrelated preferences read.
  const tour = TourPrefs.safeParse(obj.tour);
  // Absent OR malformed both mean "no decision on record", and `null` is the
  // only value that can carry that. It must never fall back to a default object
  // — an all-false default is indistinguishable from a real refusal, and an
  // all-true one grants a permission nobody gave.
  const consent = ConsentPrefs.safeParse(obj.consent);
  return {
    consent: consent.success ? consent.data : null,
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
      // Return the same shape GET does, not the whole blob. That includes
      // `consent`, which this endpoint reads but cannot write — it is carried
      // through from `base` untouched, so a view-default patch never disturbs a
      // consent record and the client sees a consistent view either way.
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
    // WHICH documents, and which versions, depends on the brand this tenant
    // signed up under — they are different documents on different domains.
    const brand = await tenantBrand(auth.tenantId);
    return ok({
      current: brandLegal(brand).versions,
      accepted,
      stale: staleLegalDocs(brand, accepted),
    });
  });

  app.post('/v1/me/legal-accept', async (request) => {
    const auth = requireAuth(request);
    const { docTypes } = LegalAcceptBody.parse(request.body);
    const ua = request.headers['user-agent'];
    const ipAddress = request.ip || null;
    const userAgent = typeof ua === 'string' ? ua : null;
    const legal = brandLegal(await tenantBrand(auth.tenantId));
    // A document this brand does not publish cannot be accepted. Silently
    // recording a version for it would put a row in the evidence table naming a
    // page nobody can open — see the same rule in @wizeworks/legal.
    const rows = docTypes.flatMap((docType) => {
      const meta = legal.versions[docType];
      return meta ? [{ docType, docVersion: meta.version }] : [];
    });
    await withRequestTenant(request, (tx) =>
      tx.platformLegalAcceptance.createMany({
        data: rows.map((row) => ({
          tenantId: auth.tenantId,
          userId: auth.actorId,
          docType: row.docType,
          docVersion: row.docVersion,
          ipAddress,
          userAgent,
        })),
      })
    );
    return ok({ accepted: rows.map((r) => r.docType) });
  });
};

export default meRoutes;
