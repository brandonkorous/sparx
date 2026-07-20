// Builder — the silica-native SITE persistence seam (docs/118 Stage 3).
//
//   GET    /v1/builder/site          → the property's stored silica site (pages +
//                                       frame + symbols), theme-less; null when the
//                                       property has no silica site materialized yet
//   PUT    /v1/builder/site          → reconcile the whole extracted `Site` (the
//                                       debounced `<Builder onChange>` autosave)
//   GET    /v1/builder/site/publish-state
//                                     → what differs between the draft and what
//                                       visitors are served (the "not live yet" signal)
//   POST   /v1/builder/site/publish  → snapshot every silica draft tree → published,
//                                       and seal an immutable release (docs/126 §5.3)
//   GET    /v1/builder/site/releases  → the publish history, newest first
//   POST   /v1/builder/site/releases/:releaseId/restore
//                                     → republish a prior release. Append-only: the
//                                       restore is itself a new release, so undoing
//                                       an undo is just another restore
//   POST   /v1/builder/site/frame/reset
//                                     → restore the header + footer to the current
//                                       starter chrome (DRAFT only). Narrow on
//                                       purpose — pages/theme/symbols and everything
//                                       visitors are served stay put
//   GET    /v1/builder/site/symbols/:symbolId/usages
//                                     → where a saved component is PLACED (docs/126
//                                       §5.4). Deleting a master detaches every
//                                       instance across every page, so this is what
//                                       makes that an informed decision
//   GET    /v1/builder/site/records/:entity/:recordId/usages
//                                     → which trees PIN a specific record — the blast
//                                       radius of deleting a product / entry
//   GET    /v1/builder/site/type-census
//                                     → every node type present, most-used first;
//                                       diff against the renderer's known set to find
//                                       content that renders as nothing (docs/125 §2.2)
//   DELETE /v1/builder/site          → discard the silica site; the editor re-opens
//                                       on the current starter seed (the re-seed
//                                       lifecycle — catalog composites are STAMPED,
//                                       so an improved factory can only reach a page
//                                       that is stamped again). Destructive: admin.
//
// The silica `<Builder>` owns the multi-page site in memory and hands back the
// WHOLE `Site` on every edit, so persistence is one whole-site reconcile — not the
// per-page PATCH the sparx studio uses. Bodies are validated by the service-layer
// Zod schema (`SiteSyncInput`), keeping api-rest free of @sparx/builder-schemas.

import type { FastifyPluginAsync } from 'fastify';
import { artifactService, nodeIndexService, siteService } from '@sparx/builder';
import { isModuleEnabled } from '@sparx/auth';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireBuilderModule, toBuilderContext } from '../../../lib/builder-context.js';

const builderSiteRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/site', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const site = await siteService.load(await toBuilderContext(request));
    return ok({ site });
  });

  app.put('/v1/builder/site', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const result = await siteService.sync(await toBuilderContext(request), request.body);
    // The fresh per-page `updatedAt` rides back so the studio can advance its
    // optimistic-concurrency map (docs/126 Phase 1).
    return ok({ saved: true, ...result });
  });

  // ── Where-used (docs/126 §5.4) ─────────────────────────────────────────────
  // Answered from the derived node index rather than by walking every tree in the
  // property. Read-only, so `viewer` — knowing what a delete would break should never
  // require the permission to perform it.

  app.get('/v1/builder/site/symbols/:symbolId/usages', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { symbolId } = request.params as { symbolId: string };
    const usages = await nodeIndexService.findSymbolUsage(
      await toBuilderContext(request),
      symbolId
    );
    return ok(usages);
  });

  app.get('/v1/builder/site/records/:entity/:recordId/usages', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { entity, recordId } = request.params as { entity: string; recordId: string };
    const usages = await nodeIndexService.findRecordUsage(
      await toBuilderContext(request),
      entity,
      recordId
    );
    return ok(usages);
  });

  app.get('/v1/builder/site/type-census', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const census = await nodeIndexService.typeCensus(await toBuilderContext(request));
    return ok(census);
  });

  // What differs between the author's draft and what visitors are actually served.
  // Read-only and cheap; the studio reads it once at load, then tracks its own edits.
  app.get('/v1/builder/site/publish-state', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const state = await siteService.publishState(await toBuilderContext(request));
    return ok(state);
  });

  app.post('/v1/builder/site/publish', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const release = await siteService.publish(await toBuilderContext(request));
    // The release id + hash ride back so the caller can name what it just published —
    // and so a UI can offer "undo" without a second round trip (docs/126 §5.3).
    return ok({ published: true, releaseId: release.id, hash: release.hash });
  });

  // ── Publish history (docs/126 §5.3) ────────────────────────────────────────
  // Every publish is an immutable release. `viewer` reads the history; restoring is
  // a publish, so it takes the same `editor` role as publishing.

  app.get('/v1/builder/site/releases', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { limit } = request.query as { limit?: string };
    const releases = await artifactService.listReleases(
      await toBuilderContext(request),
      limit ? Number(limit) : undefined
    );
    return ok(releases);
  });

  app.post('/v1/builder/site/releases/:releaseId/restore', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { releaseId } = request.params as { releaseId: string };
    // Republishes the old manifest FORWARD as a new release — history is append-only,
    // so a restore is itself restorable. The counts describe what actually moved.
    const result = await artifactService.restoreRelease(await toBuilderContext(request), releaseId);
    return ok(result);
  });

  // Restore the header + footer to the current starter chrome. `editor`, not
  // `admin` (unlike the whole-site reset below): this destroys nothing — it rewrites
  // one DRAFT tree, leaves what visitors are served alone, and the previous frame is
  // captured in the audit log. Gating it behind an owner would strand the very
  // authors it exists for: a frame stamped before the brand mark became a live host
  // core can never show the tenant's logo, and re-stamping is the only way out.
  //
  // The module flags shape the restored nav exactly as they shape a fresh seed, so a
  // content-only tenant doesn't get a Shop link handed back to them.
  app.post('/v1/builder/site/frame/reset', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const ctx = await toBuilderContext(request);
    const [commerceEnabled, schedulingEnabled, cmsEnabled] = await Promise.all([
      // Fails OPEN, matching the studio's starter seed: a flag-lookup blip must never
      // silently strip Commerce chrome from a tenant who pays for it.
      isModuleEnabled(ctx.tenantId, 'commerce').catch(() => true),
      // Fails CLOSED — Scheduling is opt-in, so a blip must not invent a Book link.
      isModuleEnabled(ctx.tenantId, 'scheduling').catch(() => false),
      // Fails CLOSED for the same reason — a blip must not invent a Journal link to
      // an index with nothing behind it.
      isModuleEnabled(ctx.tenantId, 'cms').catch(() => false),
    ]);
    const frame = await siteService.resetFrame(ctx, {
      commerceEnabled,
      schedulingEnabled,
      cmsEnabled,
    });
    return ok({ frame });
  });

  // Destructive — it throws away every silica page + the frame, published included.
  // `admin`, not `editor`: an editor may publish their own work, but discarding the
  // whole site is an owner's decision.
  app.delete('/v1/builder/site', async (request) => {
    requireRole(request, 'admin');
    await requireBuilderModule(request);
    await siteService.reset(await toBuilderContext(request));
    return ok({ reset: true });
  });

  return Promise.resolve();
};

export default builderSiteRoutes;
