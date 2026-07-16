// The sparx-native silica site chrome (docs/118 Stage 6) — the branded navbar +
// footer the starter frame composes around the Outlet.
//
// Authored from silica PRIMITIVES (not silica's shipped marketing `navbar`/`footer`
// blocks, which hardcode "SilicaUI" demo branding), so the starter carries the
// TENANT'S identity: the wordmark + footer name + copyright BIND to
// `site.identity.name`, resolved per-tenant by the storefront host's `site.*` root
// (`buildSilicaHost({ site })`). Copy is neutral and jargon-free — a business owner
// with no store yet, no vertical assumed (content and/or commerce, per the platform
// framing) — so it reads as a real starting point, not a filled-in demo.
//
// AUTHORING CONTRACT (builder-contract §5): every factory returns a FRESH, id-free
// `Node`; every class is a LITERAL string (the Tailwind `@source` harness safelists
// them); layout uses core utilities (flex/grid/gap), not a component class that may
// not exist in the plugin.

import { atom, bind, el, type Node } from '@wizeworks/silicaui-html';

// A neutral "your logo goes here" placeholder — the brand wordmark's default image src
// (unbound in the editor, and when a tenant inserts it before uploading a logo). Distinct
// from the product-card placeholder (a photo tile): this reads as a logo slot, and silica's
// `fillValue` overwrites it with the tenant's real logo the moment `site.identity.logo`
// resolves against data, so it never ships to a live site that HAS a logo.
const LOGO_PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40'>" +
  "<rect width='120' height='40' rx='6' fill='%23e5e7eb'/>" +
  "<text x='60' y='25' font-family='sans-serif' font-size='13' fill='%239ca3af' text-anchor='middle'>Logo</text></svg>";

/** The brand wordmark WITH a logo (docs/122) — silica's `Wordmark` carrying the tenant's
 *  logo image (bound to `site.identity.logo`) beside the site name (bound to
 *  `site.identity.name`). Both are PRE-BOUND, so a tenant who has uploaded a brand logo gets
 *  it in the header with zero binding work. Delete the name for a logo-only mark, or the
 *  image for the text-only wordmark.
 *
 *  Uses `Wordmark`'s CHILDREN ("power") path rather than its one-control `props.src`,
 *  because a node carries exactly ONE `data.ref` and `Wordmark`'s `primary: "text"` claims
 *  a bare bind for the NAME — so `src` could only ever hold a STATIC url, which cannot
 *  follow site settings. Two bound children = the logo AND the name both live. The children
 *  path lowers to `<a href>` (its `href` prop) wrapping them verbatim, and silica's own
 *  `.wordmark & :is(svg,img)` rule sizes the mark, so this stays a real Wordmark — not a
 *  hand-rolled lockup that merely looks like one (silicaui ≥0.24; before it, `Wordmark` was
 *  a text-only span and a logo was impossible by construction).
 *
 *  The image degrades to a neutral "Logo" placeholder when no logo is set (bound trees
 *  can't do logo-else-text fallback — both render, and the tenant removes whichever they
 *  don't want). The logo's `alt` fills from the bound `{url, alt}` (alt = the site name). */
export function brandWordmark(): Node {
  return atom('Wordmark', 'wordmark inline-flex items-center gap-2.5', { href: '/' }, [
    bind(
      atom('Image', 'h-8 w-auto object-contain', { src: LOGO_PLACEHOLDER, alt: 'Logo' }),
      'site.identity.logo'
    ),
    bind(el('span', '', { text: 'Your site' }), 'site.identity.name'),
  ]);
}

/** A nav link — a plain anchor to an in-site route. */
function navLink(label: string, href: string): Node {
  return el(
    'a',
    'text-sm font-medium text-base-content transition-colors hover:text-base-content',
    {
      attrs: { href },
      text: label,
    }
  );
}

/** A footer link column: a heading + a stack of links. */
function footerColumn(title: string, links: [string, string][]): Node {
  return el('div', 'flex flex-col gap-3', {
    children: [
      el('h3', 'text-sm font-semibold text-base-content', { text: title }),
      ...links.map(([label, href]) =>
        el('a', 'text-sm text-base-content transition-colors hover:text-base-content', {
          attrs: { href },
          text: label,
        })
      ),
    ],
  });
}

export interface SiteChromeOptions {
  /** Whether to show Shop/Cart/Orders links — omit for a tenant with no Commerce
   *  module active, so the chrome never invites a visitor into a store that
   *  doesn't exist (content and/or commerce — never assumed). Defaults to `true`
   *  so existing callers (the MCP catalog block, tests) are unaffected. */
  commerceEnabled?: boolean;
  /** Whether to show the Book link + seed a `/book` page — on only for a tenant with
   *  the Scheduling module active. Defaults to `false` (opt-in, unlike Commerce's
   *  legacy unconditional Shop): a content/commerce tenant with no bookings never gets
   *  a Book link or an orphan booking page. */
  schedulingEnabled?: boolean;
}

/** The site navbar: the tenant wordmark (bound to `site.identity.name`) on the
 *  left, primary links centered-right, and a single call-to-action. A `<nav>` on
 *  core flex utilities so it needs no component class. */
export function siteNavbar(opts: SiteChromeOptions = {}): Node {
  const { commerceEnabled = true, schedulingEnabled = false } = opts;
  return el(
    'nav',
    'flex items-center justify-between gap-6 border-b border-base-300 bg-base-100 px-6 py-4',
    {
      attrs: { 'aria-label': 'Primary' },
      children: [
        // The brand lockup — the tenant's logo + name, both bound, so a tenant who has
        // uploaded a logo gets a real header mark with zero binding work (docs/122). Was a
        // bare text `<a>`: correct while silica's Wordmark was text-only, but it left the
        // logo with nowhere to go and no author-visible way to add one.
        brandWordmark(),
        el('div', 'flex items-center gap-6', {
          children: [
            el('div', 'hidden items-center gap-6 sm:flex', {
              children: [
                ...(commerceEnabled ? [navLink('Shop', '/shop')] : []),
                ...(schedulingEnabled ? [navLink('Book', '/book')] : []),
                navLink('About', '/about'),
                navLink('Contact', '/contact'),
              ],
            }),
            atom('Button', 'btn btn-primary btn-sm', { type: 'button' }, ['Get in touch']),
          ],
        }),
      ],
    }
  );
}

/** The site footer: a brand column (name bound) + link columns + a bound
 *  copyright line. Neutral, industry-agnostic labels. */
export function siteFooter(opts: SiteChromeOptions = {}): Node {
  const { commerceEnabled = true, schedulingEnabled = false } = opts;
  return el('footer', 'border-t border-base-300 bg-base-200 px-6 py-12', {
    children: [
      el(
        'div',
        commerceEnabled
          ? 'mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4'
          : 'mx-auto grid max-w-6xl gap-10 sm:grid-cols-3',
        {
          children: [
            el('div', 'flex flex-col gap-3', {
              children: [
                bind(
                  el('span', 'text-lg font-bold text-base-content', { text: 'Your site' }),
                  'site.identity.name'
                ),
                el('p', 'max-w-xs text-sm text-base-content', {
                  text: commerceEnabled
                    ? 'Everything you publish and sell, in one place.'
                    : 'Everything you publish, in one place.',
                }),
              ],
            }),
            footerColumn('Explore', [
              ...(commerceEnabled ? ([['Shop', '/shop']] as [string, string][]) : []),
              ...(schedulingEnabled ? ([['Book', '/book']] as [string, string][]) : []),
              ['About', '/about'],
              ['Contact', '/contact'],
            ]),
            ...(commerceEnabled
              ? [
                  footerColumn('Account', [
                    ['Sign in', '/account'],
                    ['Orders', '/account/orders'],
                    ['Cart', '/cart'],
                  ]),
                ]
              : []),
            footerColumn('More', [
              ['Search', '/search'],
              ['Privacy', '/privacy-policy'],
              ['Terms', '/terms-of-service'],
            ]),
          ],
        }
      ),
      el('div', 'mx-auto mt-10 max-w-6xl border-t border-base-300 pt-6', {
        children: [
          bind(el('p', 'text-sm text-base-content', { text: 'Your site' }), 'site.identity.name'),
        ],
      }),
    ],
  });
}
