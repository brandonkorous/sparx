'use client';

// Piggles' contribution to the studio — the domain seam.
//
// The engine knows what a node is; this knows what this business can put on a
// page, what its live regions look like, and what its own data says. The catalog,
// the pinned functional cores, the class policy and the brand-derived fallback
// theme all come from the shared platform packages, so the blocks an author can
// insert here are the same ones the storefront renders.

import { useMemo, type ReactNode } from 'react';
import type { DocumentKind } from '@wizeworks/studio';
import type { EmailPreviewHost, StudioHost } from '@wizeworks/studio/react';
import type { Theme } from '@wizeworks/silicaui-html';
import type { EmailColorDefaults } from '@wizeworks/silicaui-builder/email';
import { validateResponsiveVocabulary } from '@wizeworks/silica-catalog';
import { useBrand, useSiteConfig } from './site-data';
import { applyBrandOverride, tenantTheme, type BrandColumns } from './brand-theme';
import { makeRenderHostNode } from './host-cores';
import { useActiveProperty } from './site-data';
import { useMediaPicker } from '../../surfaces/cms/media-picker';
import { useActiveSiteId } from '../api/shell-data';
import { PageSettingsPanel } from '../../surfaces/studio/page-settings-panel';
import { PieceSettingsPanel } from '../../surfaces/studio/piece-settings-panel';
import { EmailTagsPanel } from '../../surfaces/studio/email-tags-panel';
import { catalogFor } from './catalog-scope';
import { useCanvasPreview, type CanvasPreview } from './preview';
import { EMAIL_CONTENT_BLOCKS, useEmailPreview } from './email-domain';
import { useEmailColors } from './email-data';

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
 * platform's default colors and re-paints a moment later in the business's own
 * is a flash of somebody else's brand on their own site.
 */
export function useStudioHostConfig(): StudioHost | null {
  const brand = useBrand();
  const config = useSiteConfig();
  const { data: siteState } = useActiveSiteId();
  const property = useActiveProperty(siteState?.propertyId ?? null);
  const preview = useCanvasPreview();
  const emailPreview = useEmailPreview();
  const emailColors = useEmailColors();
  const pickMedia = useMediaPicker();

  const fallbackTheme = useMemo(() => {
    if (brand.isPending || config.isPending) return null;
    const columns = applyBrandOverride(brand.data ?? EMPTY_BRAND, property.data?.brandOverride);
    return tenantTheme(columns, { themeKey: config.data?.themeKey ?? 'default' });
  }, [brand.isPending, brand.data, config.isPending, config.data, property.data]);

  return useMemo(() => {
    if (!fallbackTheme) return null;
    return buildHost({
      fallbackTheme,
      preview,
      emailPreview,
      emailColors: emailColors.data,
      pickMedia,
    });
  }, [fallbackTheme, preview, emailPreview, emailColors.data, pickMedia]);
}

/** A document's own settings live UNDER the document — select the page (or the piece,
 *  or the email) itself and they are there, rather than in a drawer with a second Save
 *  button of its own. */
function panelFor(kind: DocumentKind): ReactNode {
  if (kind === 'page') return <PageSettingsPanel />;
  if (kind === 'component') return <PieceSettingsPanel />;
  if (kind === 'email') return <EmailTagsPanel />;
  return null;
}

function buildHost({
  fallbackTheme,
  preview,
  emailPreview,
  emailColors,
  pickMedia,
}: {
  fallbackTheme: Theme;
  preview: CanvasPreview;
  emailPreview: EmailPreviewHost;
  emailColors: EmailColorDefaults | undefined;
  pickMedia: () => Promise<{ url: string | null; filename: string } | null>;
}): StudioHost {
  // The same root for both, so the mark a header draws and the text a bound node
  // draws come from one answer about who this business is.
  const drawHostNode = makeRenderHostNode(preview.root);
  return {
    fallbackTheme,
    catalog: catalogFor,
    renderHostNode: (node) => drawHostNode(node, { preview: true }),
    resolveBinding: (ref) => preview.resolve(ref),
    // The business's own picture browser, so no image field ever asks for a web
    // address. A picked asset with no URL is one still being processed — treated as
    // "nothing picked" rather than written as an empty source.
    pickAsset: async () => {
      const picked = await pickMedia();
      return picked?.url ? { url: picked.url, alt: picked.filename } : null;
    },
    // Email resolves against its own sample recipient, never the site's preview root:
    // `customer.firstName` means the person this is being SENT to.
    emailPreview,
    // The exact colours the send paints with, so a new block lands on brand. Absent
    // until the read settles — silica's neutral default then, which is visibly not
    // the brand rather than quietly the wrong brand.
    ...(emailColors ? { emailColors } : {}),
    emailCatalog: () => EMAIL_CONTENT_BLOCKS,
    inspectorPanels: (_node, ctx) => (ctx.isRoot ? panelFor(ctx.doc.kind) : null),
    // Platform policy, not a tenant setting: a viewport variant makes the device
    // toggle lie about the page, and no business benefits from opting into that.
    validateClass: (className: string) => validateResponsiveVocabulary(className),
  };
}
