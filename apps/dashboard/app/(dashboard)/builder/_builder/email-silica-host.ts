// The sparx `EmailBuilderHost` (docs/120) — the domain seam silica's
// `<EmailBuilder>` reads. The email twin of `silica-host.ts`, smaller by design (the
// email host has no `validateClass` — email carries no class strings). It composes
// the SAME data half the site host + the storefront use: `createSilicaResolver` over
// a pre-loaded preview root, and the tenant email binding catalog projected to silica
// `DataSource[]` for the picker.
//
// The email host also has no `pickAsset` (0.17's asset fields are plain URL inputs),
// so the media library arrives instead as an `inspectorPanels` contribution the studio
// injects — see `email-asset-panel.tsx`.
//
// Type-only import of the React-free `/email/react` host type, so this stays a
// plain module the client studio wraps around the live `<EmailBuilder>`.

import type { EmailBuilderHost } from '@wizeworks/silicaui-builder/email/react';
import type { DataSource as SilicaDataSource } from '@wizeworks/silicaui-html';
import {
  createSilicaResolver,
  defaultSilicaFormat,
  type DataSources,
} from '@sparx/builder-schemas';

export interface EmailHostOptions {
  /** The pre-loaded data root the resolver reads from (`buildPreviewData` over the
   *  email catalog) — sample product/customer/order values so bound nodes and
   *  `{{tokens}}` render real-looking content on the canvas. */
  root: DataSources;
  /** The email binding catalog projected to silica `DataSource[]` — drives the
   *  built-in binding picker + `emailScopeAt` narrowing. */
  dataSources: SilicaDataSource[];
  /** Host-contributed inspector panels — the media library on asset-bearing nodes
   *  (`email-asset-panel.tsx`). Assembled by the client studio, which owns the
   *  picker dialog. */
  inspectorPanels?: EmailBuilderHost['inspectorPanels'];
}

/** Assemble the sparx `EmailBuilderHost`. `resolveBinding`/`resolveCollection` are
 *  the exact primitives the storefront + site editor use (their shape IS the email
 *  host's), so the canvas resolves data identically to the send. */
export function buildEmailHost(opts: EmailHostOptions): EmailBuilderHost {
  const resolver = createSilicaResolver({
    root: opts.root,
    format: defaultSilicaFormat,
    // The email conditional (docs/120): a bound node whose data is absent is DROPPED
    // rather than left showing an empty label. Must match `renderSilicaEmail`'s
    // resolver exactly, or the canvas would preview a block the send omits.
    hideWhenEmpty: true,
  });
  return {
    resolveBinding: resolver.resolveBinding,
    resolveCollection: resolver.resolveCollection,
    dataSources: () => opts.dataSources,
    ...(opts.inspectorPanels ? { inspectorPanels: opts.inspectorPanels } : {}),
    // catalog() (email composites: line-item table, product grid) is additive polish
    // — the engine's built-in 8-block palette covers the base case until then.
  };
}
