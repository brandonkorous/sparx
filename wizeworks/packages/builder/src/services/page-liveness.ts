// What "live" means for a page row — the one definition both services read from.
//
// The question the console keeps getting wrong is not "is this published" but "can a
// visitor reach it", and the two are different because the PLATFORM serves pages
// nobody published. Kept here rather than in either service because both need it and
// neither owns it.

import type { BuilderPage } from '@wizeworks/db';
import { starterPages, type SiteChromeOptions } from '@wizeworks/silica-catalog';

/** A stored slug as the ADDRESS it presents at. Both spellings are in the store — a
 *  blueprint writes `about`, the code starter writes `/about` — and they are the same
 *  page to a visitor, so they must be the same page to anything asking "is this
 *  address taken". */
export const atAddress = (slug: string | null): string => (slug ?? '').replace(/^\/+/, '');

/**
 * Whether a VISITOR can reach this page right now.
 *
 * Not the same question as `published`, and the difference is a page's whole story on
 * the list screen. Two things the platform serves without anyone publishing them: a
 * record template's address (`/blog/:slug`, `/products/:handle`), drawn by the code
 * composite, and an ORDINARY starter address (`/blog`, `/about`), drawn by the
 * storefront's per-slug starter fallback. Both answer 200 to the world while
 * `published` is false.
 *
 * Saying "Not live yet" about them is how three of Juniper Row's page types came to be
 * reported missing from a site that was serving every one of them (issue 270), and how
 * her Journal came to be absent from the list altogether (issue 274).
 *
 * `modules` decides the ordinary half, because the starter set does: a Journal is only
 * standard for a business with the CMS module on. The package's usual default applies
 * when a caller names none.
 */
export function isLive(
  row: Pick<BuilderPage, 'kind' | 'slug' | 'recordType' | 'publishedAt'>,
  modules: SiteChromeOptions
): boolean {
  if (row.publishedAt != null) return true;
  if (row.kind === 'collection' || row.recordType !== null) return true;
  return starterPages(modules).some((p) => atAddress(p.slug) === atAddress(row.slug));
}
