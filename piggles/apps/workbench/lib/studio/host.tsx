'use client';

// Piggles' contribution to the studio — the domain seam.
//
// The engine knows what a node is; this knows what this business can put on a
// page, what its live regions look like, and what its own data says. The catalog,
// the pinned functional cores, the class policy and the brand-derived fallback
// theme all come from the shared platform packages, so the blocks an author can
// insert here are the same ones the storefront renders.

import { useMemo } from 'react';
import type { StudioHost } from '@wizeworks/studio/react';
import { validateResponsiveVocabulary } from '@sparx/silica-catalog';
import { useBrand, useSiteConfig } from '../../surfaces/builder/studio/data';
import {
  applyBrandOverride,
  tenantTheme,
  type BrandColumns,
} from '../../surfaces/builder/studio/brand-theme';
import { makeRenderHostNode } from '../../surfaces/builder/studio/host-cores';
import { useActiveProperty } from '../../surfaces/builder/studio/data';
import { useActiveSiteId } from '../api/shell-data';
import { PageSettingsPanel } from '../../surfaces/studio/page-settings-panel';
import { PieceSettingsPanel } from '../../surfaces/studio/piece-settings-panel';
import { catalogFor } from './catalog-scope';
import { useCanvasPreview } from './preview';

/** A blank brand, so theming degrades to bare defaults rather than crashing while
 *  `/v1/brand` is still in flight. */
const EMPTY_BRAND: BrandColumns = {
  tagline: null,
  logoLightMediaId: null,
  logoDarkMediaId: null,
  faviconMediaId: null,
  colorPrimary: null,
  colorPrimaryForeground: null,
  colorSecondary: null,
  colorSecondaryForeground: null,
  colorAccent: null,
  colorAccentForeground: null,
  fontHeading: null,
  fontBody: null,
  tokens: null,
};

/**
 * The host, or null until the brand has resolved.
 *
 * Null rather than a placeholder theme on purpose: a canvas that opens in the
 * platform's default colours and re-paints a moment later in the business's own
 * is a flash of somebody else's brand on their own site.
 */
export function useStudioHostConfig(): StudioHost | null {
  const brand = useBrand();
  const config = useSiteConfig();
  const { data: siteState } = useActiveSiteId();
  const property = useActiveProperty(siteState?.propertyId ?? null);
  const preview = useCanvasPreview();

  const fallbackTheme = useMemo(() => {
    if (brand.isPending || config.isPending) return null;
    const columns = applyBrandOverride(brand.data ?? EMPTY_BRAND, property.data?.brandOverride);
    return tenantTheme(columns, { themeKey: config.data?.themeKey ?? 'default' });
  }, [brand.isPending, brand.data, config.isPending, config.data, property.data]);

  return useMemo(() => {
    if (!fallbackTheme) return null;
    // The same root for both, so the mark a header draws and the text a bound node
    // draws come from one answer about who this business is.
    const drawHostNode = makeRenderHostNode(preview.root);
    return {
      fallbackTheme,
      catalog: catalogFor,
      renderHostNode: (node) => drawHostNode(node, { preview: true }),
      resolveBinding: (ref) => preview.resolve(ref),
      // A document's own settings live under the DOCUMENT — select the page (or the
      // piece) itself and they are there, rather than in a drawer with a second Save
      // button of its own.
      inspectorPanels: (_node, ctx) => {
        if (!ctx.isRoot) return null;
        if (ctx.doc.kind === 'page') return <PageSettingsPanel />;
        if (ctx.doc.kind === 'component') return <PieceSettingsPanel />;
        return null;
      },
      // Platform policy, not a tenant setting: a viewport variant makes the device
      // toggle lie about the page, and no business benefits from opting into that.
      validateClass: (className: string) => validateResponsiveVocabulary(className),
    } satisfies StudioHost;
  }, [fallbackTheme, preview]);
}
