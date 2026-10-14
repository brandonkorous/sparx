// What "live" means for a page row — the one definition both services read from.
//
// The question the console keeps getting wrong is not "is this published" but "can a
// visitor reach it", and the two are different because the PLATFORM serves pages
// nobody published. Kept here rather than in either service because both need it and
// neither owns it.

import type { BuilderPage } from '@wizeworks/db';
import {
  kindAddressAt,
  moduleForKey,
  moduleForPath,
  recordAddressAt,
  recordAddressFor,
  starterPages,
  type SiteChromeOptions,
} from '@wizeworks/silica-catalog';

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

/** The modules a site can switch off for itself, as `SiteChromeOptions` names them. */
const SWITCHES = [
  ['commerce', 'commerceEnabled'],
  ['scheduling', 'schedulingEnabled'],
  ['cms', 'cmsEnabled'],
] as const;

export type SiteSwitch = (typeof SWITCHES)[number][0];

/**
 * Which module, switched off for THIS site, takes this page off it — or null.
 *
 * A journal that switched Selling off under "What this site shows" has no shop: `/shop`,
 * `/cart` and every product page answer 404 (issue 944). The page list still called
 * them "Live", because it judged them by what the ACCOUNT has. `account` is that; `site`
 * is what this site shows. A page the account would serve and the site will not is off
 * here, and the module is the reason.
 *
 * Only pages whose ADDRESS belongs to the module: the record pages, and the addresses the
 * site's own table gives it. A page the owner made at an address of her own is hers,
 * whatever is on it.
 */
export function offOnSite(
  row: Pick<BuilderPage, 'kind' | 'slug' | 'recordType'>,
  account: SiteChromeOptions,
  site: SiteChromeOptions,
  // The host cores of the tree the site SERVES at this address (its published tree,
  // else the starter's). The site refuses a page whose core belongs to a switched-off
  // module — the page a journal's design called "Shop" is a product grid — so the list
  // asks the same question (`moduleForKey`).
  hostKeys: readonly string[] = []
): SiteSwitch | null {
  const off = (key: (typeof SWITCHES)[number][1]) =>
    (account[key] ?? key === 'commerceEnabled') && !(site[key] ?? key === 'commerceEnabled');

  const record = recordAddressAt(row.slug) ?? recordAddressFor(row.recordType ?? '');
  if (record) {
    const found = SWITCHES.find(([module]) => module === record.module);
    return found && off(found[1]) ? found[0] : null;
  }
  if (kindAddressAt(row.slug) || row.recordType?.startsWith('cms.')) {
    return off('cmsEnabled') ? 'cms' : null;
  }
  if (row.kind === 'collection') return null;

  // Any other page is off when the site's own table gives its address to a switched-off
  // module (`moduleForPath`, the table the site's routes enforce). Never from the
  // starter set: that called a journal's sign-in pages off while the site served them.
  const owners = [moduleForPath(`/${atAddress(row.slug)}`), ...hostKeys.map(moduleForKey)];
  for (const [module, key] of SWITCHES) {
    if (owners.includes(module) && off(key)) return module;
  }
  return null;
}
