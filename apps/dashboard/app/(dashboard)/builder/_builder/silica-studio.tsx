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

import { useMemo } from 'react';
import { Builder } from '@wizeworks/silicaui-builder/react';
import type { DataSource as SilicaDataSource, Document, Site } from '@wizeworks/silicaui-html';
import type { DataSources } from '@sparx/builder-schemas';

import { buildSilicaHost, defaultSilicaFormat } from './silica-host';

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

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full">
      <Builder
        // silica's `Editor` constructor accepts `Document | Site`; the `<Builder>`
        // prop type narrows to `Document`, so we assert the multi-page `Site`
        // through here (silica should widen the prop — noted for the silica repo).
        document={site as Document}
        host={host}
        // Server-authoritative once persistence is wired; no local crash-recovery
        // store for the proof surface.
        persistKey={null}
        onChange={() => {
          // TODO(silica-persistence): debounce + PUT the extracted Site to the
          // site-sync endpoint (reconciles pages + frame into the builder store).
        }}
        onPublish={async () => {
          // TODO(silica-persistence): POST the site to the publish pipeline
          // (draft → published snapshot; the storefront re-renders on read).
        }}
      />
    </div>
  );
}
