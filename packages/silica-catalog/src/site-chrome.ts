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

import { HOST_KEYS, hostCore } from './host-nodes';

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
        // The brand mark — a LIVE host core, not a stamped lockup. The platform renders
        // the tenant's current logo + name here on every request, so uploading a logo in
        // Site settings shows up in the header with no builder trip, and every future
        // improvement to the mark reaches every tenant. A stamped node would freeze at
        // publish (see `HOST_KEYS.siteBrand`). Not pinned: the tenant owns its placement.
        hostCore(HOST_KEYS.siteBrand),
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
