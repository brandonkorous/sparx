'use client';

// Piggles' contribution to the studio — the domain seam.
//
// The engine knows what a node is; this knows what this business can put on a
// page, what its live regions look like, and what its own data says. The catalog,
// the pinned functional cores, the class policy and the fallback theme all come
// from the shared platform packages, so the blocks an author can insert here are
// the same ones the storefront renders — in the same colors.

import { useMemo, type ReactNode } from 'react';
import type { DocumentKind } from '@wizeworks/studio';
import type { EmailPreviewHost, StudioHost } from '@wizeworks/studio/react';
import type { Theme } from '@wizeworks/silicaui-html';
import type { EmailColorDefaults } from '@wizeworks/silicaui-builder/email';
import { BASE_SILICA_THEME, validateResponsiveVocabulary } from '@wizeworks/silica-catalog';
import { makeRenderHostNode } from './host-cores';
import { useMediaPicker, type PickedAsset } from '../../surfaces/cms/media-picker';
import { PageSettingsPanel } from '../../surfaces/studio/page-settings-panel';
import { HostSettingsPanel } from '../../surfaces/studio/host-settings-panel';
import { ProductsSourcePanel } from '../../surfaces/studio/products-source-panel';
import { PieceSettingsPanel } from '../../surfaces/studio/piece-settings-panel';
import { EmailTagsPanel } from '../../surfaces/studio/email-tags-panel';
import { catalogFor } from './catalog-scope';
import { renderStudioIcon } from './studio-icons';
import { useCanvasPreview, type CanvasPreview } from './preview';
import { EMAIL_CONTENT_BLOCKS, useEmailIdentity, useEmailPreview } from './email-domain';
import { useEmailColors } from './email-data';

/**
 * The host. Never null — there is nothing left to wait for.
 *
 * THE FALLBACK THEME IS THE STOREFRONT'S FALLBACK THEME, and that is the whole
 * point of the constant. A site whose author has never published a theme wears
 * `BASE_SILICA_THEME` when it is served (`app/layout.tsx`:
 * `silicaFrame.theme ?? BASE_SILICA_THEME`), so the canvas has to open on the
 * same thing or the editor is showing colors nobody will ever see.
 *
 * It used to compile the tenant's brand columns plus `property.brandOverride`
 * into a theme. That was correct while the storefront did the same, and the
 * storefront stopped: brand is identity-only now (logo, favicon, tagline) and the
 * brand-derived theme tier was deleted from the served page. Only this half was
 * left behind, so Juniper Row's canvas painted every primary button #c77618 and
 * her live site painted them #e04631 — an owner designing against one color and
 * shipping another, with nothing anywhere saying so (issue 271).
 *
 * A site that HAS a theme is unaffected: `resolveTheme` reads the session's own
 * theme store first and only reaches this when there is none.
 */
export function useStudioHostConfig(): StudioHost | null {
  const preview = useCanvasPreview();
  // `site.*` in an email is THIS business, not a sample — the same identity the
  // header draws, the theme board names, and the merge-tag panel lists.
  const emailPreview = useEmailPreview(useEmailIdentity());
  const emailColors = useEmailColors();
  const pickMedia = useMediaPicker();

  return useMemo(
    () =>
      buildHost({
        fallbackTheme: BASE_SILICA_THEME,
        preview,
        emailPreview,
        emailColors: emailColors.data,
        pickMedia,
      }),
    [preview, emailPreview, emailColors.data, pickMedia]
  );
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
    // The exact colors the send paints with, so a new block lands on brand. Absent
    // until the read settles — silica's neutral default then, which is visibly not
    // the brand rather than quietly the wrong brand.
    ...(emailColors ? { emailColors } : {}),
    emailCatalog: () => EMAIL_CONTENT_BLOCKS,
    // The document's own settings at the root; below it, a live region's declared
    // props and — on a product listing — which products it shows. Without the second
    // half a core's `props` were metadata nothing drew, so a map could be placed and
    // never told where it is; without the third, every Products block anyone dropped
    // was the whole catalog for good (issue 211).
    inspectorPanels: (node, ctx) => {
      if (ctx.isRoot) return panelFor(ctx.doc.kind);
      if (!node) return null;
      return (
        <>
          <HostSettingsPanel node={node} />
          <ProductsSourcePanel node={node} />
        </>
      );
    },
    // Platform policy, not a tenant setting: a viewport variant makes the device
    // toggle lie about the page, and no business benefits from opting into that.
    validateClass: (className: string) => validateResponsiveVocabulary(className),
  };
}
