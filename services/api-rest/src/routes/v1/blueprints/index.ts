// Tenant Blueprints (docs/54) — the marketplace catalog + install/go-live API.
//
//   GET  /v1/blueprints                      → catalog (+ this site's install state)
//   GET  /v1/blueprints/:key                 → one blueprint (summary + contents)
//   POST /v1/blueprints/:key/install         → install into a target property (draft)
//   GET  /v1/blueprints/installs             → this tenant's installs
//   GET  /v1/blueprints/installs/:id         → one install (id map + counts)
//   POST /v1/blueprints/installs/:id/go-live → publish everything the install created
//
// Install/go-live are admin-only (they enable modules + mutate many surfaces).
// The property a template installs into (docs/49 Phase 8) is, in priority order:
// an explicit `property_id` in the install body (validated to the tenant — the
// New-site wizard installs into the site it just created, which isn't the active
// one yet), else the ACTIVE site (the switcher's `x-sparx-property-id`), else the
// tenant's primary. The installer writes the tenant brand for the primary and a
// per-site `brand_override` for a secondary, so installing onto one site never
// rebrands its siblings (superseding the docs/54 D6 "always primary" rule).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { withTenant } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { conflict, notFound } from '@sparx/api-core/errors';
import {
  getBlueprint,
  listBlueprints,
  safeParseBlueprint,
  toSummary,
  type Blueprint,
} from '@sparx/blueprints';

import { requireTenantProperty, resolvePropertyId } from '../../../lib/property.js';
import { readArtifact } from '../../../lib/marketplace/artifacts.js';
import {
  deleteInstall,
  findInstall,
  goLiveInstall,
  installBlueprint,
  type InstallResult,
} from '../../../lib/blueprint-installer.js';
import { applyUpdate, planUpdate } from '../../../lib/blueprint-updater.js';

const KeyParam = z.object({ key: z.string().min(1).max(63) });
const IdParam = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  // `installed=true` restricts the catalog to THIS site's installs (the in-Builder
  // /builder/blueprints view), so the list + pager total reflect what's installed
  // rather than the whole marketplace (eval Finding 8). An enum so only the literal
  // 'true' filters — `z.coerce.boolean()` would treat 'false' as truthy.
  installed: z.enum(['true', 'false']).optional(),
});
// Install target (docs/49 Phase 8): an explicit site to install into. Optional —
// absent falls back to the active site (header) then primary. The body itself is
// optional (a bare POST still installs into the active/primary site).
const InstallBody = z.object({ property_id: z.string().uuid().optional() }).default({});
// Update apply (docs/55 §10): per-conflict resolutions. Each entry is a conflict id
// (`${kind}:${naturalKey}#${path}`) the tenant chose to take from the blueprint; any
// conflict not listed defaults to keeping the tenant's value (docs/55 U1).
const UpdateBody = z
  .object({ take_theirs: z.array(z.string().max(512)).max(2000).optional() })
  .default({});

/** The site switcher's active-property header, when present. */
function activePropertyHeader(headers: Record<string, unknown>): string | null {
  const h = headers['x-sparx-property-id'];
  return typeof h === 'string' && h.length > 0 ? h : null;
}

// Resolve a blueprint manifest DATA-FIRST (docs/85 §7): the source of truth is the
// compiled artifact in object storage (`marketplace/blueprints/<slug>/<version>.json`),
// read by the thin catalog row's pinned `version` and parsed back into a Blueprint.
// Falls back to the in-code @sparx/blueprints registry for any row whose artifact
// was never ingested — so a no-deploy publish adds blueprints purely as data, while
// the legacy code blueprints keep installing during migration.
async function resolveBlueprint(tenantId: string, key: string): Promise<Blueprint | null> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.marketplaceBlueprint.findFirst({ where: { slug: key }, select: { version: true } })
  );
  if (row) {
    const artifact = await readArtifact('blueprints', key, row.version);
    if (artifact != null) {
      const parsed = safeParseBlueprint(artifact);
      if (parsed.success) return parsed.data;
    }
  }
  return getBlueprint(key);
}

/** A small "what this creates" breakdown for the browse/detail card. */
function summarizeContents(bp: Blueprint) {
  const c = bp.commerce;
  return {
    products: c?.products.length ?? 0,
    categories: c?.categories.length ?? 0,
    collections: c?.collections.length ?? 0,
    content: bp.content.length,
    pages: bp.site?.pages.length ?? 0,
    emails: bp.emails.length,
    theme: bp.theme.name,
    hasFrame: Boolean(bp.site?.frame),
  };
}

interface InstallRow {
  id: string;
  propertyId: string;
  blueprintKey: string;
  blueprintVersion: string;
  status: string;
  result: unknown;
  installedAt: Date;
  liveAt: Date | null;
}

function serializeInstall(row: InstallRow) {
  const result = (row.result ?? {}) as Partial<InstallResult>;
  return {
    id: row.id,
    property_id: row.propertyId,
    blueprint_key: row.blueprintKey,
    blueprint_version: row.blueprintVersion,
    status: row.status,
    counts: result.counts ?? {},
    installed_at: row.installedAt.toISOString(),
    live_at: row.liveAt?.toISOString() ?? null,
  };
}

/** Detail view — adds the id-map (what was created) so the dashboard "Review &
 *  go live" surface can list each artifact and deep-link into its editor. */
function serializeInstallDetail(row: InstallRow) {
  const result = (row.result ?? {}) as Partial<InstallResult>;
  return {
    ...serializeInstall(row),
    artifacts: {
      pages: result.pages ?? [],
      products: result.products ?? [],
      content: result.content ?? [],
      emails: result.emails ?? [],
      categories: result.categories ?? {},
      collections: result.collections ?? {},
      theme: result.theme ?? null,
    },
  };
}

const blueprintRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/blueprints', async (request) => {
    const auth = requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const take = Math.min(q.take ?? 50, 250);
    const skip = q.skip ?? 0;
    const installedOnly = q.installed === 'true';
    // Per-site install state (docs/49 Phase 8): a blueprint installs into a
    // specific site, so the catalog reads the ACTIVE site's install rows (the
    // switcher's header, else primary) — a secondary site shows ITS own
    // installed/available badges, not the primary's.
    const propertyId = await resolvePropertyId(auth, activePropertyHeader(request.headers));
    // The active site's install rows drive the per-card badges AND — for the
    // installed-only view — which catalog rows the list + count are scoped to, so
    // they must be read BEFORE the catalog query to build its `where`.
    const installs = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.tenantBlueprintInstall.findMany({
        where: { propertyId },
        select: { id: true, blueprintKey: true, blueprintVersion: true, status: true },
      })
    );
    const byKey = new Map(installs.map((i) => [i.blueprintKey, i]));

    // Installed-only (docs/54): /builder/blueprints lists ONLY this site's
    // installs, so the catalog query + count are restricted to the installed slugs
    // — the pager total then reflects the installed list, not the whole marketplace
    // (eval Finding 8). With no installs, `slug: { in: [] }` matches nothing, so the
    // page is empty and never falls back to the in-code registry.
    const installedKeys = installs.map((i) => i.blueprintKey);
    const where = installedOnly
      ? { status: 'published' as const, visibility: 'public' as const, slug: { in: installedKeys } }
      : { status: 'published' as const, visibility: 'public' as const };
    const [rows, catalogTotal] = await Promise.all([
      // DATA-first (docs/85): the catalog is the thin marketplace rows, so
      // bundle-ingested blueprints show up here alongside the legacy code ones.
      withTenant({ tenantId: auth.tenantId }, (tx) =>
        tx.marketplaceBlueprint.findMany({
          where,
          orderBy: { sortWeight: 'desc' },
          take,
          skip,
          select: {
            slug: true,
            name: true,
            tagline: true,
            description: true,
            vertical: true,
            requiredModules: true,
            contents: true,
            version: true,
            media: true,
          },
        })
      ),
      withTenant({ tenantId: auth.tenantId }, (tx) => tx.marketplaceBlueprint.count({ where })),
    ]);

    const installState = (key: string, version: string) => {
      const inst = byKey.get(key);
      // Version-drift (§9): when the installed version trails the catalog's, the
      // card offers an upgrade hint (the apply itself is deferred, §13 step 5).
      return inst
        ? {
            id: inst.id,
            status: inst.status,
            version: inst.blueprintVersion,
            update_available: inst.blueprintVersion !== version,
          }
        : null;
    };

    // Fallback to the in-code registry only when the catalog table is genuinely
    // empty (a fresh dev DB before the seed/ingest has run) — NOT merely when a
    // paginated page lands past the last row, which would wrongly resurrect the
    // legacy list on page 2+. The installed-only view never falls back (an empty
    // install set is a real "nothing installed", not a missing catalog).
    const usingFallback = !installedOnly && catalogTotal === 0;
    const fallbackAll = usingFallback ? listBlueprints() : [];
    const total = usingFallback ? fallbackAll.length : catalogTotal;

    const blueprints = usingFallback
      ? fallbackAll.slice(skip, skip + take).map((bp) => ({
          ...toSummary(bp),
          contents: summarizeContents(bp),
          install: installState(bp.key, bp.version),
        }))
      : rows.map((r) => {
          const media = Array.isArray(r.media) ? (r.media as { url?: string }[]) : [];
          return {
            key: r.slug,
            name: r.name,
            summary: r.tagline ?? r.description ?? '',
            vertical: r.vertical,
            version: r.version,
            requiredModules: r.requiredModules,
            ...(media[0]?.url ? { preview: media[0].url } : {}),
            contents: (r.contents ?? {}) as Record<string, unknown>,
            install: installState(r.slug, r.version),
          };
        });
    // `property_id` rides in the meta alongside the pagination fields so the
    // dashboard still gets the active site's id while the list paginates.
    return paged(blueprints, { total, per_page: take, property_id: propertyId });
  });

  app.get('/v1/blueprints/:key', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { key } = KeyParam.parse(request.params);
    const row = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.marketplaceBlueprint.findFirst({
        where: { slug: key },
        select: {
          slug: true,
          name: true,
          tagline: true,
          description: true,
          vertical: true,
          requiredModules: true,
          contents: true,
          version: true,
          media: true,
        },
      })
    );
    if (row) {
      const media = Array.isArray(row.media) ? (row.media as { url?: string }[]) : [];
      return ok({
        key: row.slug,
        name: row.name,
        summary: row.tagline ?? row.description ?? '',
        vertical: row.vertical,
        version: row.version,
        requiredModules: row.requiredModules,
        ...(media[0]?.url ? { preview: media[0].url } : {}),
        contents: (row.contents ?? {}) as Record<string, unknown>,
      });
    }
    const bp = getBlueprint(key);
    if (!bp) throw notFound('Blueprint', key);
    return ok({ ...toSummary(bp), contents: summarizeContents(bp) });
  });

  app.post('/v1/blueprints/:key/install', async (request) => {
    const auth = requireRole(request, 'admin');
    const { key } = KeyParam.parse(request.params);
    const { property_id } = InstallBody.parse(request.body ?? {});
    const bp = await resolveBlueprint(auth.tenantId, key);
    if (!bp) throw notFound('Blueprint', key);
    // Explicit body target wins (validated, 404 on miss — the wizard installs into
    // the site it just created); else the active site (header → primary).
    const propertyId = property_id
      ? await requireTenantProperty(auth, property_id)
      : await resolvePropertyId(auth, activePropertyHeader(request.headers));
    const existing = await findInstall(auth.tenantId, propertyId, key);
    if (existing) {
      // One install row per (tenant, property, blueprint). A newer version is an
      // Update (non-destructive merge, docs/55); removing it is a Delete — never
      // delete-then-reinstall to "get the new version".
      throw conflict(
        existing.status === 'installed' || existing.status === 'live'
          ? `This template is already installed (status: ${existing.status}). Update it to the latest version, or delete it to remove it.`
          : `A previous install is ${existing.status}. Delete it, then install again.`
      );
    }
    const { installId, result } = await installBlueprint(
      { tenantId: auth.tenantId, userId: auth.actorId, propertyId, logger: request.log },
      bp
    );
    return ok({ install_id: installId, counts: result.counts });
  });

  app.get('/v1/blueprints/installs', async (request) => {
    const auth = requireRole(request, 'viewer');
    const installs = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.tenantBlueprintInstall.findMany({ orderBy: { installedAt: 'desc' } })
    );
    return ok({ installs: installs.map(serializeInstall) });
  });

  app.get('/v1/blueprints/installs/:id', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { id } = IdParam.parse(request.params);
    const row = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.tenantBlueprintInstall.findFirst({ where: { id } })
    );
    if (!row) throw notFound('Install', id);
    return ok(serializeInstallDetail(row));
  });

  app.post('/v1/blueprints/installs/:id/go-live', async (request) => {
    const auth = requireRole(request, 'admin');
    const { id } = IdParam.parse(request.params);
    const row = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.tenantBlueprintInstall.findFirst({ where: { id }, select: { id: true, propertyId: true } })
    );
    if (!row) throw notFound('Install', id);
    await goLiveInstall(
      {
        tenantId: auth.tenantId,
        userId: auth.actorId,
        propertyId: row.propertyId,
        logger: request.log,
      },
      id
    );
    return ok({ id, status: 'live' });
  });

  // Update preview (docs/55 §6) — the changeset (per-artifact fast-forwards /
  // conflicts / adds / orphans) for the catalog's current version. Read-only:
  // nothing is written, so a tenant can review before applying.
  app.get('/v1/blueprints/installs/:id/update', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { id } = IdParam.parse(request.params);
    const row = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.tenantBlueprintInstall.findFirst({ where: { id } })
    );
    if (!row) throw notFound('Install', id);
    const bp = await resolveBlueprint(auth.tenantId, row.blueprintKey);
    if (!bp) throw notFound('Blueprint', row.blueprintKey);
    const plan = await planUpdate(
      {
        tenantId: auth.tenantId,
        userId: auth.actorId,
        propertyId: row.propertyId,
        logger: request.log,
      },
      row,
      bp
    );
    return ok(plan);
  });

  // Update apply (docs/55 §6) — three-way merge the new version onto the install,
  // keeping every tenant edit by default (U1). `take_theirs` flips named conflicts
  // to the blueprint's value. Live installs re-publish; draft installs stay draft.
  app.post('/v1/blueprints/installs/:id/update', async (request) => {
    const auth = requireRole(request, 'admin');
    const { id } = IdParam.parse(request.params);
    const { take_theirs } = UpdateBody.parse(request.body ?? {});
    const row = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.tenantBlueprintInstall.findFirst({ where: { id } })
    );
    if (!row) throw notFound('Install', id);
    const bp = await resolveBlueprint(auth.tenantId, row.blueprintKey);
    if (!bp) throw notFound('Blueprint', row.blueprintKey);
    const res = await applyUpdate(
      {
        tenantId: auth.tenantId,
        userId: auth.actorId,
        propertyId: row.propertyId,
        logger: request.log,
      },
      row,
      bp,
      take_theirs ?? []
    );
    return ok(res);
  });

  // Delete / uninstall (docs/55 §9): tear down everything the install created
  // (id-map on the row) + delete the row. This is a plain uninstall — a newer
  // version is an Update, not delete-then-reinstall. Admin-only and destructive —
  // the dashboard gates it behind a confirm.
  app.delete('/v1/blueprints/installs/:id', async (request) => {
    const auth = requireRole(request, 'admin');
    const { id } = IdParam.parse(request.params);
    const row = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.tenantBlueprintInstall.findFirst({ where: { id }, select: { id: true, propertyId: true } })
    );
    if (!row) throw notFound('Install', id);
    await deleteInstall(
      {
        tenantId: auth.tenantId,
        userId: auth.actorId,
        propertyId: row.propertyId,
        logger: request.log,
      },
      id
    );
    return ok({ id, status: 'deleted' });
  });

  return Promise.resolve();
};

export default blueprintRoutes;
