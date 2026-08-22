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
import { useMediaPicker, type PickedAsset } from '../../surfaces/cms/media-picker';
import { useActivePropertyId } from '../api/shell-data';
import { PageSettingsPanel } from '../../surfaces/studio/page-settings-panel';
import { HostSettingsPanel } from '../../surfaces/studio/host-settings-panel';
import { PieceSettingsPanel } from '../../surfaces/studio/piece-settings-panel';
import { EmailTagsPanel } from '../../surfaces/studio/email-tags-panel';
import { catalogFor } from './catalog-scope';
import { renderStudioIcon } from './studio-icons';
import { useCanvasPreview, type CanvasPreview } from './preview';
import { EMAIL_CONTENT_BLOCKS, useEmailIdentity, useEmailPreview } from './email-domain';
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
  const property = useActiveProperty(useActivePropertyId());
  const preview = useCanvasPreview();
  // `site.*` in an email is THIS business, not a sample — the same identity the
  // header draws, the theme board names, and the merge-tag panel lists.
  const emailPreview = useEmailPreview(useEmailIdentity());
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
/**
 * Where a bound value is set, in the words on the screen that sets it.
 *
 * Piggles' own names, never the platform's refs: `site.identity.email` is "Your
 * site, under Email address" — the rail item and the field label, both read off
 * the screen, so the sentence is a route somebody can walk rather than a
 * description of one.
 */
const BINDING_HOMES: Record<string, string> = {
  'site.identity.name': 'Your site, under Site name',
  'site.identity.email': 'Your site, under Email address',
  'site.identity.phone': 'Your site, under Phone number',
  'site.identity.phoneHref': 'Your site, under Phone number',
  'site.identity.address': 'Your site, under Address',
};

function describeSiteBinding(ref: string): string | undefined {
  return BINDING_HOMES[ref];
}

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
  pickMedia: () => Promise<PickedAsset | null>;
}): StudioHost {
  // The same root for both, so the mark a header draws and the text a bound node
  // draws come from one answer about who this business is.
  const drawHostNode = makeRenderHostNode(preview.root);
  return {
    fallbackTheme,
    // The same identity the header draws, so a preview that names the business
    // names THIS one — the theme pane's board is otherwise the only surface in the
    // console that shows somebody else's shop.
    siteName: preview.resolve('site.identity.name'),
    catalog: catalogFor,
    // The builders' chrome in the console's own icon set, so a bar does not carry
    // two glyph families at once. studio-icons.tsx on what it does and does not
    // cover.
    renderIcon: renderStudioIcon,
    renderHostNode: (node) => drawHostNode(node, { preview: true }),
    resolveBinding: (ref) => preview.resolve(ref),
    // ...and, for the ones an owner will try to type over, WHERE they live. The
    // Contact page's email and phone are the whole reason this exists: they are
    // bound so that typing them once fills every page, and until this said so a
    // double-click on the placeholder did nothing and the Inspector offered a
    // box that silently changed nothing.
    describeBinding: describeSiteBinding,
    // The business's own picture browser, so no image field ever asks for a web
    // address. A picked asset with no URL is one still being processed — treated as
    // "nothing picked" rather than written as an empty source.
    //
    // The alt text is the LIBRARY's, and stays empty when the library has none.
    // It used to be the filename, so a screen reader announced
    // "salon-editorial-noor.jpeg" and the pre-publish check saw a description
    // where there was none.
    pickAsset: async () => {
      const picked = await pickMedia();
      if (!picked?.url) return null;
      const alt = picked.altText?.trim();
      return alt ? { url: picked.url, alt } : { url: picked.url };
    },
    // Email resolves against its own sample recipient, never the site's preview root:
    // `customer.firstName` means the person this is being SENT to.
    emailPreview,
    // The exact colours the send paints with, so a new block lands on brand. Absent
    // until the read settles — silica's neutral default then, which is visibly not
    // the brand rather than quietly the wrong brand.
    ...(emailColors ? { emailColors } : {}),
    emailCatalog: () => EMAIL_CONTENT_BLOCKS,
    // The document's own settings at the root; below it, a live region's declared
    // props. Without the second half a core's `props` were metadata nothing drew,
    // so a map could be placed and never told where it is.
    inspectorPanels: (node, ctx) => {
      if (ctx.isRoot) return panelFor(ctx.doc.kind);
      return node ? <HostSettingsPanel node={node} /> : null;
    },
    // Platform policy, not a tenant setting: a viewport variant makes the device
    // toggle lie about the page, and no business benefits from opting into that.
    validateClass: (className: string) => validateResponsiveVocabulary(className),
  };
}
