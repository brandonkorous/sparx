// Tempo generator — the site layout tree: utility bar · sticky masthead (header row ·
// promo strip · mobile menu) · Outlet · mega footer. The Outlet is the only required
// node; everything else is author-composed chrome (CLAUDE.md "site layout is a free
// canvas"). Class strings track docs/mockups/examples/adidas.html.
//
// The header lockup uses the semantic `node({ row, collapse:false })` so it never stacks;
// the dense interior (utility links, the nav, the icon cluster, the search field, the
// mobile menu) is `el()`/`atom()`. The hamburger + the stacked mobile panel are wired by
// a single `menu` behavior (docs/98 Pillar 5) — trigger opens panel, closes on
// outside-click + Esc — so the mobile nav works without bespoke JS.

import { btn, icon } from './media';
import { footerCol } from './sections';
import { atom, behave, bound, el, node, part, type BuilderNode } from './_kit';

// Primary nav — the shopping facets land on the catalog (/shop); Club + News are real
// distinct routes. A tenant rewires these to per-category routes in the inspector.
const NAV = [
  { label: 'New & Trending', href: '/shop' },
  { label: 'Men', href: '/shop' },
  { label: 'Women', href: '/shop' },
  { label: 'Kids', href: '/shop' },
  { label: 'Club', href: '/club' },
];

const UTILITY = [
  { label: 'Store finder', href: '/help' },
  { label: 'Help', href: '/help' },
  { label: 'Orders & returns', href: '/help' },
  { label: 'Gift cards', href: '/shop' },
];

const wordmark = (): BuilderNode => bound(atom('Wordmark', 'shrink-0', {}), 'site.identity');

/** One primary-nav link — uppercase Archivo with a hover underline bar. `sale` tints it
 *  the accent red (the mockup's red "Sale"). */
const navLink = (label: string, href: string, sale = false): BuilderNode =>
  el(
    'a',
    `border-b-2 border-transparent pb-0.5 font-heading text-[13px] font-bold uppercase tracking-wide transition-colors ${sale ? 'text-accent hover:border-accent' : 'text-base-content hover:border-base-content'}`,
    { text: label, attrs: { href } }
  );

// ── Utility bar (above the sticky header, scrolls away) ──────────────────────────────

function utilityBar(): BuilderNode {
  return node('Section', {
    name: 'Utility bar',
    cls: 'hidden border-b border-base-300 md:block',
    box: { surface: 'subtle', padding: 'none', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      el('div', 'flex items-center justify-end gap-5 py-1.5 text-[11px] font-medium text-base-content/60', {
        children: [
          ...UTILITY.flatMap((u, i) => [
            ...(i > 0 ? [el('span', 'text-base-300', { text: '|' })] : []),
            el('a', 'transition-colors hover:text-base-content hover:underline', { text: u.label, attrs: { href: u.href } }),
          ]),
          el('span', 'text-base-300', { text: '|' }),
          el('a', 'font-semibold text-base-content hover:underline', { text: 'Join the Club', attrs: { href: '/club' } }),
          el('span', 'text-base-300', { text: '|' }),
          el('a', 'font-semibold text-base-content hover:underline', { text: 'Sign in', attrs: { href: '/club' } }),
        ],
      }),
    ],
  });
}

// ── Header row (logo · nav · search · account/wishlist/bag · hamburger) ───────────────

/** A header icon button (account / wishlist / bag) with an optional count badge. */
const iconButton = (name: string, label: string, count?: number): BuilderNode =>
  el('a', 'relative text-base-content transition-opacity hover:opacity-70', {
    attrs: { href: '/shop', ariaLabel: label },
    children: [
      icon(name, 'h-6 w-6'),
      ...(count
        ? [
            el('span', 'absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center bg-neutral text-[10px] font-bold text-neutral-content', {
              text: String(count),
            }),
          ]
        : []),
    ],
  });

/** The header search affordance — a soft-gray field with a leading glyph + a real input. */
const searchField = (): BuilderNode =>
  el('label', 'hidden items-center gap-2 bg-base-200 px-3 py-2 text-sm text-base-content/60 md:flex', {
    children: [
      icon('search', 'h-4 w-4'),
      el('input', 'w-28 bg-transparent text-base-content outline-none', {
        attrs: { type: 'search', placeholder: 'Search', name: 'q' },
      }),
    ],
  });

function headerRow(): BuilderNode {
  return node('Section', {
    box: { padding: 'md', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'row', justify: 'between', alignItems: 'center', collapse: false },
    children: [
      // Left: logo + primary nav.
      el('div', 'flex items-center gap-4 @4xl:gap-7', {
        children: [
          wordmark(),
          el('nav', 'hidden items-center gap-6 lg:flex', {
            name: 'Primary nav',
            children: [...NAV.map((l) => navLink(l.label, l.href)), navLink('Sale', '/shop', true)],
          }),
        ],
      }),
      // Right: search + account/wishlist/bag + hamburger trigger.
      el('div', 'flex items-center gap-3 @sm:gap-4', {
        children: [
          searchField(),
          iconButton('user', 'Account'),
          iconButton('heart', 'Wishlist', 2),
          iconButton('shopping-bag', 'Bag', 3),
          part(
            el('button', 'text-base-content transition-opacity hover:opacity-70 lg:hidden', {
              attrs: { type: 'button', ariaLabel: 'Open menu' },
              children: [icon('menu', 'h-7 w-7')],
            }),
            'trigger'
          ),
        ],
      }),
    ],
  });
}

// ── Promo strip (black-ruled, under the header) ──────────────────────────────────────

function promoStrip(): BuilderNode {
  return node('Section', {
    name: 'Promo',
    cls: 'border-y border-base-content',
    box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
    layout: { direction: 'stack', gap: 'none', alignItems: 'center' },
    children: [
      el('p', 'py-2 text-center text-[12px] font-medium tracking-wide text-base-content', {
        children: [
          el('span', '', { text: 'Season Kickoff: up to 40% off select styles. ' }),
          el('a', 'font-bold underline underline-offset-2', { text: 'Shop the event', attrs: { href: '/shop' } }),
        ],
      }),
    ],
  });
}

// ── Mobile menu panel (revealed by the hamburger trigger) ─────────────────────────────

function mobilePanel(): BuilderNode {
  const link = (label: string, href: string, sale = false): BuilderNode =>
    el(
      'a',
      `border-b border-base-300 px-5 py-3 font-heading text-base font-bold uppercase tracking-tight transition-colors hover:bg-base-200 ${sale ? 'text-accent' : 'text-base-content'}`,
      { text: label, attrs: { href } }
    );
  return part(
    el('div', 'hidden border-b border-base-300 bg-base-100 lg:hidden', {
      name: 'Mobile menu',
      attrs: { hidden: true },
      children: [
        el('nav', 'flex flex-col', {
          children: [
            ...NAV.map((l) => link(l.label, l.href)),
            link('Sale', '/shop', true),
            link('Sign in', '/club'),
          ],
        }),
      ],
    }),
    'panel'
  );
}

// ── Mega footer ────────────────────────────────────────────────────────────────────────

function footerLinkGrid(): BuilderNode {
  return el('div', 'grid w-full grid-cols-2 gap-8 @sm:grid-cols-3 @4xl:grid-cols-5', {
    children: [
      footerCol('Products', [
        { label: 'Shoes', href: '/shop' },
        { label: 'Clothing', href: '/shop' },
        { label: 'Accessories', href: '/shop' },
        { label: 'New Arrivals', href: '/shop' },
        { label: 'Best Sellers', href: '/shop' },
      ]),
      footerCol('Sports', [
        { label: 'Soccer', href: '/shop' },
        { label: 'Running', href: '/shop' },
        { label: 'Training', href: '/shop' },
        { label: 'Outdoor', href: '/shop' },
        { label: 'Lifestyle', href: '/shop' },
      ]),
      footerCol('Collections', [
        { label: 'Originals', href: '/shop' },
        { label: 'Glide', href: '/shop' },
        { label: 'Vega', href: '/shop' },
        { label: 'Strike', href: '/shop' },
        { label: 'Field', href: '/shop' },
      ]),
      footerCol('Support', [
        { label: 'Help', href: '/help' },
        { label: 'Returns & Exchanges', href: '/help' },
        { label: 'Shipping', href: '/help' },
        { label: 'Order Tracker', href: '/help' },
        { label: 'Size Charts', href: '/help' },
      ]),
      footerCol('Company', [
        { label: 'Our Story', href: '/story' },
        { label: 'The Club', href: '/club' },
        { label: 'News', href: '/news' },
        { label: 'Careers', href: '/help' },
        { label: 'Sustainability', href: '/story' },
      ]),
    ],
  });
}

function footerNewsletter(): BuilderNode {
  return el('div', 'flex flex-col gap-8 border-t border-base-100/10 pt-10 @4xl:flex-row @4xl:items-end @4xl:justify-between', {
    children: [
      el('div', 'max-w-md', {
        children: [
          el('h3', 'font-heading text-lg font-black uppercase tracking-tightest text-base-100', { text: 'Join our newsletter' }),
          el('p', 'mt-1 text-sm text-base-100/60', { text: 'The latest drops, offers and member rewards — straight to your inbox.' }),
          atom('Signup', 'mt-4', { cta: 'Subscribe' }),
        ],
      }),
      bound(atom('SocialLinks', 'flex items-center gap-3 text-base-100/80', {}), 'site.social'),
    ],
  });
}

function footerBottom(): BuilderNode {
  return el('div', 'flex flex-col gap-6 border-t border-base-100/10 pt-8 @3xl:flex-row @3xl:items-center @3xl:justify-between', {
    children: [
      bound(atom('Wordmark', 'text-base-100', {}), 'site.identity'),
      el('button', 'inline-flex w-fit items-center gap-2 border border-base-100/30 px-4 py-2.5 text-sm text-base-100/80 transition-colors hover:bg-base-100/10', {
        attrs: { type: 'button' },
        children: [icon('globe', 'h-4 w-4'), el('span', 'font-medium', { text: 'United States' }), icon('chevron-down', 'h-4 w-4')],
      }),
    ],
  });
}

function footerLegal(): BuilderNode {
  return el('div', 'flex flex-col gap-4 border-t border-base-100/10 pt-6 text-xs text-base-100/45 @3xl:flex-row @3xl:items-center @3xl:justify-between', {
    children: [
      el('div', 'flex flex-wrap gap-x-5 gap-y-2', {
        children: [
          el('a', 'transition-colors hover:text-base-100/80 hover:underline', { text: 'Privacy Policy', attrs: { href: '/help' } }),
          el('a', 'transition-colors hover:text-base-100/80 hover:underline', { text: 'Terms & Conditions', attrs: { href: '/help' } }),
          el('a', 'transition-colors hover:text-base-100/80 hover:underline', { text: 'Cookie Settings', attrs: { href: '/help' } }),
          el('a', 'transition-colors hover:text-base-100/80 hover:underline', { text: 'Accessibility', attrs: { href: '/help' } }),
        ],
      }),
      el('p', '', { text: '© 2026 Tempo. All rights reserved.' }),
    ],
  });
}

function footer(): BuilderNode {
  return node('Section', {
    box: { name: 'Footer', surface: 'inverse', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'lg', alignItems: 'start' },
    children: [footerLinkGrid(), footerNewsletter(), footerBottom(), footerLegal()],
  });
}

// ── Assembled layout ────────────────────────────────────────────────────────────────────

export function layoutTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Site layout', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      utilityBar(),
      // The sticky masthead wraps the header row + promo + mobile panel in one `menu`
      // behavior so the hamburger toggles the stacked nav.
      behave(
        node('Section', {
          name: 'Masthead',
          cls: 'sticky top-0 z-30 bg-base-100',
          box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
          layout: { direction: 'stack', gap: 'none' },
          children: [headerRow(), promoStrip(), mobilePanel()],
        }),
        { type: 'menu' }
      ),
      node('Outlet', { box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' } }),
      footer(),
    ],
  });
}
