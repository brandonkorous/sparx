'use client';

// WHAT ON HER SITE IS STILL THE EXAMPLE.
//
// A design is copied into a site when it is installed, so what goes live on day
// one is real content under her own name: example words on every page, example
// products with prices and a working Add to cart, and example articles in the
// Journal.
//
// That is the right way to build it. It is only true until she publishes. A
// business that pays and goes live before editing puts somebody else's
// merchandise and somebody else's articles on the public internet under its own
// name, and nothing in the product ever said so (issue 849).
//
// Read-only, and independent of the catalog: it asks what the install stamped
// against what is live now, so it answers for a design that has never had an
// update — which is the ordinary case and the one this is for.

import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { blueprintKeys } from './blueprints-data';

/** One thing on her site that still says exactly what the design delivered. */
export interface UntouchedArtifact {
  kind: 'page' | 'product' | 'content';
  /** The manifest key: a page slug, a product handle, `typeKey:slug` for an
   *  article. Turned into words a person recognises by `untouchedLabel`. */
  naturalKey: string;
  refId: string | null;
}

export interface UntouchedReport {
  installId: string;
  blueprintKey: string;
  /** Products and articles: somebody else's words on the customer's side. */
  examples: UntouchedArtifact[];
  /** Pages whose words are still the example words. */
  pages: UntouchedArtifact[];
  total: number;
}

/**
 * What a visitor to this site can still read that she did not write.
 *
 * Costs a read per install, so it is asked once and held for a while: nothing
 * here changes between one glance at Home and the next, and the panel it feeds
 * is an offer rather than an alarm.
 */
export function useUntouched(installId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...blueprintKeys.installs(), 'untouched', installId],
    queryFn: () => api.get<UntouchedReport>(`/v1/blueprints/installs/${installId}/untouched`),
    enabled: enabled && installId !== '',
    staleTime: 60_000,
  });
}

/** A page's own name, from the slug the design filed it under. */
const PAGE_WORDS: Readonly<Record<string, string>> = {
  home: 'your home page',
  'slug:about': 'About',
  'slug:shop': 'Shop',
  'slug:blog': 'Journal',
  'slug:contact': 'Contact',
  'slug:book': 'Book',
  'slug:wholesale': 'Wholesale',
};

/**
 * What to CALL one of these, in her words.
 *
 * A natural key is a manifest correlation key — `slug:about`,
 * `blog_post:launch-your-store-in-a-weekend`, `rowan-enamel-mug` — and none of
 * those are words. A page she has a name for gets that name; anything else is
 * de-slugged, which reads as a title and never as a key.
 */
export function untouchedLabel(artifact: UntouchedArtifact): string {
  if (artifact.kind === 'page') {
    return PAGE_WORDS[artifact.naturalKey] ?? titleFrom(artifact.naturalKey.replace(/^slug:/, ''));
  }
  // An article's key is `typeKey:slug`; a product's is a bare handle.
  const tail = artifact.naturalKey.includes(':')
    ? (artifact.naturalKey.split(':').pop() ?? '')
    : artifact.naturalKey;
  return titleFrom(tail);
}

function titleFrom(slug: string): string {
  const words = slug.replace(/[-_]+/g, ' ').trim();
  if (words === '') return 'Untitled';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The first few, named, and an honest count of the rest.
 *
 * Naming three and counting the remainder is the shape that fits one sentence.
 * Listing nine turns an offer into a wall, and a bare number ("9 things") tells
 * her nothing she can act on.
 */
export function namedFew(artifacts: UntouchedArtifact[], take = 3): string {
  const names = artifacts.slice(0, take).map(untouchedLabel);
  if (names.length === 0) return '';
  const rest = artifacts.length - names.length;
  // With a remainder, the count IS the last item in the list, so the named ones
  // are joined with commas and "and" is spent once. Two "and"s in one phrase
  // ("A, B and C and 3 more") reads as a sentence that lost its way.
  if (rest > 0) return `${names.join(', ')} and ${String(rest)} more`;
  return joinWords(names);
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
