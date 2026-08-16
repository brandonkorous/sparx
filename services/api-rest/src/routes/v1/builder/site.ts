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
//   GET    /v1/builder/site/check    → the pre-publish check over the DRAFT: broken
//                                       links, missing image descriptions, heading
//                                       gaps, dead buttons, styling that emits no CSS,
//                                       unreadable color pairings, SEO metadata —
//                                       plus what each page WEIGHS, which is a
//                                       measurement rather than a finding.
//                                       ADVISORY — publish never consults it
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
//   GET    /v1/builder/site/symbols → the site's OWN saved pieces (the tenant
//                                       library is /v1/builder/components)
//   PUT    /v1/builder/site/symbols/:symbolId
//                                     → write one of them
//   DELETE /v1/builder/site/symbols/:symbolId
//                                     → drop one; every instance DETACHES
//   GET    /v1/builder/site/symbols/:symbolId/usages
//                                     → where a saved component is PLACED (docs/126
//                                       §5.4). Deleting a master detaches every
//                                       instance across every page, so this is what
//                                       makes that an informed decision
//   GET    /v1/builder/site/records/:entity/:recordId/usages
//                                     → which trees PIN a specific record — the blast
//                                       radius of deleting a product / entry
//   GET    /v1/builder/site/record-samples
//                                     → one REAL storefront path per record detail
//                                       page, so Preview on a product template opens
//                                       an actual product instead of the product list
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
import {
    artifactService,
    draftVersionService,
    nodeIndexService,
    opLogService,
    recordSampleService,
    siteService,
} from '@sparx/builder';
import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { withRequestTenant } from '@sparx/api-core/db';
import {
    requireBuilderModule,
    siteChromeOptions,
    toBuilderContext,
} from '../../../lib/builder-context.js';
import { getBuilderBroadcaster } from '../../../websocket/builder-broadcast.js';
import { auditAndStore } from '../../../lib/seo-audit.js';
import { runSiteCheck } from '../../../lib/site-check.js';
import { publishBuilderEvent } from '../../../lib/builder-events.js';

/** Re-grade every page of the property that was just published. One pass over the
 *  property's pages; each audit is independent, so a single bad page cannot take the
 *  rest of the refresh down with it. */
async function refreshSiteSeoAudits(
    request: Parameters<typeof withRequestTenant>[0],
    tenantId: string,
    propertyId: string
): Promise<void> {
    await withRequestTenant(request, async (tx) => {
        const pages = await tx.builderPage.findMany({ where: { propertyId }, select: { id: true } });
        for (const page of pages) {
            await auditAndStore(tx, tenantId, 'builder_page', page.id).catch(() => undefined);
        }
    });
}

const builderSiteRoutes: FastifyPluginAsync = (app) => {
    app.get('/v1/builder/site', async (request) => {
        requireRole(request, 'viewer');
        await requireBuilderModule(request);
        const ctx = await toBuilderContext(request);
        // The module flags decide which RECORD detail pages this property should have, and
        // `load` seeds any that are missing — the only thing that puts a product or blog-post
        // page in front of a tenant whose site predates page addresses.
        const site = await siteService.load(ctx, await siteChromeOptions(ctx.tenantId));
        return ok({ site });
    });

    app.put('/v1/builder/site', async (request) => {
        requireRole(request, 'editor');
        const ctx = await toBuilderContext(request);
        await requireBuilderModule(request);
        const { relay, ...result } = await siteService.sync(ctx, request.body);
        // Relay the just-persisted ops to co-editors (docs/126 Phase 4). Done here, not in
        // the service, because the socket server is an api-rest concern — the service stays
        // socket-agnostic. `relay` is stripped from the response: the sender already holds
        // these ops, so echoing them back over HTTP would be waste.
        if (relay) getBuilderBroadcaster()?.opsAppended(ctx.propertyId, relay);
        // The fresh per-page `updatedAt` + the op-log seq ride back so the studio can advance
        // its optimistic-concurrency map (Phase 1) and `ackSeq` the engine (Phase 2).
        return ok({ saved: true, ...result });
    });

    // The op log's current high-water sequence (docs/126 Phase 4). The studio reads it at
    // load so it can `ackSeq` the engine to the right starting point and request catch-up
    // from there over the socket — closing the gap between the HTTP load and the socket
    // join. Cheap: a single MAX(seq).
    app.get('/v1/builder/site/seq', async (request) => {
        requireRole(request, 'viewer');
        await requireBuilderModule(request);
        const ctx = await toBuilderContext(request);
        const seq = await withTenant(ctx, (tx) => opLogService.currentSeq(ctx, tx));
        return ok({ seq });
    });

    // ── Where-used (docs/126 §5.4) ─────────────────────────────────────────────
    // Answered from the derived node index rather than by walking every tree in the
    // property. Read-only, so `viewer` — knowing what a delete would break should never
    // require the permission to perform it.

    /**
     * The site's OWN saved pieces.
     *
     * Not the tenant library (`/v1/builder/components`) — that one is shared across
     * every site the business owns. Both end up in one symbol map on a canvas; only
     * where the master is stored differs, and the id namespace says which is which.
     * Registered before `:symbolId` so the static path is not swallowed by the param.
     */
    app.get('/v1/builder/site/symbols', async (request) => {
        requireRole(request, 'viewer');
        await requireBuilderModule(request);
        const symbols = await siteService.loadSymbols(await toBuilderContext(request));
        return ok({ symbols });
    });

    app.put('/v1/builder/site/symbols/:symbolId', async (request) => {
        requireRole(request, 'editor');
        await requireBuilderModule(request);
        const { symbolId } = request.params as { symbolId: string };
        const body = request.body as { name: string; root: unknown };
        const symbol = await siteService.setSymbol(await toBuilderContext(request), symbolId, {
            name: body.name,
            root: body.root as never,
        });
        return ok(symbol);
    });

    // Every instance across every page DETACHES — the design stays where it is and
    // simply stops following a master that no longer exists. The pane names the
    // placement count before offering this.
    app.delete('/v1/builder/site/symbols/:symbolId', async (request) => {
        requireRole(request, 'editor');
        await requireBuilderModule(request);
        const { symbolId } = request.params as { symbolId: string };
        await siteService.removeSymbol(await toBuilderContext(request), symbolId);
        return ok({ symbolId });
    });

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

    /**
     * A real storefront path for each record detail page — `{'commerce.product':
     * '/products/brake-kit'}`.
     *
     * A record page's address is `/products/:handle`, which is where the page LIVES but not
     * somewhere a browser can go: `:handle` is a literal segment to the router, so Preview
     * used to open the route index (`/products`) and show an author laying out a product
     * DETAIL page the product LIST instead. This names one record the template can actually
     * render against.
     *
     * A record type is omitted when the tenant has no visible record of that kind yet, and
     * the studio falls back to the index — so an empty catalog is the old behaviour rather
     * than a broken link. Five single-row reads; the studio asks once per site.
     */
    app.get('/v1/builder/site/record-samples', async (request) => {
        requireRole(request, 'viewer');
        await requireBuilderModule(request);
        const paths = await recordSampleService.recordSamplePaths(await toBuilderContext(request));
        return ok({ paths });
    });

    // What differs between the author's draft and what visitors are actually served.
    // Read-only and cheap; the studio reads it once at load, then tracks its own edits.
    app.get('/v1/builder/site/publish-state', async (request) => {
        requireRole(request, 'viewer');
        await requireBuilderModule(request);
        const state = await siteService.publishState(await toBuilderContext(request));
        return ok(state);
    });

    /**
     * The pre-publish check (docs/builder-audit slice 11) — what a visitor will run into
     * on the DRAFT: broken links, images with no description, headings that skip a
     * level, buttons nothing is wired to, styling that emits no CSS, color pairings
     * that cannot be read, and missing or duplicated search metadata.
     *
     * It also reports `budget` — the bytes of each page's markup and pictures. That is
     * a MEASUREMENT, not a finding: it carries no severity, does not move `status`, and
     * a heavy page is a trade its owner may have made on purpose.
     *
     * ADVISORY, AND THE ROUTE BELOW PROVES IT: `POST /publish` does not call this, does
     * not read its `status`, and cannot be made to. The site belongs to the person who
     * built it — they may be publishing a link to a page that goes live in an hour. The
     * check says what happens; the decision is theirs.
     *
     * `viewer`, not `editor`: reading what is wrong with a site is not a change to it,
     * and a reviewer who cannot publish still has every reason to look.
     */
    app.get('/v1/builder/site/check', async (request) => {
        requireRole(request, 'viewer');
        await requireBuilderModule(request);
        const report = await runSiteCheck(request, await toBuilderContext(request));
        return ok(report);
    });

    app.post('/v1/builder/site/publish', async (request) => {
        const auth = requireRole(request, 'editor');
        await requireBuilderModule(request);
        const ctx = await toBuilderContext(request);
        const release = await siteService.publish(ctx);
        // Refresh every page's SEO scorecard against what was just made live.
        //
        // This is THE publish for a silica site, and it did not do this — only the legacy
        // per-page route did, which nothing in the current editor calls. So the scorecards
        // the SEO module shows were never recomputed after a real publish: an owner who
        // fixed a missing title saw the old grade indefinitely, with nothing saying why.
        //
        // Best-effort and AFTER the publish, exactly like the legacy route: a scoring
        // hiccup must never fail a publish that already succeeded.
        await refreshSiteSeoAudits(request, auth.tenantId, ctx.propertyId).catch(() => undefined);
        // The purge signal (roadmap slice 21). Nothing emitted this before, so the
        // storefront's `builder:<slug>` tag — already on every page/layout/frame/style
        // read, already mapped by `cache-revalidation-worker` — was never invalidated.
        // Harmless while every route is `force-dynamic`; a publish that shows nothing the
        // moment ISR is switched on otherwise. AFTER the publish committed, and
        // best-effort: a Pub/Sub hiccup must not fail a publish that already succeeded.
        await publishBuilderEvent('builder.published', auth.tenantId, auth.actorId, {
            propertyId: ctx.propertyId,
            releaseId: release.id,
            hash: release.hash,
        });
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
        const auth = requireRole(request, 'editor');
        await requireBuilderModule(request);
        const { releaseId } = request.params as { releaseId: string };
        const ctx = await toBuilderContext(request);
        // Republishes the old manifest FORWARD as a new release — history is append-only,
        // so a restore is itself restorable. The counts describe what actually moved.
        const result = await artifactService.restoreRelease(ctx, releaseId);
        // A rollback changes what visitors are served just as much as a publish does, and
        // it is the path where a stale cache does the most damage: the whole point of a
        // rollback is to take a broken page down, and a cache that kept serving it would
        // make the fix look like it did nothing.
        await publishBuilderEvent('builder.rolled_back', auth.tenantId, auth.actorId, {
            propertyId: ctx.propertyId,
            releaseId,
        });
        return ok(result);
    });

    // ── Draft version history (docs/126 §4.6) ──────────────────────────────────
    // The DRAFT counterpart of the publish releases above: every save is a restorable
    // version, so a last-write-wins overwrite (routine once an operator and an agent edit
    // together) is recoverable. `viewer` reads the history; restoring rewrites the draft, so
    // it takes `editor` like publishing does.

    app.get('/v1/builder/site/draft-versions', async (request) => {
        requireRole(request, 'viewer');
        await requireBuilderModule(request);
        const { limit } = request.query as { limit?: string };
        const versions = await draftVersionService.listDraftVersions(
            await toBuilderContext(request),
            limit ? Number(limit) : undefined
        );
        return ok(versions);
    });

    app.post('/v1/builder/site/draft-versions/:versionId/restore', async (request) => {
        requireRole(request, 'editor');
        await requireBuilderModule(request);
        const { versionId } = request.params as { versionId: string };
        // Non-destructive: brings back the versioned content of pages that still exist, seals
        // itself as a new version (append-only), and touches nothing the operator added since.
        const result = await draftVersionService.restoreDraftVersion(
            await toBuilderContext(request),
            versionId
        );
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
        const frame = await siteService.resetFrame(ctx, await siteChromeOptions(ctx.tenantId));
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
