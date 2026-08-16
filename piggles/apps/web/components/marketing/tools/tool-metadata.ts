import type { Metadata } from 'next';
import { PRODUCT } from '@piggles/config';
import type { PigglesTool } from './registry';

/**
 * One tool entry → the whole of a page's `<head>`.
 *
 * Seventeen pages hand-rolling their own metadata object is seventeen chances to
 * forget the canonical, and a missing canonical on a page that exists to rank is
 * the kind of fault that costs months and reports nothing. The registry already
 * holds every string this needs, so this is a projection rather than a decision.
 *
 * `title` is deliberately NOT the display name on its own. The root layout
 * appends"· Piggles", so a tab reading "Favicon maker · Piggles" tells a person
 * what page they are on and tells a search engine nothing about what it does.
 * The suffix here is the searchable phrasing the display name gives up (see the
 * naming note in registry.ts) — which is the whole reason the two can differ
 * without the page losing anything.
 */
export function toolMetadata(tool: PigglesTool, searchTitle: string): Metadata {
  const url = `https://${PRODUCT.hosts.marketing}/tools/${tool.slug}`;

  return {
    title: searchTitle,
    description: tool.description,
    keywords: tool.keywords,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title: `${searchTitle} · ${PRODUCT.name}`,
      description: tool.tagline,
      url,
      siteName: PRODUCT.name,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${searchTitle} · ${PRODUCT.name}`,
      description: tool.tagline,
    },
  };
}

/**
 * The searchable title for each tool — the phrase somebody types, which is not
 * always the name they want to read once they get here.
 *
 * Kept beside the metadata builder rather than in the registry on purpose: this
 * is a search artefact, and putting it next to `name` in the catalog invites the
 * next person to "tidy up the duplication" by deleting one of them. They are two
 * different strings doing two different jobs, and the day they are merged the
 * page either stops ranking or starts shouting jargon at a florist.
 */
export const TOOL_SEARCH_TITLES: Record<string, string> = {
  favicon: 'Free favicon generator',
  'qr-code': 'Free QR code generator',
  'utm-builder': 'Free UTM link builder',
  'og-image': 'Free Open Graph image generator',
  'email-signature': 'Free email signature generator',
  invoice: 'Free invoice generator',
  'email-deliverability': 'Free SPF, DKIM and DMARC checker',
  'meta-tags': 'Free meta tag generator and search preview',
  'color-palette': 'Free colour palette generator',
  'margin-calculator': 'Free margin and markup calculator',
  quote: 'Free quote and estimate generator',
  'structured-data': 'Free structured data (JSON-LD) generator',
  'contrast-checker': 'Free WCAG colour contrast checker',
  barcode: 'Free barcode generator',
  'digital-card': 'Free digital business card and vCard generator',
  'privacy-policy': 'Free privacy policy generator',
  'domain-checker': 'Free domain availability checker',
};

export function searchTitleFor(tool: PigglesTool): string {
  return TOOL_SEARCH_TITLES[tool.slug] ?? tool.name;
}
