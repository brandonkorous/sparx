// Two pages that answer to the same web address.
//
// A page's address is its slug, and a singleton with no slug IS the home page —
// that is the product rule, and `slug ?? '/'` all over this codebase encodes it.
// Which means a site can hold three pages that all claim `/`, one of them wins by
// whatever order the router happened to read them in, and the other two are simply
// gone. Nothing errors. The author opens the site, sees a home page, and has no way
// to learn that the one they spent the afternoon on is not the one being served.
//
// This is the failure the rest of this package exists to catch, in its purest form:
// a wrong outcome that is indistinguishable from a right one until somebody counts.
//
// It reads PAGE METADATA, never a tree — which is why the caller can hand it every
// page the site has, including ones with no saved draft. A page nobody has opened
// yet still occupies its address.
//
// RECORD PAGES ARE EXEMPT. `/products/:handle` and `/blog/:slug` are templates, not
// pages; ten of them carrying no slug is the correct shape of a site, not ten
// duplicate home pages.

import type { PageAddress } from './types';
import type { RawFinding } from './finding';

/** A record template is addressed by its record, never by a slug of its own. */
export function isTemplate(page: PageAddress): boolean {
  return page.kind === 'collection' || page.recordType != null;
}

/** What a visitor would type to reach this page. `null` slug means home. */
export function addressOf(page: PageAddress): string {
  const slug = (page.slug ?? '').trim();
  if (!slug || slug === '/') return '/';
  return slug.startsWith('/') ? slug : `/${slug}`;
}

/** In the author's words. "your home page" reads better than "the address /". */
function nameFor(address: string): string {
  return address === '/' ? 'your home page' : `the address ${address}`;
}

export function checkAddresses(pages: readonly PageAddress[]): RawFinding[] {
  const byAddress = new Map<string, PageAddress[]>();
  for (const page of pages) {
    if (isTemplate(page)) continue;
    const address = addressOf(page);
    const seen = byAddress.get(address);
    if (seen) seen.push(page);
    else byAddress.set(address, [page]);
  }

  const findings: RawFinding[] = [];
  for (const [address, sharing] of byAddress) {
    if (sharing.length < 2) continue;
    // One finding PER PAGE, not one for the clash. The author has to choose which of
    // them keeps the address, and a single finding attached to one of the pages would
    // point at exactly the page they might not be looking for.
    const others = sharing.map((page) => page.name);
    for (const page of sharing) {
      findings.push({
        origin: { scope: 'page', ownerId: page.id, ownerName: page.name },
        nodeId: null,
        nodePath: '',
        rule: 'page-address-duplicate',
        severity: 'error',
        title: `${sharing.length} pages are all set to be ${nameFor(address)}`,
        detail:
          `${others.join(', ')} all answer to ${address}. Only one of them can — visitors ` +
          `will get whichever the site happens to reach first, and the others cannot be ` +
          `opened at all. Give the ones you did not mean a web address of their own in ` +
          `page settings, or delete them.`,
      });
    }
  }
  return findings;
}
