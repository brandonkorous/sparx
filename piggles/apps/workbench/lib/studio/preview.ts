'use client';

// The sample data every canvas draws through.
//
// One root, shared by the brand mark and by bound text, because the two must agree:
// a header whose logo is the business's real one and whose name is a placeholder is
// worse than either alone.
//
// Real identity wins over placeholder records. Everything else — products, posts,
// services — is plausible sample data, because a canvas is a design surface and a
// heading bound to a product should read as a product name rather than as its ref.

import { useMemo } from 'react';
import {
  COMMERCE_SOURCES,
  SITE_SOURCES,
  createSilicaResolver,
  defaultSilicaFormat,
  type DataSource,
  type DataSources,
} from '@wizeworks/builder-schemas';
import { useActiveProperty, useBindingCatalog, useSitePreview } from './site-data';
import { buildPreviewRoot } from './preview-data';
import { useActiveSiteId, useTenant } from '../api/shell-data';

export interface CanvasPreview {
  /** The data root the brand core draws the tenant's real mark from. */
  root: DataSources;
  /** One bound node's showable value, or undefined when the ref is unknown. */
  resolve: (ref: string) => string | undefined;
}

/**
 * The canvas data root for the active site.
 *
 * The tenant's own binding catalog when it has one, the commerce sources otherwise —
 * an author with no content types still gets a canvas whose product bindings resolve,
 * rather than one where every bound node reads as its own ref.
 */
export function useCanvasPreview(): CanvasPreview {
  const catalog = useBindingCatalog();
  const tenant = useTenant();
  const { data: siteState } = useActiveSiteId();
  const property = useActiveProperty(siteState?.propertyId ?? null);
  const site = useSitePreview(tenant.data?.slug ?? null, property.data?.slug ?? null);

  return useMemo(() => {
    const sources: DataSource[] = catalog.data?.sources.length
      ? [...catalog.data.sources]
      : [...COMMERCE_SOURCES];
    const root = buildPreviewRoot([...sources, ...SITE_SOURCES], site.data ?? null);
    // The platform's own resolver, not a dotted-path lookup of my own: it is what
    // decodes `?? fallback`, attribute refs and formatting, so the canvas and the
    // live site read one binding the same way.
    const resolver = createSilicaResolver({ root, format: defaultSilicaFormat });
    return {
      root,
      resolve: (ref: string) => {
        const value = resolver.resolveBinding(ref, {})?.value;
        if (typeof value === 'string') return value;
        // A number or a flag reads fine as text; a record or a list does not, and
        // `[object Object]` on a canvas is worse than leaving the authored words in
        // place — the author can at least see what the node was meant to say.
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        return undefined;
      },
    };
  }, [catalog.data, site.data]);
}
