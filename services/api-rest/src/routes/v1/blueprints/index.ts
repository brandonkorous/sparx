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

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { conflict, notFound } from '@sparx/api-core/errors';
import { getBlueprint, listBlueprints, toSummary, type Blueprint } from '@sparx/blueprints';

import { resolvePropertyId } from '../../../lib/property.js';
import {
  findInstall,
  goLiveInstall,
  installBlueprint,
  type InstallResult,
} from '../../../lib/blueprint-installer.js';

const KeyParam = z.object({ key: z.string().min(1).max(63) });
const IdParam = z.object({ id: z.string().uuid() });

function propHeader(request: FastifyRequest): string | null {
  const h = request.headers['x-sparx-property-id'];
  return typeof h === 'string' ? h : null;
}

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
    const propertyId = await resolvePropertyId(auth.tenantId, propHeader(request));
    const installs = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.tenantBlueprintInstall.findMany({
        where: { propertyId },
        select: { id: true, blueprintKey: true, status: true },
      })
    );
    const byKey = new Map(installs.map((i) => [i.blueprintKey, i]));
    const blueprints = listBlueprints().map((bp) => {
      const inst = byKey.get(bp.key);
      return {
        ...toSummary(bp),
        contents: summarizeContents(bp),
        install: inst ? { id: inst.id, status: inst.status } : null,
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
    const propertyId = await resolvePropertyId(auth.tenantId, propHeader(request));
    const existing = await findInstall(auth.tenantId, propertyId, key);
    if (existing) {
      throw conflict(
        `This template is already installed on this site (status: ${existing.status}).`
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

  return Promise.resolve();
};

export default blueprintRoutes;
