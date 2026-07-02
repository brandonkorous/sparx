// Mosaic generator — the site layout tree: sticky header · Outlet · footer. The Outlet
// is the only required node; everything else is author-composed chrome (CLAUDE.md "site
// layout is a free canvas"). The header mirrors Farm Fresh's proven app-bar pattern: a
// full-bleed band wrapping a contained logo · nav · CTA row that stays inline
// (`collapse:false`). Class strings track docs/mockups/examples/notion.html.

import { btn } from './media';
import { footerCol } from './sections';
import { atom, bound, el, node, type BuilderNode } from './_kit';

// Nav links resolve to real routes this blueprint builds (no dead anchors).
const NAV = [
  { label: 'Product', href: '/' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Enterprise', href: '/enterprise' },
  { label: 'Customers', href: '/customers' },
  { label: 'Request a demo', href: '/request-demo' },
];

const wordmark = (): BuilderNode => bound(atom('Wordmark', '', {}), 'site.identity');

/** The footer's language selector — a hairline pill with a globe glyph (decorative). */
const languagePill = (): BuilderNode =>
  el('button', 'mt-5 inline-flex w-fit items-center gap-1.5 rounded-lg border border-base-300 px-3 py-1.5 text-sm text-base-content', {
    attrs: { type: 'button' },
    children: [atom('Icon', 'h-4 w-4', { name: 'globe' }), el('span', '', { text: 'English (US)' })],
  });

function header(): BuilderNode {
  return node('Section', {
    name: 'Header',
    cls: 'sticky top-0 z-30 bg-base-100 border-b border-base-300',
    box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: { padding: 'md', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'row', justify: 'between', alignItems: 'center', collapse: false },
        children: [
          // Left: brand + primary nav. NavMenu is a CONTAINER of NavItem children
          // (docs/57 rebuild) — the container-native form the starter + platform emit.
          el('div', 'flex items-center gap-3 @3xl:gap-6', {
            children: [
              wordmark(),
              atom(
                'NavMenu',
                '',
                { orientation: 'row' },
                NAV.map((l) => atom('NavItem', '', { label: l.label, href: l.href }))
              ),
            ],
          }),
          // Right: a quiet log-in link + the solid blue sign-up CTA.
          el('div', 'flex items-center gap-2', {
            children: [
              el('a', 'hidden px-2 text-sm font-medium text-base-content transition-colors hover:text-[#191918] @sm:inline-flex', {
                text: 'Log in',
                attrs: { href: '#' },
              }),
              btn('Get Mosaic free', '/request-demo', { variant: 'primary', size: 'sm' }),
            ],
          }),
        ],
      }),
    ],
  });
}

function footer(): BuilderNode {
  return node('Section', {
    cls: 'border-t border-base-300',
    box: { name: 'Footer', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'lg', alignItems: 'start' },
    children: [
      // Column grid: brand block + four link columns.
      el('div', 'grid w-full grid-cols-2 gap-10 @3xl:grid-cols-5', {
        children: [
          el('div', 'col-span-2 flex flex-col @3xl:col-span-1', {
            children: [
              wordmark(),
              el('p', 'mt-4 max-w-xs text-sm leading-relaxed text-base-content/60', {
                text: 'The AI workspace where your docs, projects, and knowledge come together.',
              }),
              bound(atom('SocialLinks', 'mt-5 flex gap-3 text-base-content/50', {}), 'site.social'),
              languagePill(),
            ],
          }),
          footerCol('Product', [
            { label: 'Pricing', href: '/pricing' },
            { label: 'Enterprise', href: '/enterprise' },
            { label: 'Customers', href: '/customers' },
            { label: 'Request a demo', href: '/request-demo' },
            { label: 'What’s new', href: '#' },
          ]),
          footerCol('Resources', [
            { label: 'Help center', href: '#' },
            { label: 'Blog', href: '/customers' },
            { label: 'Community', href: '#' },
            { label: 'Templates', href: '#' },
            { label: 'Partner program', href: '#' },
          ]),
          footerCol('Company', [
            { label: 'About us', href: '#' },
            { label: 'Careers', href: '#' },
            { label: 'Security', href: '/enterprise' },
            { label: 'Status', href: '#' },
            { label: 'Privacy', href: '#' },
          ]),
          footerCol('Mosaic for', [
            { label: 'Enterprise', href: '/enterprise' },
            { label: 'Small business', href: '#' },
            { label: 'Personal', href: '#' },
            { label: 'Education', href: '#' },
          ]),
        ],
      }),
      // Bottom bar: copyright + legal links, opposite a short tagline.
      el('div', 'flex w-full flex-col gap-3 border-t border-base-300 pt-7 text-xs text-base-content/50 @3xl:flex-row @3xl:items-center @3xl:justify-between', {
        children: [
          el('div', 'flex flex-wrap items-center gap-x-5 gap-y-2', {
            children: [
              el('span', '', { text: '© 2026 Mosaic. All rights reserved.' }),
              el('a', 'transition-colors hover:text-[#191918]', { text: 'Privacy', attrs: { href: '#' } }),
              el('a', 'transition-colors hover:text-[#191918]', { text: 'Terms', attrs: { href: '#' } }),
              el('a', 'transition-colors hover:text-[#191918]', { text: 'Cookie settings', attrs: { href: '#' } }),
            ],
          }),
          el('p', 'max-w-md leading-relaxed', { text: 'Built for teams and the agents that work alongside them.' }),
        ],
      }),
    ],
  });
}

export function layoutTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Site layout', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      header(),
      node('Outlet', { box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' } }),
      footer(),
    ],
  });
}
