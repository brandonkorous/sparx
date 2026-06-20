// Forge generator — the site layout tree: sticky header · Outlet · footer. The Outlet is
// the only required node; everything else is author-composed chrome (CLAUDE.md "site
// layout is a free canvas"). The header mirrors the proven app-bar pattern: a full-bleed
// band wrapping a contained brand · nav · CTA row that stays inline (`collapse:false`).
// The mockup's header is `position: fixed` with a scroll-blur; `fixed` is denylisted by
// the class allowlist (clickjacking guard), so we use the equivalent `sticky` solid bar.
// Class strings track docs/mockups/examples/500designs.html.

import { btn, footerCol } from './media';
import { atom, bound, el, node, type BuilderNode } from './_kit';

// Nav links resolve to real routes this blueprint builds (no dead anchors).
const NAV = [
  { label: 'Work', href: '/work' },
  { label: 'Services', href: '/services' },
  { label: 'About', href: '/about' },
  { label: 'Insights', href: '/insights' },
  { label: 'Careers', href: '/careers' },
];

const SOCIAL = {
  instagram: 'https://instagram.com/forge.studio',
  dribbble: 'https://dribbble.com/forgestudio',
  linkedin: 'https://linkedin.com/company/forgestudio',
};

const wordmark = (cls = ''): BuilderNode => bound(atom('Wordmark', cls, {}), 'site.identity');

function header(): BuilderNode {
  return node('Section', {
    name: 'Header',
    cls: 'sticky top-0 z-30 border-b border-white/10 bg-[#1A1611]/85 backdrop-blur',
    box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: { padding: 'md', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'row', justify: 'between', alignItems: 'center', collapse: false },
        children: [
          // Left: brand + primary nav.
          el('div', 'flex items-center gap-4 @3xl:gap-9', {
            children: [wordmark(), atom('NavMenu', 'text-sm', { orientation: 'row', links: NAV })],
          }),
          // Right: the cream "Let's talk" pill CTA.
          el('div', 'flex items-center gap-2', {
            children: [btn("Let’s talk", '/contact', { variant: 'cream', size: 'sm' })],
          }),
        ],
      }),
    ],
  });
}

function footer(): BuilderNode {
  return node('Section', {
    cls: 'border-t border-white/10 bg-[#0B0A07]',
    box: { name: 'Footer', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'lg', alignItems: 'start' },
    children: [
      // Column grid: brand block + three link columns.
      el('div', 'grid w-full grid-cols-2 gap-10 @3xl:grid-cols-[1.5fr_1fr_1fr_1fr]', {
        children: [
          el('div', 'col-span-2 flex flex-col @3xl:col-span-1', {
            children: [
              wordmark(),
              el('p', 'mt-5 max-w-xs text-sm leading-relaxed text-base-content/60', {
                text: 'Transformative brands & digital experiences, engineered for growth.',
              }),
              el('p', 'mt-6 font-heading text-xl font-semibold text-[#ECE7DD]', { text: 'Let’s work together.' }),
              el('a', 'mt-2 inline-block text-sm text-base-content underline-offset-4 transition-colors hover:text-[#ECE7DD] hover:underline', {
                text: 'hello@forge.studio',
                attrs: { href: 'mailto:hello@forge.studio' },
              }),
              bound(atom('SocialLinks', 'mt-6 flex gap-3 text-base-content/50', {}), 'site.social'),
            ],
          }),
          footerCol('Studio', [
            { label: 'Work', href: '/work' },
            { label: 'Services', href: '/services' },
            { label: 'About', href: '/about' },
            { label: 'Insights', href: '/insights' },
            { label: 'Careers', href: '/careers' },
          ]),
          footerCol('Services', [
            { label: 'Brand & Identity', href: '/services' },
            { label: 'Web Design & Dev', href: '/services' },
            { label: 'Growth Marketing', href: '/services' },
            { label: 'Motion & 3D', href: '/services' },
          ]),
          footerCol('Connect', [
            { label: 'Instagram', href: SOCIAL.instagram },
            { label: 'Dribbble', href: SOCIAL.dribbble },
            { label: 'LinkedIn', href: SOCIAL.linkedin },
            { label: 'Start a project', href: '/contact' },
          ]),
        ],
      }),
      // Bottom bar: copyright + legal links, opposite a short tagline.
      el('div', 'flex w-full flex-col gap-3 border-t border-white/10 pt-7 text-xs text-base-content/50 @3xl:flex-row @3xl:items-center @3xl:justify-between', {
        children: [
          el('div', 'flex flex-wrap items-center gap-x-5 gap-y-2', {
            children: [
              el('span', '', { text: '© 2026 Forge. All rights reserved.' }),
              el('a', 'transition-colors hover:text-[#ECE7DD]', { text: 'Privacy', attrs: { href: '#' } }),
              el('a', 'transition-colors hover:text-[#ECE7DD]', { text: 'Terms', attrs: { href: '#' } }),
              el('a', 'transition-colors hover:text-[#ECE7DD]', { text: 'Cookies', attrs: { href: '#' } }),
            ],
          }),
          el('p', 'max-w-md leading-relaxed', { text: 'Based in your city · Working with teams worldwide.' }),
        ],
      }),
    ],
  });
}

export function layoutTree(): BuilderNode {
  return node('Section', {
    // Paint the whole site canvas (the storefront <body> defaults to a light fill, so a
    // dark blueprint must paint base-100 itself — every `surface:'none'` section is
    // transparent and sits on this). `text-base-content` makes inherited text sand.
    cls: 'bg-base-100 text-base-content',
    box: { name: 'Site layout', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      header(),
      node('Outlet', { box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' } }),
      footer(),
    ],
  });
}
