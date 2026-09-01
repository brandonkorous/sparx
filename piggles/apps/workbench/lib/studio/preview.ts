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
import { buildPreviewRoot, type SitePreviewData } from './preview-data';
import { useActivePropertyId, useTenant } from '../api/shell-data';

/**
 * What the shell already knows about the business, for the moment before the fuller
 * chrome read lands.
 *
 * WHY THIS EXISTS. `site.identity.name` is a text field whose key reads as a title, so
 * the synthetic placeholder filled it with a sample HEADLINE — and until the chrome
 * query resolved, the canvas header and footer both announced the business as "Built
 * for the work". The owner's own studio told her, for a beat on every page open, that
 * her shop was called something else.
 *
 * The name was never missing. `useSitePreview` is keyed on the tenant and site SLUGS,
 * which arrive from two earlier reads that carry the NAMES alongside them, so the
 * answer is in hand strictly before the query it was waiting on can start.
 *
 * EVERY OTHER FIELD IS `null` ON PURPOSE, and null is not the same as empty: an empty
 * string is a known-but-empty value that blanks the node, while null leaves the
 * authored content alone. So a tagline, a logo or a phone line keeps saying what its
 * author typed until the real value arrives — which is a strict improvement on the
 * placeholder sentence and the empty-URL image the synthetic root supplied.
 */
function knownIdentity(name: string): SitePreviewData {
  return {
    identity: {
      name,
      tagline: null,
      logo: null,
      logoDark: null,
      phone: null,
      email: null,
      address: null,
      phoneHref: null,
      emailHref: null,
    },
    social: [],
  };
}

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
  const property = useActiveProperty(useActivePropertyId());
  const site = useSitePreview(tenant.data?.slug ?? null, property.data?.slug ?? null);

  return useMemo(() => {
    const sources: DataSource[] = catalog.data?.sources.length
      ? [...catalog.data.sources]
      : [...COMMERCE_SOURCES];
    // The site's own name wins over the tenant's: one owner can run two shops, and
    // the canvas is showing ONE of them (docs/49, the same order `useSitePreview`
    // resolves in).
    const known = (property.data?.name ?? tenant.data?.name ?? '').trim();
    const root = buildPreviewRoot(
      [...sources, ...SITE_SOURCES],
      site.data ?? (known ? knownIdentity(known) : null)
    );
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
    // `tenant.data` and `property.data` belong here as well as `site.data`: they are
    // what the fallback above is built from, so a memo that ignored them would hold
    // the placeholder name until something else happened to change.
  }, [catalog.data, site.data, tenant.data, property.data]);
}
