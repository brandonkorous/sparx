'use client';

// The silica-engine studio mount (docs/118) — wraps the live `<Builder>` around the
// sparx `BuilderHost`. The host carries FUNCTIONS (resolveBinding, validateClass…),
// which can't cross the RSC boundary, so it's assembled HERE, client-side, from the
// serializable inputs the server route passes (the pre-loaded data root, the silica
// DataSource catalog, the tenant class allowlist). The starter document is plain,
// serializable node data, so it's built server-side and handed in.
//
// Additive: this is a NEW surface (/builder/silica) that leaves the existing
// `SiteStudio` untouched — the engine editor is proven here before the main studio
// route cuts over to it (and `onChange`/`onPublish` wire to the sparx store).

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Builder } from '@wizeworks/silicaui-builder/react';
import type { DataSource as SilicaDataSource, Document, Site } from '@wizeworks/silicaui-html';
import type { DataSources, SiteSyncInput } from '@sparx/builder-schemas';

import { publishBuilderSite, syncBuilderSite } from '../_lib/actions';
import { buildSilicaHost, defaultSilicaFormat } from './silica-host';

/** Project silica's extracted `Site` onto the sync wire shape — near-identity:
 *  silica's `Page` is already `{ id, name, slug, root }`; the frame contributes its
 *  root, and the site-global `symbols` + `theme` ride along. The engine hands back
 *  the WHOLE document on every edit, so all four parts are persisted (docs/118) —
 *  a theme or symbol edit must never be dropped on the floor here. */
function toSyncInput(site: Site): SiteSyncInput {
  return {
    pages: site.pages.map((p) => ({ id: p.id, name: p.name, slug: p.slug, root: p.root })),
    ...(site.frame ? { frame: { root: site.frame.root } } : {}),
    ...(site.symbols ? { symbols: site.symbols } : {}),
    ...(site.theme ? { theme: site.theme } : {}),
  };
}

/** Debounce window for the whole-site autosave — the engine fires `onChange` per
 *  edit; one PUT ~700ms after the last keystroke reconciles the site. */
const AUTOSAVE_MS = 700;

export interface SilicaStudioProps {
  /** The tenant's silica `Site` — the whole multi-page site (pages + shared frame
   *  + theme). silica's `Editor` accepts a `Document | Site`, but `<Builder>`'s
   *  prop is narrowly typed `Document`; we pass the `Site` through (cast at the
   *  mount) so the engine's native multi-page + frame editing is in play. A
   *  single-page `Document` is still accepted (the legacy one-page shape). */
  site: Site | Document;
  /** The pre-loaded resolver root (`buildPreviewData`) the host reads bindings from. */
  root: DataSources;
  /** The tenant binding catalog as silica `DataSource[]` (drives the picker). */
  dataSources: SilicaDataSource[];
  /** The tenant's stored class allowlist (tighten-only over the engine floor). */
  tenantAllowlist?: unknown;
}

export function SilicaStudio({ site, root, dataSources, tenantAllowlist }: SilicaStudioProps) {
  const host = useMemo(
    () => buildSilicaHost({ root, dataSources, tenantAllowlist, formatValue: defaultSilicaFormat }),
    [root, dataSources, tenantAllowlist]
  );

  // Debounced whole-site autosave. The engine fires onChange per edit with the
  // full extracted Site; we coalesce a burst into one reconcile PUT and keep the
  // latest site pending so a save-in-flight never drops the newest state.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Site | null>(null);

  const flush = useCallback(() => {
    timer.current = null;
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    void syncBuilderSite(toSyncInput(next));
  }, []);

  const onChange = useCallback(
    (next: Site) => {
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_MS);
    },
    [flush]
  );

  // Flush any pending edit on unmount (route change / site switch) so the last
  // burst isn't lost between the debounce window and navigation.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        flush();
      }
    };
  }, [flush]);

  const onPublish = useCallback(async ({ site: published }: { site: Site }) => {
    // Persist the just-edited site first (skip the debounce), then snapshot
    // draft → published so the publish reflects the newest state.
    await syncBuilderSite(toSyncInput(published));
    await publishBuilderSite();
  }, []);

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full">
      <Builder
        // silica's `Editor` constructor accepts `Document | Site`; the `<Builder>`
        // prop type narrows to `Document`, so we assert the multi-page `Site`
        // through here (silica should widen the prop — noted for the silica repo).
        document={site as Document}
        host={host}
        // Server-authoritative — the debounced onChange is the durable store; no
        // local IndexedDB crash-recovery layer duplicating it.
        persistKey={null}
        onChange={onChange}
        onPublish={onPublish}
      />
    </div>
  );
}
