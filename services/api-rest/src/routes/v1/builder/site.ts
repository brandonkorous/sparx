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
//   POST   /v1/builder/site/publish  → snapshot every silica draft tree → published
//   POST   /v1/builder/site/frame/reset
//                                     → restore the header + footer to the current
//                                       starter chrome (DRAFT only). Narrow on
//                                       purpose — pages/theme/symbols and everything
//                                       visitors are served stay put
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
import { siteService } from '@sparx/builder';
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
    await siteService.publish(await toBuilderContext(request));
    return ok({ published: true });
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
