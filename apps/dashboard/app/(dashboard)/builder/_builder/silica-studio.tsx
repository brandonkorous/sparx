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
import type { DataSource as SilicaDataSource, Document } from '@wizeworks/silicaui-html';
import type { DataSources } from '@sparx/builder-schemas';

import { buildSilicaHost, defaultSilicaFormat } from './silica-host';

export interface SilicaStudioProps {
  /** The starter (or, post-cutover, the tenant's) silica document to edit. */
  doc: Document;
  /** The pre-loaded resolver root (`buildPreviewData`) the host reads bindings from. */
  root: DataSources;
  /** The tenant binding catalog as silica `DataSource[]` (drives the picker). */
  dataSources: SilicaDataSource[];
  /** The tenant's stored class allowlist (tighten-only over the engine floor). */
  tenantAllowlist?: unknown;
}

export function SilicaStudio({ doc, root, dataSources, tenantAllowlist }: SilicaStudioProps) {
  const host = useMemo(
    () => buildSilicaHost({ root, dataSources, tenantAllowlist, formatValue: defaultSilicaFormat }),
    [root, dataSources, tenantAllowlist]
  );

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full">
      <Builder
        document={doc}
        host={host}
        // Server-authoritative once persistence is wired; no local crash-recovery
        // store for the proof surface.
        persistKey={null}
        onChange={() => {
          // TODO(silica-cutover): debounce + persist the extracted Site to the
          // sparx builder store (the studio route's save path).
        }}
        onPublish={async () => {
          // TODO(silica-cutover): POST the RenderedPages to the publish pipeline.
        }}
      />
    </div>
  );
}
