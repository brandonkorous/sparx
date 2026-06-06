// Tenant Blueprints (docs/54) — the marketplace catalog + install/go-live API.
//
//   GET  /v1/blueprints                      → catalog (+ this site's install state)
//   GET  /v1/blueprints/:key                 → one blueprint (summary + contents)
//   POST /v1/blueprints/:key/install         → install into the ACTIVE property (draft)
//   GET  /v1/blueprints/installs             → this tenant's installs
//   GET  /v1/blueprints/installs/:id         → one install (id map + counts)
//   POST /v1/blueprints/installs/:id/go-live → publish everything the install created
//
// Install/go-live are admin-only (they enable modules + mutate many surfaces).
// The property a template installs into is the ACTIVE one (the site switcher's
// `x-sparx-property-id`, else the tenant's primary) — same resolution the Builder
// uses (docs/54 §5).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { conflict, notFound } from '@sparx/api-core/errors';
import { getBlueprint, listBlueprints, toSummary, type Blueprint } from '@sparx/blueprints';

import { resolvePrimaryPropertyId } from '../../../lib/property.js';
import {
  findInstall,
  goLiveInstall,
  installBlueprint,
  resetInstall,
  type InstallResult,
} from '../../../lib/blueprint-installer.js';

const KeyParam = z.object({ key: z.string().min(1).max(63) });
const IdParam = z.object({ id: z.string().uuid() });

/** A small "what this creates" breakdown for the browse/detail card. */
function summarizeContents(bp: Blueprint) {
  const c = bp.commerce;
  return {
    products: c?.products.length ?? 0,
    categories: c?.categories.length ?? 0,
    collections: c?.collections.length ?? 0,
    content: bp.content.length,
    pages: bp.pages.length,
    emails: bp.emails.length,
    components: bp.components.length,
    theme: bp.theme.name,
    hasLayout: Boolean(bp.layout),
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

const blueprintRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/blueprints', async (request) => {
    const auth = requireRole(request, 'viewer');
    // Install state is tenant-level: blueprints always install into the PRIMARY
    // property (docs/54 D6), so the catalog reads its rows, not the active site's.
    const propertyId = await resolvePrimaryPropertyId(auth.tenantId);
    const installs = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.tenantBlueprintInstall.findMany({
        where: { propertyId },
        select: { id: true, blueprintKey: true, blueprintVersion: true, status: true },
      })
    );
    const byKey = new Map(installs.map((i) => [i.blueprintKey, i]));
    const blueprints = listBlueprints().map((bp) => {
      const inst = byKey.get(bp.key);
      return {
        ...toSummary(bp),
        contents: summarizeContents(bp),
        // Version-drift (§9): when the installed version trails the catalog's, the
        // card offers an upgrade hint (the apply itself is deferred, §13 step 5).
        install: inst
          ? {
              id: inst.id,
              status: inst.status,
              version: inst.blueprintVersion,
              update_available: inst.blueprintVersion !== bp.version,
            }
          : null,
      };
    });
    return ok({ blueprints, property_id: propertyId });
  });

  app.get('/v1/blueprints/:key', (request) => {
    requireRole(request, 'viewer');
    const { key } = KeyParam.parse(request.params);
    const bp = getBlueprint(key);
    if (!bp) throw notFound('Blueprint', key);
    return ok({ ...toSummary(bp), contents: summarizeContents(bp) });
  });

  app.post('/v1/blueprints/:key/install', async (request) => {
    const auth = requireRole(request, 'admin');
    const { key } = KeyParam.parse(request.params);
    const bp = getBlueprint(key);
    if (!bp) throw notFound('Blueprint', key);
    const propertyId = await resolvePrimaryPropertyId(auth.tenantId);
    const existing = await findInstall(auth.tenantId, propertyId, key);
    if (existing) {
      // One install row per (tenant, property, blueprint). A clean re-install is an
      // explicit reset first (D8) — guide the caller there rather than duplicating.
      throw conflict(
        existing.status === 'installed' || existing.status === 'live'
          ? `This template is already installed (status: ${existing.status}). Reset it to reinstall.`
          : `A previous install is ${existing.status}. Reset it, then install again.`
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
    return ok(serializeInstall(row));
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

  // Reset & reinstall (D8): tear down everything the install created (id-map on the
  // row) + delete the row, so the blueprint can be installed fresh. Admin-only and
  // destructive — the dashboard gates it behind a confirm.
  app.post('/v1/blueprints/installs/:id/reset', async (request) => {
    const auth = requireRole(request, 'admin');
    const { id } = IdParam.parse(request.params);
    const row = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.tenantBlueprintInstall.findFirst({ where: { id }, select: { id: true, propertyId: true } })
    );
    if (!row) throw notFound('Install', id);
    await resetInstall(
      {
        tenantId: auth.tenantId,
        userId: auth.actorId,
        propertyId: row.propertyId,
        logger: request.log,
      },
      id
    );
    return ok({ id, status: 'reset' });
  });

  return Promise.resolve();
};

export default blueprintRoutes;
