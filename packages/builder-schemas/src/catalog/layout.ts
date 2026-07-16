// Catalog · Layout (docs/98 §5). Heroes, footers, sections, grids, wrappers.
//
// The structural backbone of a page: bands, columns, and wrappers that other
// components drop into. Where the navigation family proved a "header" is just
// flex zones, the layout family proves the same of a "hero" or a "two-column
// page" — a raw <section> with container-query columns that collapse to a single
// stack on narrow canvases (we key off the node's OWN width with @2xl/@3xl/@4xl,
// never viewport breakpoints). Every band is a single selectable root, padded
// from the page edge with the shared `max-w-site` rail so content lines up across
// sections regardless of which component fills it.

import { el, atom, bound, entry, type PlatformCatalogEntry } from './_kit';

// A footer link — a muted column entry that warms to brand on hover.
const footerLink = (label: string, href: string) =>
  el('a', 'text-sm text-base-content transition-colors hover:text-primary', {
    text: label,
    attrs: { href },
  });

// A heading + stacked links forming one footer column.
const footerColumn = (heading: string, links: [string, string][]) =>
  el('div', 'flex flex-col gap-3', {
    children: [
      el('h3', 'text-sm font-semibold text-base-content', { text: heading }),
      el('ul', 'flex flex-col gap-2', {
        children: links.map(([label, href]) =>
          el('li', '', { children: [footerLink(label, href)] })
        ),
      }),
    ],
  });

// A placeholder content card — image band over a title + line of meta.
const placeholderCard = (title: string, meta: string) =>
  el('div', 'overflow-hidden rounded-box border border-base-200 bg-base-100 shadow-sm', {
    children: [
      atom('Image', 'w-full', { ratio: 'wide', alt: title }),
      el('div', 'flex flex-col gap-1 p-4', {
        children: [
          el('h3', 'text-sm font-semibold text-base-content', { text: title }),
          el('p', 'text-sm text-base-content', { text: meta }),
        ],
      }),
    ],
  });

export const LAYOUT_CATALOG: PlatformCatalogEntry[] = [
  // ── Hero (centered) — full-width band, centered headline + actions ────────────
  entry({
    key: 'hero_centered',
    name: 'Hero — centered',
    category: 'layout',
    kind: 'common',
    icon: 'layout-template',
    description:
      'A full-width opening band with a centered headline, supporting line, and a primary plus ghost action. Generous vertical padding.',
    surfaces: ['page', 'site'],
    tags: ['hero', 'banner', 'centered', 'cta', 'landing', 'layout'],
    tree: el('section', 'w-full bg-base-100 px-6 py-20 @3xl:py-28', {
      children: [
        el('div', 'mx-auto flex max-w-2xl flex-col items-center gap-6 text-center', {
          children: [
            atom('Heading', 'text-4xl font-bold tracking-tight text-base-content @3xl:text-5xl', {
              level: 'h1',
              text: 'Build a storefront your customers remember',
            }),
            atom('Text', 'max-w-xl text-lg text-base-content', {
              variant: 'body',
              text: 'Launch a polished, on-brand site in minutes — no code, no compromises. Everything you publish stays fast, accessible, and yours.',
            }),
            el('div', 'flex flex-wrap items-center justify-center gap-3 pt-2', {
              children: [
                atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-lg', {
                  label: 'Get started free',
                }),
                atom('Button', 'st-btn st-c-neutral st-v-ghost st-btn--sz-lg', {
                  label: 'See how it works',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Hero (split) — copy beside an image, stacks on narrow ─────────────────────
  entry({
    key: 'hero_split',
    name: 'Hero — split',
    category: 'layout',
    kind: 'common',
    icon: 'columns-2',
    description:
      'A two-column opening band: headline, supporting copy, and actions beside a wide image. Stacks to one column on narrow containers.',
    surfaces: ['page', 'site'],
    tags: ['hero', 'split', 'two column', 'image', 'cta', 'landing', 'layout'],
    tree: el('section', 'w-full bg-base-100 px-6 py-16 @3xl:py-24', {
      children: [
        el('div', 'mx-auto grid max-w-site grid-cols-1 items-center gap-10 @3xl:grid-cols-2', {
          children: [
            // Copy column
            el('div', 'flex flex-col gap-6', {
              children: [
                atom(
                  'Heading',
                  'text-4xl font-bold tracking-tight text-base-content @3xl:text-5xl',
                  {
                    level: 'h1',
                    text: 'Everything you sell, under one roof',
                  }
                ),
                atom('Text', 'text-lg text-base-content', {
                  variant: 'body',
                  text: 'Catalog, checkout, and customers in a single workspace. Spin up a new collection, price it, and ship it the same afternoon.',
                }),
                el('div', 'flex flex-wrap items-center gap-3 pt-2', {
                  children: [
                    atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-lg', {
                      label: 'Start selling',
                    }),
                    atom('Button', 'st-btn st-c-neutral st-v-outline st-btn--sz-lg', {
                      label: 'Browse the demo',
                    }),
                  ],
                }),
              ],
            }),
            // Image column
            el('div', 'overflow-hidden rounded-box shadow-lg', {
              children: [atom('Image', 'w-full', { ratio: 'wide', alt: 'Product showcase' })],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Footer (columns) — brand blurb + link columns + copyright row ─────────────
  entry({
    key: 'footer_columns',
    name: 'Footer — columns',
    category: 'layout',
    kind: 'common',
    icon: 'panel-bottom',
    description:
      'A rich footer: a brand blurb beside three link columns, over a bottom copyright row. Columns collapse to a stack on narrow containers.',
    surfaces: ['page', 'site'],
    tags: ['footer', 'columns', 'links', 'sitemap', 'copyright', 'layout'],
    tree: el('footer', 'w-full border-t border-base-200 bg-base-100 px-6 py-12', {
      children: [
        el('div', 'mx-auto max-w-site', {
          children: [
            el('div', 'grid grid-cols-1 gap-10 @2xl:grid-cols-2 @4xl:grid-cols-4', {
              children: [
                // Brand blurb
                el('div', 'flex flex-col gap-4', {
                  children: [
                    bound(atom('Wordmark', '', { collapse: 'full' }), 'site.identity'),
                    el('p', 'max-w-xs text-sm text-base-content', {
                      text: 'The modular platform for content and commerce. Build once, publish everywhere, and grow on your terms.',
                    }),
                  ],
                }),
                footerColumn('Product', [
                  ['Features', '/features'],
                  ['Pricing', '/pricing'],
                  ['Integrations', '/integrations'],
                  ['Changelog', '/changelog'],
                ]),
                footerColumn('Company', [
                  ['About', '/about'],
                  ['Careers', '/careers'],
                  ['Blog', '/blog'],
                  ['Contact', '/contact'],
                ]),
                footerColumn('Resources', [
                  ['Documentation', '/docs'],
                  ['Help center', '/help'],
                  ['Status', '/status'],
                  ['Privacy', '/privacy-policy'],
                ]),
              ],
            }),
            // Bottom copyright row
            el(
              'div',
              'mt-10 flex flex-col items-center justify-between gap-3 border-t border-base-200 pt-6 text-sm text-base-content @2xl:flex-row',
              {
                children: [
                  el('p', '', { text: '© 2026 Your Company. All rights reserved.' }),
                  el('div', 'flex items-center gap-5', {
                    children: [
                      footerLink('Terms', '/terms-of-service'),
                      footerLink('Privacy', '/privacy-policy'),
                      footerLink('Cookies', '/cookie-policy'),
                    ],
                  }),
                ],
              }
            ),
          ],
        }),
      ],
    }),
  }),

  // ── Footer (simple) — slim copyright + links row ──────────────────────────────
  entry({
    key: 'footer_simple',
    name: 'Footer — simple',
    category: 'layout',
    kind: 'common',
    icon: 'minus',
    description:
      'A slim footer row: copyright on the left, a few links on the right. Collapses to a centered stack on narrow containers.',
    surfaces: ['page', 'site'],
    tags: ['footer', 'simple', 'slim', 'copyright', 'links', 'layout'],
    tree: el('footer', 'w-full border-t border-base-200 bg-base-100 px-6 py-6', {
      children: [
        el(
          'div',
          'mx-auto flex max-w-site flex-col items-center justify-between gap-4 text-sm text-base-content @2xl:flex-row',
          {
            children: [
              el('p', '', { text: '© 2026 Your Company' }),
              el('nav', 'flex items-center gap-5', {
                attrs: { ariaLabel: 'Footer' },
                children: [
                  footerLink('About', '/about'),
                  footerLink('Privacy', '/privacy-policy'),
                  footerLink('Terms', '/terms-of-service'),
                  footerLink('Contact', '/contact'),
                ],
              }),
            ],
          }
        ),
      ],
    }),
  }),

  // ── Divider with label — two rules flanking centered text ─────────────────────
  entry({
    key: 'divider_label',
    name: 'Divider — labelled',
    category: 'layout',
    kind: 'common',
    icon: 'separator-horizontal',
    description:
      'A horizontal rule split by a centered label — two flex border lines with a word like "OR" between them.',
    surfaces: ['page', 'site'],
    tags: ['divider', 'separator', 'rule', 'or', 'label', 'layout'],
    tree: el('div', 'flex w-full items-center gap-4', {
      children: [
        el('span', 'h-px flex-1 bg-base-300', {}),
        el('span', 'shrink-0 text-xs font-medium uppercase tracking-wide text-base-content', {
          text: 'OR',
        }),
        el('span', 'h-px flex-1 bg-base-300', {}),
      ],
    }),
  }),

  // ── Container section — the max-w-site rail + heading + slot ───────────────────
  entry({
    key: 'container_section',
    name: 'Container section',
    category: 'layout',
    kind: 'common',
    icon: 'square-dashed',
    description:
      'A centered section wrapper on the shared content rail — a heading over a body slot. The primitive other components drop into.',
    surfaces: ['page', 'site'],
    tags: ['section', 'container', 'wrapper', 'rail', 'primitive', 'layout'],
    tree: el('section', 'w-full px-6 py-16', {
      children: [
        el('div', 'mx-auto flex max-w-site flex-col gap-6', {
          children: [
            atom('Heading', 'text-3xl font-bold tracking-tight text-base-content', {
              level: 'h2',
              text: 'Section heading',
            }),
            atom('Text', 'max-w-2xl text-base text-base-content', {
              variant: 'body',
              text: 'Drop any components into this section. The shared content rail keeps everything aligned with the rest of the page as it grows.',
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Two-column with sidebar — main content + narrower aside ────────────────────
  entry({
    key: 'two_column_sidebar',
    name: 'Two column — sidebar',
    category: 'layout',
    kind: 'common',
    icon: 'panel-right',
    description:
      'A wide main content area beside a narrower aside sidebar. The aside drops below the content on narrow containers.',
    surfaces: ['page', 'site'],
    tags: ['sidebar', 'two column', 'aside', 'layout', 'docs', 'content'],
    tree: el('section', 'w-full px-6 py-12', {
      children: [
        el('div', 'mx-auto grid max-w-site grid-cols-1 gap-8 @3xl:grid-cols-[1fr_18rem]', {
          children: [
            // Main content
            el('main', 'flex flex-col gap-4', {
              children: [
                atom('Heading', 'text-2xl font-bold tracking-tight text-base-content', {
                  level: 'h2',
                  text: 'Getting started',
                }),
                atom('Text', 'text-base text-base-content', {
                  variant: 'body',
                  text: 'The main column carries the primary reading content — articles, documentation, or a product description — while the sidebar holds secondary context.',
                }),
                atom('Text', 'text-base text-base-content', {
                  variant: 'body',
                  text: 'On a narrow canvas the aside drops beneath this column so the reading width never gets squeezed.',
                }),
              ],
            }),
            // Sidebar
            el(
              'aside',
              'flex flex-col gap-3 rounded-box border border-base-200 bg-base-200/40 p-5',
              {
                children: [
                  el('h3', 'text-sm font-semibold text-base-content', { text: 'On this page' }),
                  el('ul', 'flex flex-col gap-2', {
                    children: [
                      el('li', '', {
                        children: [footerLink('Overview', '#overview')],
                      }),
                      el('li', '', {
                        children: [footerLink('Installation', '#installation')],
                      }),
                      el('li', '', {
                        children: [footerLink('Configuration', '#configuration')],
                      }),
                    ],
                  }),
                ],
              }
            ),
          ],
        }),
      ],
    }),
  }),

  // ── Grid (three) — responsive 3-up of placeholder panels ──────────────────────
  entry({
    key: 'grid_three',
    name: 'Grid — three column',
    category: 'layout',
    kind: 'common',
    icon: 'layout-grid',
    description:
      'A responsive three-column grid of panels — one column on narrow, two at medium, three when wide.',
    surfaces: ['page', 'site'],
    tags: ['grid', 'three column', 'columns', 'features', 'layout'],
    tree: el('section', 'w-full px-6 py-12', {
      children: [
        el('div', 'mx-auto grid max-w-site grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-3', {
          children: [
            el(
              'div',
              'flex flex-col gap-3 rounded-box border border-base-200 bg-base-100 p-6 shadow-sm',
              {
                children: [
                  el(
                    'span',
                    'flex h-10 w-10 items-center justify-center rounded-field bg-primary/10 text-primary',
                    { children: [atom('Icon', 'h-5 w-5', { name: 'zap' })] }
                  ),
                  el('h3', 'text-base font-semibold text-base-content', {
                    text: 'Fast by default',
                  }),
                  el('p', 'text-sm text-base-content', {
                    text: 'Every page ships optimized — images, fonts, and scripts tuned without you lifting a finger.',
                  }),
                ],
              }
            ),
            el(
              'div',
              'flex flex-col gap-3 rounded-box border border-base-200 bg-base-100 p-6 shadow-sm',
              {
                children: [
                  el(
                    'span',
                    'flex h-10 w-10 items-center justify-center rounded-field bg-primary/10 text-primary',
                    { children: [atom('Icon', 'h-5 w-5', { name: 'shield-check' })] }
                  ),
                  el('h3', 'text-base font-semibold text-base-content', {
                    text: 'Secure foundation',
                  }),
                  el('p', 'text-sm text-base-content', {
                    text: 'Tenant isolation, encrypted data, and audited access come standard on every plan.',
                  }),
                ],
              }
            ),
            el(
              'div',
              'flex flex-col gap-3 rounded-box border border-base-200 bg-base-100 p-6 shadow-sm',
              {
                children: [
                  el(
                    'span',
                    'flex h-10 w-10 items-center justify-center rounded-field bg-primary/10 text-primary',
                    { children: [atom('Icon', 'h-5 w-5', { name: 'puzzle' })] }
                  ),
                  el('h3', 'text-base font-semibold text-base-content', {
                    text: 'Modular by design',
                  }),
                  el('p', 'text-sm text-base-content', {
                    text: 'Turn on storefront, CRM, or email independently — you only pay for what you switch on.',
                  }),
                ],
              }
            ),
          ],
        }),
      ],
    }),
  }),

  // ── Card grid — six image+title cards, responsive ─────────────────────────────
  entry({
    key: 'card_grid',
    name: 'Card grid',
    category: 'layout',
    kind: 'common',
    icon: 'layout-dashboard',
    description:
      'A responsive grid of image-over-title cards for a collection, gallery, or catalog — two up at medium, three when wide.',
    surfaces: ['page', 'site'],
    tags: ['cards', 'grid', 'gallery', 'collection', 'catalog', 'layout'],
    tree: el('section', 'w-full px-6 py-12', {
      children: [
        el('div', 'mx-auto grid max-w-site grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-3', {
          children: [
            placeholderCard('Trail Runner Jacket', 'Outerwear · $148'),
            placeholderCard('Field Notebook Set', 'Stationery · $24'),
            placeholderCard('Ceramic Pour-Over', 'Kitchen · $62'),
            placeholderCard('Merino Crew Socks', 'Apparel · $18'),
            placeholderCard('Canvas Weekender', 'Bags · $210'),
            placeholderCard('Brass Desk Lamp', 'Lighting · $96'),
          ],
        }),
      ],
    }),
  }),

  // ── Indicator badge — a box with a badge pinned to its corner ─────────────────
  entry({
    key: 'indicator_badge',
    name: 'Indicator badge',
    category: 'layout',
    kind: 'common',
    icon: 'bell-dot',
    description:
      'A container with a small count badge pinned to its top-right corner — relative box, absolute indicator. The cart / inbox pattern.',
    surfaces: ['page', 'site'],
    tags: ['indicator', 'badge', 'notification', 'count', 'corner', 'layout'],
    // The real Indicator atom (st-indicator) pins the count badge to the corner of
    // its content. (Was a hand-rolled relative box + absolute span.)
    tree: atom('Indicator', 'inline-flex', { label: '3', placement: 'top-end' }, [
      el(
        'button',
        'flex h-11 w-11 items-center justify-center rounded-field border border-base-200 text-base-content transition-colors hover:bg-base-200',
        {
          attrs: { type: 'button', ariaLabel: 'Notifications' },
          children: [atom('Icon', 'h-5 w-5', { name: 'bell' })],
        }
      ),
    ]),
  }),

  // ── Join group — input + button sharing a seam ────────────────────────────────
  entry({
    key: 'join_group',
    name: 'Join group',
    category: 'layout',
    kind: 'common',
    icon: 'link',
    description:
      'Horizontally joined items that share their seams — here an email input joined to a subscribe button reading as one control.',
    surfaces: ['page', 'site'],
    tags: ['join', 'group', 'input group', 'subscribe', 'attached', 'layout'],
    // The real Join atom (st-join) collapses the inner seam between an Input and a
    // Button so they read as one control. (Was hand-rolled rounded-l/r + -ml-px.)
    tree: atom('Join', 'w-full max-w-md', { orientation: 'horizontal' }, [
      atom('Input', 'st-c-primary st-fv-outline grow', {
        type: 'email',
        name: 'email',
        placeholder: 'you@example.com',
      }),
      atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-md', { label: 'Subscribe' }),
    ]),
  }),

  // ── Sticky section header — bar that pins above scrolling content ─────────────
  entry({
    key: 'sticky_section_header',
    name: 'Sticky section header',
    category: 'layout',
    kind: 'common',
    icon: 'arrow-up-to-line',
    description:
      'A section header bar that sticks to the top of its scroll container — a title and action that stay in view as content moves under them.',
    surfaces: ['page', 'site'],
    tags: ['sticky', 'header', 'section', 'pinned', 'toolbar', 'layout'],
    tree: el('section', 'w-full', {
      children: [
        // Pinned bar
        el(
          'div',
          'sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-base-200 bg-base-100/90 px-6 py-4',
          {
            children: [
              atom('Heading', 'text-lg font-semibold text-base-content', {
                level: 'h2',
                text: 'Recent orders',
              }),
              atom('Button', 'st-btn st-c-primary st-v-soft st-btn--sz-sm', { label: 'Export' }),
            ],
          }
        ),
        // Scrolling content under the bar
        el('div', 'flex flex-col gap-3 px-6 py-6', {
          children: [
            el('p', 'text-sm text-base-content', {
              text: 'As this content scrolls, the header above stays pinned to the top of the surrounding scroll container.',
            }),
            el('p', 'text-sm text-base-content', {
              text: 'Pair it with a long list, a table, or a settings form so the section title and its primary action are always reachable.',
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Coming soon — a full-bleed launch page with email capture ─────────────────
  entry({
    key: 'coming_soon',
    name: 'Coming soon',
    category: 'layout',
    kind: 'comprehensive',
    icon: 'rocket',
    description:
      'A centered launch (or maintenance) page — a headline, a line of reassurance, and an email-capture row so visitors can be notified when you go live.',
    surfaces: ['page', 'site'],
    tags: ['coming soon', 'launch', 'maintenance', 'waitlist', 'placeholder', 'layout'],
    tree: el(
      'section',
      'flex w-full flex-col items-center justify-center gap-6 px-4 py-32 text-center',
      {
        name: 'Coming soon',
        children: [
          atom('Badge', 'st-c-primary st-v-soft', { label: 'Launching soon' }),
          atom(
            'Heading',
            'max-w-2xl text-4xl font-bold tracking-tight text-base-content @2xl:text-6xl',
            { level: 'h1', text: 'Something good is on the way' }
          ),
          atom('Text', 'max-w-xl text-lg text-base-content', {
            variant: 'body',
            text: 'We are putting the finishing touches on it. Leave your email and we will tell you the moment it goes live.',
          }),
          el('form', 'mt-4 flex w-full max-w-md flex-col gap-3 @md:flex-row', {
            name: 'Notify form',
            children: [
              atom('Input', 'st-c-primary st-fv-outline w-full', {
                type: 'email',
                name: 'email',
                placeholder: 'you@example.com',
              }),
              atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-md shrink-0', {
                label: 'Notify me',
              }),
            ],
          }),
        ],
      }
    ),
  }),

  // ── 404 — a friendly not-found page ───────────────────────────────────────────
  entry({
    key: 'error_404',
    name: '404 page',
    category: 'layout',
    kind: 'common',
    icon: 'circle-help',
    description:
      'A centered not-found page — a big 404, a friendly explanation, and a button back to the home page.',
    surfaces: ['page', 'site'],
    tags: ['404', 'not found', 'error', 'missing', 'layout'],
    tree: el(
      'section',
      'flex w-full flex-col items-center justify-center gap-4 px-4 py-32 text-center',
      {
        name: '404',
        children: [
          el('p', 'text-6xl font-bold tracking-tight text-primary @2xl:text-8xl', { text: '404' }),
          atom('Heading', 'text-2xl font-bold text-base-content', {
            level: 'h1',
            text: 'This page wandered off',
          }),
          atom('Text', 'max-w-md text-base text-base-content', {
            variant: 'body',
            text: 'The link may be broken, or the page may have moved. Let us get you back on track.',
          }),
          el('a', 'st-btn st-c-primary st-v-solid st-btn--sz-md mt-2', {
            text: 'Back to home',
            attrs: { href: '/' },
          }),
        ],
      }
    ),
  }),
];
