// Catalog · Interactive composites (docs/98 Pillar 6). The behavior-bearing
// comprehensive components — the ones a class string alone can't express.
//
// Everything else in the catalog is presentational (CSS-only): the earlier files
// build carousels from scroll-snap, accordions from <details>, tabs from a static
// underline — because they predate the behavior runtime. THIS file is what that
// runtime (Pillar 5, @sparx/builder-render behaviors) unlocks: real autoplay
// carousels, a continuously-scrolling marquee, a scroll-adaptive nav, a click-open
// mega-menu, a single-open FAQ accordion, JS-wired tabs, plus a side drawer and an
// anchored popover (both the same `menu` trigger→panel disclosure).
//
// The interactivity is authored, never coded: a node is marked a behavior ROOT with
// `behave(node, { type, ...params })` and its moving parts with `part(node, role)`.
// The render walkers lower those to the controlled `data-sx-*` attributes the
// runtime reads (no tenant JS, no raw `data-*`). The SAME markup runs in the canvas
// (preview mode — autoplay suppressed, panels revealed for editing) and on the live
// storefront (full behavior). Closed panels ship with `hidden` so they don't flash
// open before hydration.
//
// These declare their own `category` (marketing / navigation / data-display), so the
// Add palette files them beside the static blocks of the same family — this file is
// an authoring grouping, not a palette section.

import { atom, behave, bound, el, entry, part, type PlatformCatalogEntry } from './_kit';

// ── Shared parts ───────────────────────────────────────────────────────────────

// One slide of the hero carousel — a full-bleed colored panel with a centered
// pitch. `part(_, 'slide')` so the carousel behavior counts + tracks it.
const heroSlide = (
  tone: string,
  heading: string,
  body: string,
  cta: string
): PlatformCatalogEntry['tree'] =>
  part(
    el('div', `relative w-full shrink-0 px-8 py-24 @3xl:py-32 ${tone}`, {
      children: [
        el('div', 'mx-auto flex max-w-2xl flex-col items-center gap-5 text-center', {
          children: [
            atom('Heading', 'text-4xl font-bold tracking-tight @3xl:text-5xl', {
              level: 'h2',
              text: heading,
            }),
            el('p', 'text-lg opacity-90', { text: body }),
            atom('Button', 'st-btn st-c-neutral st-v-solid st-btn--sz-lg', { label: cta }),
          ],
        }),
      ],
    }),
    'slide'
  );

// A carousel pagination dot — the behavior sets `data-active` on the current one,
// which the `data-[active=true]:` utilities widen + brighten.
const carouselDot = (n: number): PlatformCatalogEntry['tree'] =>
  part(
    el(
      'button',
      'h-2.5 w-2.5 rounded-full bg-base-100/50 transition-all duration-300 data-[active=true]:w-6 data-[active=true]:bg-base-100',
      { attrs: { type: 'button', ariaLabel: `Go to slide ${n}` } }
    ),
    'dot'
  );

// A previous/next arrow button overlaid on a slider.
const carouselArrow = (side: 'left' | 'right', glyph: string, label: string) =>
  part(
    el(
      'button',
      `absolute ${side}-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-base-100/80 text-xl leading-none text-base-content shadow-md backdrop-blur transition hover:bg-base-100`,
      { attrs: { type: 'button', ariaLabel: label }, text: glyph }
    ),
    side === 'left' ? 'prev' : 'next'
  );

// A muted placeholder mark for the logo marquee (real logos drop in by editing).
const marqueeLogo = (label: string) =>
  el(
    'div',
    'flex h-10 w-32 shrink-0 items-center justify-center rounded-field bg-base-200 text-sm font-semibold tracking-tight text-base-content',
    { text: label }
  );

// A five-star rating row — the real Rating atom (st-rating), read-only display.
const starRow = () => atom('Rating', 'st-c-warning', { value: '5', count: '5' });

// One testimonial slide — quote + attribution. `part(_, 'slide')`.
const testimonialSlide = (quote: string, name: string, role: string) =>
  part(
    el('figure', 'w-full shrink-0 px-2', {
      children: [
        el(
          'blockquote',
          'flex flex-col items-center gap-6 rounded-box border border-base-200 bg-base-100 px-6 py-10 text-center',
          {
            children: [
              starRow(),
              el('p', 'text-xl font-medium text-base-content @3xl:text-2xl', {
                text: `“${quote}”`,
              }),
              el('figcaption', 'flex flex-col gap-0.5', {
                children: [
                  el('span', 'text-sm font-semibold text-base-content', { text: name }),
                  el('span', 'text-sm text-base-content', { text: role }),
                ],
              }),
            ],
          }
        ),
      ],
    }),
    'slide'
  );

// A scroll-adaptive nav section link — highlighted while its `#section` is in view
// (the scrollspy behavior sets `data-active` keyed off the `href`).
const spyLink = (label: string, href: string) =>
  el(
    'a',
    'text-sm font-medium text-base-content transition-colors hover:text-base-content data-[active=true]:font-semibold data-[active=true]:text-primary',
    { text: label, attrs: { href } }
  );

// One column of the mega-menu panel — a small heading over a stack of links.
const megaColumn = (title: string, links: [string, string][]) =>
  el('div', 'flex w-44 flex-col gap-2', {
    children: [
      el('span', 'px-2 text-xs font-semibold tracking-wide text-base-content', { text: title }),
      el('ul', 'flex flex-col gap-0.5', {
        children: links.map(([label, href]) =>
          el('li', '', {
            children: [
              el(
                'a',
                'block rounded-field px-2 py-1.5 text-sm text-base-content hover:bg-base-200',
                {
                  text: label,
                  attrs: { href },
                }
              ),
            ],
          })
        ),
      }),
    ],
  });

// One FAQ row — a trigger button paired with a panel that ships closed (`hidden`).
// `part(item, 'item')`; the disclosure behavior toggles the pair, `single` keeping
// at most one open. `group` lets the chevron flip with the item's `data-open`.
const faqItem = (question: string, answer: string) =>
  part(
    el('div', 'group', {
      children: [
        part(
          el(
            'button',
            'flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-medium text-base-content transition-colors hover:bg-base-200/50',
            {
              attrs: { type: 'button' },
              children: [
                el('span', '', { text: question }),
                atom(
                  'Icon',
                  'h-5 w-5 shrink-0 text-base-content transition-transform duration-200 group-data-[open=true]:rotate-180',
                  { name: 'chevron-down' }
                ),
              ],
            }
          ),
          'trigger'
        ),
        part(
          el('div', 'px-5 pb-5 text-sm leading-relaxed text-base-content', {
            attrs: { hidden: true },
            children: [el('p', '', { text: answer })],
          }),
          'panel'
        ),
      ],
    }),
    'item'
  );

// One tab button — `part(_, 'tab')`, index-matched to the panel of the same order.
const tabButton = (label: string) =>
  part(
    el(
      'button',
      '-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-base-content transition-colors hover:text-base-content data-[active=true]:border-primary data-[active=true]:text-primary',
      { text: label, attrs: { type: 'button' } }
    ),
    'tab'
  );

// One tab panel — `part(_, 'panel')`. All but the first ship `hidden` so only the
// active panel paints before the behavior takes over.
const tabPanel = (body: string, closed: boolean) =>
  part(
    el('div', 'py-5 text-sm leading-relaxed text-base-content', {
      attrs: closed ? { hidden: true } : {},
      children: [el('p', '', { text: body })],
    }),
    'panel'
  );

// A billing-period toggle button — `part(_, 'tab')` so the tabs behavior reveals its
// index-matched price panel; `data-[active=true]:` styles the selected period.
const pricingTab = (label: string) =>
  part(
    el(
      'button',
      'rounded-full px-5 py-2 text-sm font-medium text-base-content transition-colors data-[active=true]:bg-base-100 data-[active=true]:text-base-content data-[active=true]:shadow-sm',
      { text: label, attrs: { type: 'button' } }
    ),
    'tab'
  );

// One pricing tier card — name, a big price with its cadence, and a CTA.
const priceTier = (name: string, price: string, cadence: string) =>
  el('div', 'flex flex-1 flex-col gap-4 rounded-box border border-base-200 bg-base-100 p-6', {
    children: [
      atom('Heading', 'text-lg font-semibold text-base-content', { level: 'h3', text: name }),
      el('div', 'flex items-baseline gap-1', {
        children: [
          el('span', 'text-4xl font-bold tracking-tight text-base-content', { text: price }),
          el('span', 'text-sm text-base-content', { text: cadence }),
        ],
      }),
      atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-md', { label: 'Choose plan' }),
    ],
  });

// One price PANEL (the three tiers for a billing period) — `part(_, 'panel')`,
// index-matched to its tab. The annual panel ships hidden until its tab is clicked.
const pricePanel = (closed: boolean, prices: [string, string, string], cadence: string) =>
  part(
    el('div', 'grid grid-cols-1 gap-6 @2xl:grid-cols-3', {
      attrs: closed ? { hidden: true } : {},
      children: [
        priceTier('Starter', prices[0], cadence),
        priceTier('Growth', prices[1], cadence),
        priceTier('Scale', prices[2], cadence),
      ],
    }),
    'panel'
  );

// One animated stat — the number is `part(_, 'item')` so the counter behavior reads
// it and counts up to it; the label sits beside it, untouched by the animation.
const statCount = (value: string, label: string) =>
  el('div', 'flex flex-col items-center gap-1', {
    children: [
      part(
        el('div', 'text-4xl font-bold tracking-tight text-primary @2xl:text-5xl', { text: value }),
        'item'
      ),
      el('div', 'text-sm text-base-content', { text: label }),
    ],
  });

// ── Entries ────────────────────────────────────────────────────────────────────

export const INTERACTIVE_CATALOG: PlatformCatalogEntry[] = [
  // ── Carousel hero — autoplaying full-width slider ─────────────────────────────
  entry({
    key: 'carousel_hero',
    name: 'Carousel hero',
    category: 'marketing',
    kind: 'comprehensive',
    icon: 'images',
    description:
      'A full-width hero that auto-advances through colored pitch slides, with arrows and dots. Pauses on hover; the canvas shows one slide at a time without advancing.',
    surfaces: ['page', 'site'],
    tags: ['carousel', 'hero', 'slider', 'slideshow', 'banner', 'autoplay', 'marketing'],
    tree: behave(
      el('section', 'relative w-full overflow-hidden rounded-box bg-base-200', {
        name: 'Carousel hero',
        attrs: { ariaLabel: 'Featured' },
        children: [
          part(
            el('div', 'flex transition-transform duration-700 ease-out', {
              name: 'Slides',
              children: [
                heroSlide(
                  'bg-primary text-primary-content',
                  'Built to go the distance',
                  'Engineered frames, tested on every terrain — find the ride that fits the way you move.',
                  'Shop the lineup'
                ),
                heroSlide(
                  'bg-neutral text-neutral-content',
                  'New season, new gear',
                  'Helmets, lights, and locks designed to keep up. Free shipping over $75, returns always on us.',
                  'Browse accessories'
                ),
                heroSlide(
                  'bg-accent text-accent-content',
                  'Service that comes to you',
                  'Book a tune-up online and a certified mechanic handles the rest — at your door, on your schedule.',
                  'Book a tune-up'
                ),
              ],
            }),
            'track'
          ),
          carouselArrow('left', '‹', 'Previous slide'),
          carouselArrow('right', '›', 'Next slide'),
          el('div', 'absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2', {
            name: 'Dots',
            children: [carouselDot(1), carouselDot(2), carouselDot(3)],
          }),
        ],
      }),
      { type: 'carousel', autoplay: true, interval: 6 }
    ),
  }),

  // ── Logo marquee — continuously scrolling proof strip ─────────────────────────
  entry({
    key: 'logo_marquee',
    name: 'Logo marquee',
    category: 'marketing',
    kind: 'comprehensive',
    icon: 'gallery-horizontal',
    description:
      'A row of partner or press logos that scrolls continuously and pauses on hover — the live strip doubles itself for a seamless loop; the canvas shows it at rest.',
    surfaces: ['page', 'site'],
    tags: ['marquee', 'logos', 'logo cloud', 'ticker', 'scroller', 'press', 'marketing'],
    tree: behave(
      el('div', 'w-full overflow-hidden py-6', {
        name: 'Logo marquee',
        attrs: { ariaLabel: 'Featured in' },
        children: [
          part(
            el('div', 'flex w-max items-center gap-12 animate-marquee', {
              name: 'Track',
              children: [
                marqueeLogo('NORTHWIND'),
                marqueeLogo('Acme Co'),
                marqueeLogo('Globex'),
                marqueeLogo('Initech'),
                marqueeLogo('Umbra'),
                marqueeLogo('Soylent'),
              ],
            }),
            'track'
          ),
        ],
      }),
      { type: 'marquee', pauseOnHover: true }
    ),
  }),

  // ── Testimonial carousel — one quote at a time, arrows + dots ──────────────────
  entry({
    key: 'testimonial_carousel',
    name: 'Testimonial carousel',
    category: 'marketing',
    kind: 'comprehensive',
    icon: 'quote',
    description:
      'A slider that shows one customer quote at a time with a star rating and attribution, advanced by arrows or dots.',
    surfaces: ['page', 'site'],
    tags: ['testimonial', 'review', 'quote', 'carousel', 'slider', 'proof', 'marketing'],
    tree: behave(
      el('section', 'relative mx-auto w-full max-w-3xl px-12 py-12', {
        name: 'Testimonial carousel',
        attrs: { ariaLabel: 'What customers say' },
        children: [
          el('div', 'overflow-hidden', {
            name: 'Viewport',
            children: [
              part(
                el('div', 'flex transition-transform duration-500 ease-out', {
                  name: 'Track',
                  children: [
                    testimonialSlide(
                      'Set up our whole storefront in an afternoon. The first order came in before I finished my coffee.',
                      'Dana Whitfield',
                      'Founder, Ridgeline Goods'
                    ),
                    testimonialSlide(
                      'Switching was painless and support actually answers. Our conversion rate is up 30% since launch.',
                      'Marcus Lee',
                      'Owner, Harbor Coffee Roasters'
                    ),
                    testimonialSlide(
                      'It does email, the site, and our wholesale orders in one place. No more stitching five tools together.',
                      'Priya Nair',
                      'Operations, Field & Forge'
                    ),
                  ],
                }),
                'track'
              ),
            ],
          }),
          carouselArrow('left', '‹', 'Previous testimonial'),
          carouselArrow('right', '›', 'Next testimonial'),
          el('div', 'mt-6 flex items-center justify-center gap-2', {
            name: 'Dots',
            children: [carouselDot(1), carouselDot(2), carouselDot(3)],
          }),
        ],
      }),
      { type: 'carousel', autoplay: false }
    ),
  }),

  // ── Scroll-adaptive nav — transparent at the top, solid once scrolled ─────────
  entry({
    key: 'nav_scroll_adaptive',
    name: 'Scroll-adaptive nav',
    category: 'navigation',
    kind: 'comprehensive',
    icon: 'panel-top',
    description:
      'A sticky bar that starts transparent over the hero and turns solid with a shadow once the page scrolls, highlighting the in-view section link as you go.',
    surfaces: ['page', 'site'],
    tags: ['nav', 'navbar', 'sticky', 'scroll', 'header', 'adaptive', 'scrollspy', 'navigation'],
    tree: behave(
      el(
        'nav',
        'navbar sticky top-0 z-50 border-b border-transparent bg-base-100/0 backdrop-blur transition-all duration-300 data-[scrolled=true]:border-base-200 data-[scrolled=true]:bg-base-100/90 data-[scrolled=true]:shadow-sm',
        {
          name: 'Scroll-adaptive nav',
          attrs: { ariaLabel: 'Primary' },
          children: [
            el('div', 'navbar-start gap-2', {
              name: 'navbar-start',
              children: [bound(atom('Wordmark', '', { collapse: 'mark' }), 'site.identity')],
            }),
            el('div', 'navbar-center hidden gap-6 @3xl:flex', {
              name: 'navbar-center',
              children: [
                spyLink('Features', '#features'),
                spyLink('Pricing', '#pricing'),
                spyLink('Reviews', '#reviews'),
                spyLink('Contact', '#contact'),
              ],
            }),
            el('div', 'navbar-end gap-3', {
              name: 'navbar-end',
              children: [
                atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-sm', {
                  label: 'Get started',
                }),
              ],
            }),
          ],
        }
      ),
      { type: 'scrollspy', threshold: 8 }
    ),
  }),

  // ── Mega-menu — a trigger that opens a wide multi-column panel ─────────────────
  entry({
    key: 'mega_menu',
    name: 'Mega-menu',
    category: 'navigation',
    kind: 'comprehensive',
    icon: 'layout-grid',
    description:
      'A nav item that opens a wide multi-column dropdown of links, closing on outside-click or Escape. The panel ships closed and reveals in the canvas for editing.',
    surfaces: ['page', 'site'],
    tags: ['mega menu', 'dropdown', 'menu', 'nav', 'flyout', 'panel', 'navigation'],
    tree: behave(
      el('div', 'group relative inline-block', {
        name: 'Mega-menu',
        children: [
          part(
            el(
              'button',
              'inline-flex items-center gap-1 rounded-field px-3 py-2 text-sm font-medium text-base-content transition-colors hover:bg-base-200',
              {
                attrs: { type: 'button' },
                children: [
                  el('span', '', { text: 'Products' }),
                  atom(
                    'Icon',
                    'h-4 w-4 transition-transform duration-200 group-data-[open=true]:rotate-180',
                    { name: 'chevron-down' }
                  ),
                ],
              }
            ),
            'trigger'
          ),
          part(
            el(
              'div',
              'absolute left-0 top-full z-50 mt-2 grid w-max grid-cols-3 gap-8 rounded-box border border-base-200 bg-base-100 p-6 shadow-xl',
              {
                attrs: { hidden: true },
                children: [
                  megaColumn('Bikes', [
                    ['Mountain', '/c/mountain'],
                    ['City', '/c/city'],
                    ['Cargo', '/c/cargo'],
                    ['Trail', '/c/trail'],
                  ]),
                  megaColumn('Gear', [
                    ['Helmets', '/c/helmets'],
                    ['Lights', '/c/lights'],
                    ['Locks', '/c/locks'],
                    ['Bags', '/c/bags'],
                  ]),
                  megaColumn('Support', [
                    ['Warranty', '/support/warranty'],
                    ['Service', '/support/service'],
                    ['Find a shop', '/shops'],
                    ['Contact', '/contact'],
                  ]),
                ],
              }
            ),
            'panel'
          ),
        ],
      }),
      { type: 'menu' }
    ),
  }),

  // ── Accordion (single-open) — JS disclosure, one panel at a time ──────────────
  // The scripted counterpart to the CSS-only `faq_accordion` (<details>, multi-open):
  // this one keeps at most one section open. FAQ copy by default; rename for any use.
  entry({
    key: 'accordion_single',
    name: 'Accordion (single-open)',
    category: 'data-display',
    kind: 'comprehensive',
    icon: 'list-collapse',
    description:
      'A disclosure list that keeps one section open at a time, with a chevron that flips on open. Panels ship collapsed and reveal in the canvas for editing.',
    surfaces: ['page', 'site'],
    tags: ['accordion', 'faq', 'disclosure', 'single', 'collapse', 'questions', 'data-display'],
    tree: behave(
      el(
        'div',
        'mx-auto w-full max-w-2xl divide-y divide-base-200 rounded-box border border-base-200',
        {
          name: 'FAQ accordion',
          children: [
            faqItem(
              'How long does shipping take?',
              'Most orders ship within one business day and arrive in 3–5 days. You get a tracking link by email the moment your order leaves the warehouse.'
            ),
            faqItem(
              'What is your return policy?',
              'Returns are free within 30 days, no questions asked. Start a return from your account and we email you a prepaid label.'
            ),
            faqItem(
              'Do you offer wholesale pricing?',
              'Yes — approved trade accounts unlock tiered pricing and net terms. Apply from the wholesale page and we review within two business days.'
            ),
            faqItem(
              'Can I change my order after checkout?',
              'If it has not shipped yet, contact support and we will update the address or items. Once it is on the truck we will help you set up a return instead.'
            ),
          ],
        }
      ),
      { type: 'disclosure', single: true }
    ),
  }),

  // ── Tabbed panels — JS-wired tabs revealing matched panels ────────────────────
  entry({
    key: 'tabbed_panels',
    name: 'Tabbed panels',
    category: 'data-display',
    kind: 'comprehensive',
    icon: 'panels-top-left',
    description:
      'A row of tabs that reveal index-matched panels, with arrow-key navigation. Inactive panels ship hidden; the canvas reveals all of them for editing.',
    surfaces: ['page', 'site'],
    tags: ['tabs', 'tabbed', 'panels', 'segmented', 'switcher', 'data-display'],
    tree: behave(
      el('div', 'w-full', {
        name: 'Tabbed panels',
        children: [
          el('div', 'flex items-center gap-1 border-b border-base-200', {
            name: 'Tablist',
            attrs: { role: 'tablist' },
            children: [tabButton('Overview'), tabButton('Specs'), tabButton('Reviews')],
          }),
          el('div', 'w-full', {
            name: 'Panels',
            children: [
              tabPanel(
                'A quick summary of the product — what it is, who it is for, and why it stands out from the rest of the lineup.',
                false
              ),
              tabPanel(
                'The full technical breakdown: materials, dimensions, weight, and compatibility, laid out so buyers can compare at a glance.',
                true
              ),
              tabPanel(
                'What customers are saying after living with it — the praise, the caveats, and the details that only show up after a few weeks.',
                true
              ),
            ],
          }),
        ],
      }),
      { type: 'tabs' }
    ),
  }),

  // ── Drawer — a button slides in a side panel (menu behavior) ──────────────────
  // The panel pins with the SANCTIONED `st-fixed-right` (a full-height right rail
  // capped at 33vw — never a full-viewport overlay, so it can't be a clickjacking
  // surface; raw `fixed inset-0` is denied by the compile allowlist). A modal/dialog
  // needs a dimmed full-viewport backdrop, which the position model intentionally
  // forbids — that one is the site-ui Dialog (st-dialog) atom path, a follow-up.
  entry({
    key: 'drawer_panel',
    name: 'Drawer',
    category: 'navigation',
    kind: 'comprehensive',
    icon: 'panel-right',
    description:
      'A button that opens a side panel of navigation or settings, closing on Escape, outside-click, or a link. Ships closed; the canvas reveals it for editing.',
    surfaces: ['page', 'site'],
    tags: ['drawer', 'side panel', 'off-canvas', 'sidebar', 'sheet', 'menu', 'navigation'],
    tree: behave(
      el('div', 'inline-block', {
        name: 'Drawer',
        children: [
          // A RAW button (not the Button atom): a behavior part must emit data-sx-*,
          // which only the raw-element render path does. It wears the st-btn recipe so
          // it still looks like a Button.
          part(
            el('button', 'st-btn st-c-neutral st-v-outline st-btn--sz-md', {
              text: 'Open menu',
              attrs: { type: 'button' },
            }),
            'trigger'
          ),
          part(
            el(
              'div',
              'st-fixed-right z-50 flex w-72 flex-col gap-1 border-l border-base-200 bg-base-100 p-5 shadow-2xl',
              {
                name: 'Panel',
                attrs: { hidden: true, role: 'dialog', ariaLabel: 'Menu' },
                children: [
                  el('div', 'mb-3 flex items-center justify-between', {
                    children: [
                      atom('Heading', 'text-base font-semibold text-base-content', {
                        level: 'h3',
                        text: 'Menu',
                      }),
                      el(
                        'a',
                        'text-lg leading-none text-base-content transition-colors hover:text-base-content',
                        { text: '✕', attrs: { href: '#', ariaLabel: 'Close' } }
                      ),
                    ],
                  }),
                  el('a', 'rounded-field px-3 py-2 text-sm text-base-content hover:bg-base-200', {
                    text: 'Home',
                    attrs: { href: '/' },
                  }),
                  el('a', 'rounded-field px-3 py-2 text-sm text-base-content hover:bg-base-200', {
                    text: 'Shop',
                    attrs: { href: '/products' },
                  }),
                  el('a', 'rounded-field px-3 py-2 text-sm text-base-content hover:bg-base-200', {
                    text: 'About',
                    attrs: { href: '/about' },
                  }),
                  el('a', 'rounded-field px-3 py-2 text-sm text-base-content hover:bg-base-200', {
                    text: 'Contact',
                    attrs: { href: '/contact' },
                  }),
                ],
              }
            ),
            'panel'
          ),
        ],
      }),
      { type: 'menu' }
    ),
  }),

  // ── Popover — a button reveals an anchored card (menu behavior) ───────────────
  entry({
    key: 'popover',
    name: 'Popover',
    category: 'actions',
    kind: 'comprehensive',
    icon: 'message-square',
    description:
      'A trigger that reveals a small anchored card of detail, closing on outside-click or Escape. Ships closed; the canvas reveals it for editing.',
    surfaces: ['page', 'site'],
    tags: ['popover', 'tooltip', 'flyout', 'hint', 'detail', 'actions'],
    tree: behave(
      el('div', 'relative inline-block', {
        name: 'Popover',
        children: [
          // A RAW button (a behavior part must emit data-sx-*; the Button atom does
          // not). It wears the st-btn recipe so it still looks like a Button.
          part(
            el('button', 'st-btn st-c-neutral st-v-outline st-btn--sz-sm', {
              text: 'Details',
              attrs: { type: 'button' },
            }),
            'trigger'
          ),
          part(
            el(
              'div',
              'absolute left-0 top-full z-40 mt-2 w-64 rounded-box border border-base-200 bg-base-100 p-4 shadow-lg',
              {
                name: 'Panel',
                attrs: { hidden: true, role: 'dialog', ariaLabel: 'Shipping estimate' },
                children: [
                  atom('Heading', 'text-sm font-semibold text-base-content', {
                    level: 'h3',
                    text: 'Shipping estimate',
                  }),
                  atom('Text', 'mt-1 text-sm text-base-content', {
                    variant: 'body',
                    text: 'Free 3–5 day shipping on orders over $75. Express options are offered at checkout.',
                  }),
                ],
              }
            ),
            'panel'
          ),
        ],
      }),
      { type: 'menu' }
    ),
  }),

  // ── Pricing toggle — Monthly/Annual tabs swap the whole price set ─────────────
  entry({
    key: 'pricing_toggle',
    name: 'Pricing toggle',
    category: 'marketing',
    kind: 'comprehensive',
    icon: 'badge-dollar-sign',
    description:
      'A pricing section with Monthly / Annual tabs that swap the whole price set. The inactive panel ships hidden; the canvas shows both for editing.',
    surfaces: ['page', 'site'],
    tags: ['pricing', 'plans', 'toggle', 'monthly', 'annual', 'tabs', 'marketing'],
    tree: behave(
      el('section', 'w-full px-4 py-16', {
        name: 'Pricing toggle',
        children: [
          el('div', 'mx-auto max-w-5xl', {
            children: [
              atom(
                'Heading',
                'mb-6 text-center text-3xl font-bold tracking-tight text-base-content',
                { level: 'h2', text: 'Simple, honest pricing' }
              ),
              el('div', 'mb-8 flex justify-center', {
                children: [
                  el('div', 'inline-flex items-center gap-1 rounded-full bg-base-200 p-1', {
                    name: 'Billing period',
                    attrs: { role: 'tablist' },
                    children: [pricingTab('Monthly'), pricingTab('Annual')],
                  }),
                ],
              }),
              pricePanel(false, ['$12', '$29', '$79'], '/mo'),
              pricePanel(true, ['$9', '$23', '$63'], '/mo billed yearly'),
            ],
          }),
        ],
      }),
      { type: 'tabs' }
    ),
  }),

  // ── Animated stats — headline numbers that count up when scrolled into view ───
  entry({
    key: 'stats_counter',
    name: 'Animated stats',
    category: 'marketing',
    kind: 'comprehensive',
    icon: 'trending-up',
    description:
      'A band of headline numbers that count up from zero when they scroll into view. The canvas shows the final figures; the live site animates them.',
    surfaces: ['page', 'site'],
    tags: ['stats', 'counter', 'numbers', 'metrics', 'proof', 'animated', 'marketing'],
    tree: behave(
      el('section', 'w-full px-4 py-16', {
        name: 'Animated stats',
        children: [
          el('div', 'mx-auto grid max-w-5xl grid-cols-2 gap-8 text-center @2xl:grid-cols-4', {
            name: 'Stats',
            children: [
              statCount('10,000+', 'Orders shipped'),
              statCount('98%', 'Would recommend'),
              statCount('45', 'Countries served'),
              statCount('4.9', 'Average rating'),
            ],
          }),
        ],
      }),
      { type: 'counter' }
    ),
  }),
];
