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

/** A nav link — a plain anchor to an in-site route. */
function navLink(label: string, href: string): Node {
  return el(
    'a',
    'text-sm font-medium text-base-content/70 transition-colors hover:text-base-content',
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
        el('a', 'text-sm text-base-content/60 transition-colors hover:text-base-content', {
          attrs: { href },
          text: label,
        })
      ),
    ],
  });
}

/** The site navbar: the tenant wordmark (bound to `site.identity.name`) on the
 *  left, primary links centered-right, and a single call-to-action. A `<nav>` on
 *  core flex utilities so it needs no component class. */
export function siteNavbar(): Node {
  return el(
    'nav',
    'flex items-center justify-between gap-6 border-b border-base-300 bg-base-100 px-6 py-4',
    {
      attrs: { 'aria-label': 'Primary' },
      children: [
        // Wordmark — bound, so it renders the tenant's site name.
        bind(
          el('a', 'text-xl font-bold tracking-tight text-base-content', {
            attrs: { href: '/' },
            text: 'Your site',
          }),
          'site.identity.name'
        ),
        el('div', 'flex items-center gap-6', {
          children: [
            el('div', 'hidden items-center gap-6 sm:flex', {
              children: [
                navLink('Shop', '/shop'),
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
export function siteFooter(): Node {
  return el('footer', 'border-t border-base-300 bg-base-200 px-6 py-12', {
    children: [
      el('div', 'mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4', {
        children: [
          el('div', 'flex flex-col gap-3', {
            children: [
              bind(
                el('span', 'text-lg font-bold text-base-content', { text: 'Your site' }),
                'site.identity.name'
              ),
              el('p', 'max-w-xs text-sm text-base-content/60', {
                text: 'Everything you publish and sell, in one place.',
              }),
            ],
          }),
          footerColumn('Explore', [
            ['Shop', '/shop'],
            ['About', '/about'],
            ['Contact', '/contact'],
          ]),
          footerColumn('Account', [
            ['Sign in', '/account'],
            ['Orders', '/account/orders'],
            ['Cart', '/cart'],
          ]),
          footerColumn('More', [
            ['Search', '/search'],
            ['Privacy', '/privacy'],
            ['Terms', '/terms'],
          ]),
        ],
      }),
      el('div', 'mx-auto mt-10 max-w-6xl border-t border-base-300 pt-6', {
        children: [
          bind(
            el('p', 'text-sm text-base-content/50', { text: 'Your site' }),
            'site.identity.name'
          ),
        ],
      }),
    ],
  });
}
