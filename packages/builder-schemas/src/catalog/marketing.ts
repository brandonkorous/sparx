// Catalog · Marketing (docs/98 §5). Conversion blocks — CTAs, pricing, proof.
//
// The marketing family is where composition pays off most: a "pricing table" or a
// "stats band" isn't a bespoke guided type, it's a token-skinned <section> built
// from the same raw elements + atoms as everything else. The recurring moves are
// (1) a centered, max-width text column for the pitch, (2) a responsive card/column
// grid that collapses to one column on a narrow container (container queries, never
// viewport breakpoints), and (3) the recipe-class Button for every call-to-action.
// Larger composites (pricing, comparison, team) are `comprehensive`; the proof
// blocks (testimonials, logos, stats) are `common` building blocks.

import { el, atom, entry, type PlatformCatalogEntry } from './_kit';

// A single feature row inside a pricing card — a check glyph + the line of copy.
const featureLine = (text: string) =>
  el('li', 'flex items-start gap-2 text-sm text-base-content/80', {
    children: [el('span', 'mt-0.5 shrink-0 text-success', { text: '✓' }), el('span', '', { text })],
  });

// A muted placeholder "logo" chip for the logo cloud (real marks drop in later).
const logoChip = (label: string) =>
  el(
    'div',
    'flex h-10 w-28 items-center justify-center rounded-field bg-base-200 text-sm font-semibold tracking-tight text-base-content/40',
    { text: label }
  );

// A small circular social link for the team cards — icon-only, labelled for a11y.
const socialDot = (name: string, label: string) =>
  el(
    'a',
    'flex h-8 w-8 items-center justify-center rounded-full text-base-content/50 transition-colors hover:bg-base-200 hover:text-primary',
    { attrs: { href: '#', ariaLabel: label }, children: [atom('Icon', 'h-4 w-4', { name })] }
  );

// A comparison-table check / dash cell — present vs. absent for a plan.
const cellYes = () =>
  el('td', 'border-b border-base-200 px-4 py-3 text-center text-success', { text: '✓' });
const cellNo = () =>
  el('td', 'border-b border-base-200 px-4 py-3 text-center text-base-content/30', { text: '—' });

// A bento-mosaic cell — a padded tile; `span` widens it on a wide container, `tone`
// sets its surface (a colored cell carries its own -content text for the children).
const bentoCell = (span: string, tone: string, title: string, body: string) =>
  el('div', `flex min-h-44 flex-col justify-end gap-2 rounded-box p-6 ${tone} ${span}`, {
    children: [
      atom('Heading', 'text-lg font-semibold', { level: 'h3', text: title }),
      atom('Text', 'text-sm opacity-80', { variant: 'body', text: body }),
    ],
  });

// One numbered "how it works" step — a badge, a heading, and a line of copy.
const stepItem = (n: string, title: string, body: string) =>
  el('div', 'flex flex-col items-center gap-3 text-center', {
    children: [
      el(
        'div',
        'flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-content',
        { text: n }
      ),
      atom('Heading', 'text-lg font-semibold text-base-content', { level: 'h3', text: title }),
      atom('Text', 'text-sm text-base-content/70', { variant: 'body', text: body }),
    ],
  });

// One masonry gallery image — `break-inside-avoid` keeps a photo whole across the
// CSS columns; the natural ratio varies per tile so the wall reads as masonry.
const galleryImage = (ratio: 'wide' | 'square' | 'portrait') =>
  atom('Image', 'mb-4 w-full break-inside-avoid rounded-box', { ratio, alt: 'Gallery image' });

export const MARKETING_CATALOG: PlatformCatalogEntry[] = [
  // ── CTA band — accent full-width call to action ───────────────────────────────
  entry({
    key: 'cta_band',
    name: 'CTA band',
    category: 'marketing',
    kind: 'common',
    icon: 'megaphone',
    description:
      'A full-width accent band with a headline, a supporting line, and a primary + secondary action — centered.',
    surfaces: ['page', 'site'],
    tags: ['cta', 'call to action', 'band', 'banner', 'convert', 'marketing'],
    tree: el(
      'section',
      'w-full rounded-box bg-primary px-6 py-16 text-primary-content @3xl:px-12',
      {
        children: [
          el('div', 'mx-auto flex max-w-2xl flex-col items-center gap-6 text-center', {
            children: [
              atom('Heading', 'text-3xl font-bold tracking-tight @3xl:text-4xl', {
                level: 'h2',
                text: 'Ready to launch your storefront?',
              }),
              el('p', 'text-lg text-primary-content/80', {
                text: 'Go from idea to a live, branded site in minutes — no code, no contracts, cancel anytime.',
              }),
              el('div', 'flex flex-col gap-3 @sm:flex-row', {
                children: [
                  atom('Button', 'st-btn st-c-neutral st-v-solid st-btn--sz-lg', {
                    label: 'Start free trial',
                  }),
                  atom('Button', 'st-btn st-c-primary st-v-outline st-btn--sz-lg', {
                    label: 'Book a demo',
                  }),
                ],
              }),
            ],
          }),
        ],
      }
    ),
  }),

  // ── Pricing — three tiers, highlighted middle plan ────────────────────────────
  entry({
    key: 'pricing_three_tier',
    name: 'Pricing — three tiers',
    category: 'marketing',
    kind: 'comprehensive',
    icon: 'badge-dollar-sign',
    description:
      'Three pricing cards — Starter, Pro, Enterprise — with the middle plan highlighted, each listing features and a call to action.',
    surfaces: ['page', 'site'],
    tags: ['pricing', 'plans', 'tiers', 'subscription', 'compare', 'marketing'],
    tree: el('section', 'w-full px-4 py-16', {
      children: [
        el('div', 'mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center', {
          children: [
            atom('Heading', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
              level: 'h2',
              text: 'Simple, transparent pricing',
            }),
            el('p', 'text-lg text-base-content/60', {
              text: 'Pick a plan that fits today and upgrade the moment you outgrow it. Every tier includes a 14-day trial.',
            }),
          ],
        }),
        el('div', 'mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-6 @3xl:grid-cols-3', {
          children: [
            // Starter
            el(
              'div',
              'flex flex-col gap-6 rounded-box border border-base-200 bg-base-100 p-8 shadow-sm',
              {
                children: [
                  el('div', 'flex flex-col gap-1', {
                    children: [
                      el('h3', 'text-lg font-semibold text-base-content', { text: 'Starter' }),
                      el('p', 'text-sm text-base-content/60', {
                        text: 'For solo makers getting their first site live.',
                      }),
                    ],
                  }),
                  el('div', 'flex items-baseline gap-1', {
                    children: [
                      el('span', 'text-4xl font-bold tracking-tight text-base-content', {
                        text: '$0',
                      }),
                      el('span', 'text-sm text-base-content/50', { text: '/month' }),
                    ],
                  }),
                  el('ul', 'flex flex-col gap-3', {
                    children: [
                      featureLine('1 published site'),
                      featureLine('Up to 25 products'),
                      featureLine('Community support'),
                      featureLine('sparx subdomain'),
                    ],
                  }),
                  atom('Button', 'st-btn st-c-neutral st-v-outline st-btn--sz-md mt-auto w-full', {
                    label: 'Get started',
                  }),
                ],
              }
            ),
            // Pro (highlighted)
            el(
              'div',
              'relative flex flex-col gap-6 rounded-box border-2 border-primary bg-base-100 p-8 shadow-lg @3xl:-mt-4 @3xl:mb-4',
              {
                children: [
                  el('div', 'absolute -top-3 left-1/2 -translate-x-1/2', {
                    children: [
                      atom('Badge', 'st-badge st-c-primary st-v-solid', { label: 'Most popular' }),
                    ],
                  }),
                  el('div', 'flex flex-col gap-1', {
                    children: [
                      el('h3', 'text-lg font-semibold text-base-content', { text: 'Pro' }),
                      el('p', 'text-sm text-base-content/60', {
                        text: 'For growing stores that need room to scale.',
                      }),
                    ],
                  }),
                  el('div', 'flex items-baseline gap-1', {
                    children: [
                      el('span', 'text-4xl font-bold tracking-tight text-base-content', {
                        text: '$29',
                      }),
                      el('span', 'text-sm text-base-content/50', { text: '/month' }),
                    ],
                  }),
                  el('ul', 'flex flex-col gap-3', {
                    children: [
                      featureLine('Unlimited products'),
                      featureLine('Custom domain included'),
                      featureLine('Abandoned-cart recovery'),
                      featureLine('Priority email support'),
                      featureLine('Advanced analytics'),
                    ],
                  }),
                  atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-md mt-auto w-full', {
                    label: 'Start free trial',
                  }),
                ],
              }
            ),
            // Enterprise
            el(
              'div',
              'flex flex-col gap-6 rounded-box border border-base-200 bg-base-100 p-8 shadow-sm',
              {
                children: [
                  el('div', 'flex flex-col gap-1', {
                    children: [
                      el('h3', 'text-lg font-semibold text-base-content', { text: 'Enterprise' }),
                      el('p', 'text-sm text-base-content/60', {
                        text: 'For B2B teams with bespoke requirements.',
                      }),
                    ],
                  }),
                  el('div', 'flex items-baseline gap-1', {
                    children: [
                      el('span', 'text-4xl font-bold tracking-tight text-base-content', {
                        text: 'Custom',
                      }),
                    ],
                  }),
                  el('ul', 'flex flex-col gap-3', {
                    children: [
                      featureLine('Everything in Pro'),
                      featureLine('Wholesale & net terms'),
                      featureLine('SSO & audit logs'),
                      featureLine('Dedicated success manager'),
                      featureLine('99.9% uptime SLA'),
                    ],
                  }),
                  atom('Button', 'st-btn st-c-neutral st-v-outline st-btn--sz-md mt-auto w-full', {
                    label: 'Contact sales',
                  }),
                ],
              }
            ),
          ],
        }),
      ],
    }),
  }),

  // ── Testimonial (single) — one large, centered pull quote ─────────────────────
  entry({
    key: 'testimonial_single',
    name: 'Testimonial — single',
    category: 'marketing',
    kind: 'common',
    icon: 'quote',
    description:
      'A single large centered quote with an avatar, name, and role — social proof at the top of a page.',
    surfaces: ['page', 'site'],
    tags: ['testimonial', 'quote', 'review', 'social proof', 'marketing'],
    tree: el('section', 'w-full px-6 py-16', {
      children: [
        el('figure', 'mx-auto flex max-w-3xl flex-col items-center gap-8 text-center', {
          children: [
            atom('Icon', 'h-10 w-10 text-primary/40', { name: 'quote' }),
            el(
              'blockquote',
              'text-2xl font-medium leading-relaxed text-base-content @3xl:text-3xl',
              {
                text: '“sparx replaced four separate tools for us. We relaunched our store in a weekend and orders climbed 38% the first month.”',
              }
            ),
            el('figcaption', 'flex items-center gap-4', {
              children: [
                atom('Image', 'h-12 w-12 rounded-full object-cover', {
                  ratio: 'square',
                  alt: 'Portrait of Dana Whitfield',
                }),
                el('div', 'flex flex-col text-left', {
                  children: [
                    el('span', 'font-semibold text-base-content', { text: 'Dana Whitfield' }),
                    el('span', 'text-sm text-base-content/60', { text: 'Founder, Harbor & Pine' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Testimonial grid — three quote cards ──────────────────────────────────────
  entry({
    key: 'testimonial_grid',
    name: 'Testimonial grid',
    category: 'marketing',
    kind: 'common',
    icon: 'messages-square',
    description:
      'A responsive grid of three testimonial cards — each a quote with the person who said it. Collapses to one column.',
    surfaces: ['page', 'site'],
    tags: ['testimonials', 'reviews', 'quotes', 'social proof', 'grid', 'marketing'],
    tree: el('section', 'w-full px-4 py-16', {
      children: [
        el('div', 'mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center', {
          children: [
            atom('Heading', 'text-3xl font-bold tracking-tight text-base-content', {
              level: 'h2',
              text: 'Loved by thousands of merchants',
            }),
            el('p', 'text-lg text-base-content/60', {
              text: 'From first-time sellers to established wholesalers, teams ship faster on sparx.',
            }),
          ],
        }),
        el('div', 'mx-auto grid max-w-5xl grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-3', {
          children: [
            el(
              'figure',
              'flex flex-col gap-5 rounded-box border border-base-200 bg-base-100 p-6 shadow-sm',
              {
                children: [
                  atom('Rating', 'st-c-warning', { value: '5', count: '5' }),
                  el('blockquote', 'text-base leading-relaxed text-base-content/80', {
                    text: '“Setup took an afternoon and the storefront looks like we hired an agency. The brand controls are unreal.”',
                  }),
                  el('figcaption', 'flex items-center gap-3', {
                    children: [
                      atom('Image', 'h-10 w-10 rounded-full object-cover', {
                        ratio: 'square',
                        alt: 'Portrait of Marcus Lee',
                      }),
                      el('div', 'flex flex-col', {
                        children: [
                          el('span', 'text-sm font-semibold text-base-content', {
                            text: 'Marcus Lee',
                          }),
                          el('span', 'text-xs text-base-content/60', {
                            text: 'Owner, Northside Coffee',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }
            ),
            el(
              'figure',
              'flex flex-col gap-5 rounded-box border border-base-200 bg-base-100 p-6 shadow-sm',
              {
                children: [
                  atom('Rating', 'st-c-warning', { value: '5', count: '5' }),
                  el('blockquote', 'text-base leading-relaxed text-base-content/80', {
                    text: '“We run wholesale and retail from one dashboard now. Net-terms invoicing alone paid for the year.”',
                  }),
                  el('figcaption', 'flex items-center gap-3', {
                    children: [
                      atom('Image', 'h-10 w-10 rounded-full object-cover', {
                        ratio: 'square',
                        alt: 'Portrait of Priya Nair',
                      }),
                      el('div', 'flex flex-col', {
                        children: [
                          el('span', 'text-sm font-semibold text-base-content', {
                            text: 'Priya Nair',
                          }),
                          el('span', 'text-xs text-base-content/60', {
                            text: 'Ops Lead, Field & Forge',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }
            ),
            el(
              'figure',
              'flex flex-col gap-5 rounded-box border border-base-200 bg-base-100 p-6 shadow-sm',
              {
                children: [
                  atom('Rating', 'st-c-warning', { value: '5', count: '5' }),
                  el('blockquote', 'text-base leading-relaxed text-base-content/80', {
                    text: '“Support actually answers, the platform is fast, and our checkout conversion jumped after the move.”',
                  }),
                  el('figcaption', 'flex items-center gap-3', {
                    children: [
                      atom('Image', 'h-10 w-10 rounded-full object-cover', {
                        ratio: 'square',
                        alt: 'Portrait of Sofia Alvarez',
                      }),
                      el('div', 'flex flex-col', {
                        children: [
                          el('span', 'text-sm font-semibold text-base-content', {
                            text: 'Sofia Alvarez',
                          }),
                          el('span', 'text-xs text-base-content/60', {
                            text: 'Founder, Lumen Skincare',
                          }),
                        ],
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

  // ── Feature grid (icons) — three-up benefit grid ──────────────────────────────
  entry({
    key: 'feature_grid_icons',
    name: 'Feature grid (icons)',
    category: 'marketing',
    kind: 'common',
    icon: 'layout-grid',
    description:
      'A responsive three-up grid of features — each an icon tile, a heading, and a line of supporting copy.',
    surfaces: ['page', 'site'],
    tags: ['features', 'benefits', 'icons', 'grid', 'value props', 'marketing'],
    tree: el('section', 'w-full px-4 py-16', {
      children: [
        el('div', 'mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center', {
          children: [
            atom('Heading', 'text-3xl font-bold tracking-tight text-base-content', {
              level: 'h2',
              text: 'Everything you need to sell',
            }),
            el('p', 'text-lg text-base-content/60', {
              text: 'One platform for your storefront, payments, customers, and marketing — no plugins to wrangle.',
            }),
          ],
        }),
        el('div', 'mx-auto grid max-w-5xl grid-cols-1 gap-8 @2xl:grid-cols-2 @4xl:grid-cols-3', {
          children: [
            el('div', 'flex flex-col items-start gap-4', {
              children: [
                el(
                  'div',
                  'flex h-12 w-12 items-center justify-center rounded-box bg-primary/10 text-primary',
                  {
                    children: [atom('Icon', 'h-6 w-6', { name: 'zap' })],
                  }
                ),
                el('h3', 'text-lg font-semibold text-base-content', { text: 'Live in minutes' }),
                el('p', 'text-sm leading-relaxed text-base-content/70', {
                  text: 'Start from a polished template and publish a branded store before your coffee gets cold.',
                }),
              ],
            }),
            el('div', 'flex flex-col items-start gap-4', {
              children: [
                el(
                  'div',
                  'flex h-12 w-12 items-center justify-center rounded-box bg-primary/10 text-primary',
                  {
                    children: [atom('Icon', 'h-6 w-6', { name: 'credit-card' })],
                  }
                ),
                el('h3', 'text-lg font-semibold text-base-content', { text: 'Payments built in' }),
                el('p', 'text-sm leading-relaxed text-base-content/70', {
                  text: 'Accept cards, wallets, and net terms out of the box, with payouts you can actually track.',
                }),
              ],
            }),
            el('div', 'flex flex-col items-start gap-4', {
              children: [
                el(
                  'div',
                  'flex h-12 w-12 items-center justify-center rounded-box bg-primary/10 text-primary',
                  {
                    children: [atom('Icon', 'h-6 w-6', { name: 'users' })],
                  }
                ),
                el('h3', 'text-lg font-semibold text-base-content', {
                  text: 'Know your customers',
                }),
                el('p', 'text-sm leading-relaxed text-base-content/70', {
                  text: 'A built-in CRM ties every order, email, and conversation to the person behind it.',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Logo cloud — caption + a row of muted placeholder marks ───────────────────
  entry({
    key: 'logo_cloud',
    name: 'Logo cloud',
    category: 'marketing',
    kind: 'common',
    icon: 'gallery-horizontal-end',
    description:
      'A centered caption above a responsive row of muted placeholder logos — drop in real customer marks later.',
    surfaces: ['page', 'site'],
    tags: ['logos', 'logo cloud', 'customers', 'trusted by', 'social proof', 'marketing'],
    tree: el('section', 'w-full px-4 py-12', {
      children: [
        el('div', 'mx-auto flex max-w-4xl flex-col items-center gap-8', {
          children: [
            el('p', 'text-sm font-medium text-base-content/50', {
              text: 'Trusted by fast-growing teams around the world',
            }),
            el('div', 'flex flex-wrap items-center justify-center gap-6', {
              children: [
                logoChip('Northwind'),
                logoChip('Acme Co'),
                logoChip('Brightly'),
                logoChip('Foundry'),
                logoChip('Vantage'),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Newsletter signup — inline email + subscribe button ───────────────────────
  entry({
    key: 'newsletter_signup',
    name: 'Newsletter signup',
    category: 'marketing',
    kind: 'common',
    icon: 'mail',
    description:
      'A heading and blurb above an inline email field joined to a subscribe button — stacks on a narrow container.',
    surfaces: ['page', 'site'],
    tags: ['newsletter', 'signup', 'subscribe', 'email', 'capture', 'marketing'],
    tree: el('section', 'w-full rounded-box bg-base-200 px-6 py-12 @3xl:px-12', {
      children: [
        el('div', 'mx-auto flex max-w-xl flex-col items-center gap-5 text-center', {
          children: [
            atom('Heading', 'text-2xl font-bold tracking-tight text-base-content @3xl:text-3xl', {
              level: 'h2',
              text: 'Get the weekly drop',
            }),
            el('p', 'text-base text-base-content/60', {
              text: 'New arrivals, restocks, and subscriber-only offers — straight to your inbox. No spam, unsubscribe anytime.',
            }),
            el('form', 'flex w-full flex-col gap-3 @sm:flex-row', {
              children: [
                // The real Input atom (st-input) — the field recipe drives its focus
                // color. (Was a hand-rolled <input> with bespoke border/focus classes.)
                atom('Input', 'st-c-primary st-fv-outline flex-1', {
                  type: 'email',
                  name: 'email',
                  placeholder: 'you@example.com',
                }),
                atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-md shrink-0', {
                  label: 'Subscribe',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── FAQ accordion — native <details>, CSS-only open state ─────────────────────
  entry({
    key: 'faq_accordion',
    name: 'FAQ accordion',
    category: 'marketing',
    kind: 'common',
    icon: 'circle-help',
    description:
      'A stack of question / answer disclosures built on native <details> — markers hidden, the chevron rotates on open. No script.',
    surfaces: ['page', 'site'],
    tags: ['faq', 'accordion', 'questions', 'disclosure', 'help', 'marketing'],
    tree: el('section', 'w-full px-4 py-16', {
      children: [
        el('div', 'mx-auto max-w-2xl', {
          children: [
            atom(
              'Heading',
              'mb-8 text-center text-3xl font-bold tracking-tight text-base-content',
              {
                level: 'h2',
                text: 'Frequently asked questions',
              }
            ),
            el('div', 'flex flex-col gap-3', {
              children: [
                el('details', 'group rounded-box border border-base-200 bg-base-100 p-5', {
                  attrs: { open: true },
                  children: [
                    el(
                      'summary',
                      'flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-base-content [&::-webkit-details-marker]:hidden',
                      {
                        children: [
                          el('span', '', { text: 'Do I need a credit card to start?' }),
                          atom(
                            'Icon',
                            'h-5 w-5 shrink-0 text-base-content/50 transition-transform group-open:rotate-180',
                            {
                              name: 'chevron-down',
                            }
                          ),
                        ],
                      }
                    ),
                    el('p', 'mt-3 text-sm leading-relaxed text-base-content/70', {
                      text: 'No. You can build and preview your entire site for free, and only add a card when you are ready to publish.',
                    }),
                  ],
                }),
                el('details', 'group rounded-box border border-base-200 bg-base-100 p-5', {
                  children: [
                    el(
                      'summary',
                      'flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-base-content [&::-webkit-details-marker]:hidden',
                      {
                        children: [
                          el('span', '', { text: 'Can I use my own domain?' }),
                          atom(
                            'Icon',
                            'h-5 w-5 shrink-0 text-base-content/50 transition-transform group-open:rotate-180',
                            {
                              name: 'chevron-down',
                            }
                          ),
                        ],
                      }
                    ),
                    el('p', 'mt-3 text-sm leading-relaxed text-base-content/70', {
                      text: 'Yes. Connect a domain you already own or register a new one in a few clicks — SSL is provisioned automatically.',
                    }),
                  ],
                }),
                el('details', 'group rounded-box border border-base-200 bg-base-100 p-5', {
                  children: [
                    el(
                      'summary',
                      'flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-base-content [&::-webkit-details-marker]:hidden',
                      {
                        children: [
                          el('span', '', { text: 'What happens if I outgrow my plan?' }),
                          atom(
                            'Icon',
                            'h-5 w-5 shrink-0 text-base-content/50 transition-transform group-open:rotate-180',
                            {
                              name: 'chevron-down',
                            }
                          ),
                        ],
                      }
                    ),
                    el('p', 'mt-3 text-sm leading-relaxed text-base-content/70', {
                      text: 'Upgrade any time and changes apply instantly. We prorate the difference, so you only pay for what you use.',
                    }),
                  ],
                }),
                el('details', 'group rounded-box border border-base-200 bg-base-100 p-5', {
                  children: [
                    el(
                      'summary',
                      'flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-base-content [&::-webkit-details-marker]:hidden',
                      {
                        children: [
                          el('span', '', { text: 'Can I cancel whenever I want?' }),
                          atom(
                            'Icon',
                            'h-5 w-5 shrink-0 text-base-content/50 transition-transform group-open:rotate-180',
                            {
                              name: 'chevron-down',
                            }
                          ),
                        ],
                      }
                    ),
                    el('p', 'mt-3 text-sm leading-relaxed text-base-content/70', {
                      text: 'Absolutely. There are no contracts or lock-in — cancel in one click and keep access through the end of the period.',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Stats band — four big numbers on a contrasting surface ────────────────────
  entry({
    key: 'stats_band',
    name: 'Stats band',
    category: 'marketing',
    kind: 'common',
    icon: 'bar-chart-3',
    description:
      'A band of four headline metrics with labels on a contrasting neutral surface — responsive, two-up then four-up.',
    surfaces: ['page', 'site'],
    tags: ['stats', 'metrics', 'numbers', 'kpi', 'band', 'marketing'],
    tree: el(
      'section',
      'w-full rounded-box bg-neutral px-6 py-14 text-neutral-content @3xl:px-12',
      {
        children: [
          el('dl', 'mx-auto grid max-w-4xl grid-cols-2 gap-8 text-center @3xl:grid-cols-4', {
            children: [
              atom('Stat', 'flex flex-col gap-1', { value: '50K+', label: 'Stores launched' }),
              atom('Stat', 'flex flex-col gap-1', { value: '$2.4B', label: 'Processed annually' }),
              atom('Stat', 'flex flex-col gap-1', { value: '99.9%', label: 'Uptime SLA' }),
              atom('Stat', 'flex flex-col gap-1', { value: '120+', label: 'Countries served' }),
            ],
          }),
        ],
      }
    ),
  }),

  // ── Team grid — four member cards with a social row ───────────────────────────
  entry({
    key: 'team_grid',
    name: 'Team grid',
    category: 'marketing',
    kind: 'comprehensive',
    icon: 'users-round',
    description:
      'A responsive grid of four team cards — photo, name, role, and a small social row. Collapses to one column.',
    surfaces: ['page', 'site'],
    tags: ['team', 'people', 'about', 'staff', 'members', 'grid', 'marketing'],
    tree: el('section', 'w-full px-4 py-16', {
      children: [
        el('div', 'mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center', {
          children: [
            atom('Heading', 'text-3xl font-bold tracking-tight text-base-content', {
              level: 'h2',
              text: 'Meet the team',
            }),
            el('p', 'text-lg text-base-content/60', {
              text: 'A small crew obsessed with making commerce simple for everyone who sells.',
            }),
          ],
        }),
        el('div', 'mx-auto grid max-w-5xl grid-cols-1 gap-8 @2xl:grid-cols-2 @4xl:grid-cols-4', {
          children: [
            el('article', 'flex flex-col items-center gap-3 text-center', {
              children: [
                atom('Image', 'h-24 w-24 rounded-full object-cover', {
                  ratio: 'square',
                  alt: 'Photo of Avery Cole',
                }),
                el('div', 'flex flex-col', {
                  children: [
                    el('h3', 'font-semibold text-base-content', { text: 'Avery Cole' }),
                    el('p', 'text-sm text-base-content/60', { text: 'Co-founder & CEO' }),
                  ],
                }),
                el('div', 'flex items-center gap-1', {
                  children: [
                    socialDot('linkedin', 'Avery on LinkedIn'),
                    socialDot('twitter', 'Avery on X'),
                  ],
                }),
              ],
            }),
            el('article', 'flex flex-col items-center gap-3 text-center', {
              children: [
                atom('Image', 'h-24 w-24 rounded-full object-cover', {
                  ratio: 'square',
                  alt: 'Photo of Jordan Reyes',
                }),
                el('div', 'flex flex-col', {
                  children: [
                    el('h3', 'font-semibold text-base-content', { text: 'Jordan Reyes' }),
                    el('p', 'text-sm text-base-content/60', { text: 'Head of Product' }),
                  ],
                }),
                el('div', 'flex items-center gap-1', {
                  children: [
                    socialDot('linkedin', 'Jordan on LinkedIn'),
                    socialDot('github', 'Jordan on GitHub'),
                  ],
                }),
              ],
            }),
            el('article', 'flex flex-col items-center gap-3 text-center', {
              children: [
                atom('Image', 'h-24 w-24 rounded-full object-cover', {
                  ratio: 'square',
                  alt: 'Photo of Mia Tanaka',
                }),
                el('div', 'flex flex-col', {
                  children: [
                    el('h3', 'font-semibold text-base-content', { text: 'Mia Tanaka' }),
                    el('p', 'text-sm text-base-content/60', { text: 'Lead Designer' }),
                  ],
                }),
                el('div', 'flex items-center gap-1', {
                  children: [
                    socialDot('linkedin', 'Mia on LinkedIn'),
                    socialDot('dribbble', 'Mia on Dribbble'),
                  ],
                }),
              ],
            }),
            el('article', 'flex flex-col items-center gap-3 text-center', {
              children: [
                atom('Image', 'h-24 w-24 rounded-full object-cover', {
                  ratio: 'square',
                  alt: 'Photo of Sam Okafor',
                }),
                el('div', 'flex flex-col', {
                  children: [
                    el('h3', 'font-semibold text-base-content', { text: 'Sam Okafor' }),
                    el('p', 'text-sm text-base-content/60', { text: 'Head of Engineering' }),
                  ],
                }),
                el('div', 'flex items-center gap-1', {
                  children: [
                    socialDot('linkedin', 'Sam on LinkedIn'),
                    socialDot('github', 'Sam on GitHub'),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Comparison table — features × plans, ✓ / — cells ──────────────────────────
  entry({
    key: 'comparison_table',
    name: 'Comparison table',
    category: 'marketing',
    kind: 'comprehensive',
    icon: 'table-2',
    description:
      'A feature comparison table — rows of capabilities across plan columns, each cell a check or a dash. Scrolls on narrow containers.',
    surfaces: ['page', 'site'],
    tags: ['comparison', 'table', 'plans', 'features', 'pricing', 'marketing'],
    tree: el('section', 'w-full px-4 py-16', {
      children: [
        el('div', 'mx-auto max-w-4xl', {
          children: [
            atom(
              'Heading',
              'mb-8 text-center text-3xl font-bold tracking-tight text-base-content',
              {
                level: 'h2',
                text: 'Compare every plan',
              }
            ),
            el('div', 'overflow-x-auto rounded-box border border-base-200', {
              children: [
                el('table', 'w-full min-w-lg border-collapse text-sm', {
                  children: [
                    el('thead', '', {
                      children: [
                        el('tr', 'bg-base-200', {
                          children: [
                            el('th', 'px-4 py-3 text-left font-semibold text-base-content', {
                              text: 'Feature',
                            }),
                            el('th', 'px-4 py-3 text-center font-semibold text-base-content', {
                              text: 'Starter',
                            }),
                            el('th', 'px-4 py-3 text-center font-semibold text-primary', {
                              text: 'Pro',
                            }),
                            el('th', 'px-4 py-3 text-center font-semibold text-base-content', {
                              text: 'Enterprise',
                            }),
                          ],
                        }),
                      ],
                    }),
                    el('tbody', '', {
                      children: [
                        el('tr', '', {
                          children: [
                            el(
                              'td',
                              'border-b border-base-200 px-4 py-3 font-medium text-base-content',
                              {
                                text: 'Published sites',
                              }
                            ),
                            el(
                              'td',
                              'border-b border-base-200 px-4 py-3 text-center text-base-content/70',
                              { text: '1' }
                            ),
                            el(
                              'td',
                              'border-b border-base-200 px-4 py-3 text-center text-base-content/70',
                              { text: '5' }
                            ),
                            el(
                              'td',
                              'border-b border-base-200 px-4 py-3 text-center text-base-content/70',
                              {
                                text: 'Unlimited',
                              }
                            ),
                          ],
                        }),
                        el('tr', '', {
                          children: [
                            el(
                              'td',
                              'border-b border-base-200 px-4 py-3 font-medium text-base-content',
                              {
                                text: 'Custom domain',
                              }
                            ),
                            cellNo(),
                            cellYes(),
                            cellYes(),
                          ],
                        }),
                        el('tr', '', {
                          children: [
                            el(
                              'td',
                              'border-b border-base-200 px-4 py-3 font-medium text-base-content',
                              {
                                text: 'Abandoned-cart recovery',
                              }
                            ),
                            cellNo(),
                            cellYes(),
                            cellYes(),
                          ],
                        }),
                        el('tr', '', {
                          children: [
                            el(
                              'td',
                              'border-b border-base-200 px-4 py-3 font-medium text-base-content',
                              {
                                text: 'Wholesale & net terms',
                              }
                            ),
                            cellNo(),
                            cellNo(),
                            cellYes(),
                          ],
                        }),
                        el('tr', '', {
                          children: [
                            el('td', 'px-4 py-3 font-medium text-base-content', {
                              text: 'SSO & audit logs',
                            }),
                            el('td', 'px-4 py-3 text-center text-base-content/30', { text: '—' }),
                            el('td', 'px-4 py-3 text-center text-base-content/30', { text: '—' }),
                            el('td', 'px-4 py-3 text-center text-success', { text: '✓' }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Announcement bar — slim highlight strip + inline link ─────────────────────
  entry({
    key: 'announcement_bar',
    name: 'Announcement bar',
    category: 'marketing',
    kind: 'common',
    icon: 'bell-ring',
    description:
      'A slim full-width highlight strip with a short message and an inline link — for a sale, launch, or notice.',
    surfaces: ['page', 'site'],
    tags: ['announcement', 'banner', 'notice', 'promo', 'bar', 'marketing'],
    tree: el('div', 'w-full bg-highlight px-4 py-2.5 text-highlight-content', {
      attrs: { role: 'region', ariaLabel: 'Announcement' },
      children: [
        el(
          'div',
          'mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm',
          {
            children: [
              atom('Icon', 'h-4 w-4 shrink-0', { name: 'sparkles' }),
              el('span', 'font-medium', {
                text: 'Spring sale is live — 20% off every plan through Sunday.',
              }),
              el(
                'a',
                'font-semibold underline underline-offset-2 transition-opacity hover:opacity-80',
                {
                  text: 'Claim the offer ›',
                  attrs: { href: '#' },
                }
              ),
            ],
          }
        ),
      ],
    }),
  }),

  // ── Feature split — alternating media + copy with a CTA ────────────────────────
  entry({
    key: 'feature_split',
    name: 'Feature split',
    category: 'marketing',
    kind: 'comprehensive',
    icon: 'columns-2',
    description:
      'A two-column feature block — supporting media beside a heading, body, checklist, and call to action. Stacks on a narrow container.',
    surfaces: ['page', 'site'],
    tags: ['feature', 'split', 'media', 'showcase', 'two column', 'marketing'],
    tree: el('section', 'w-full px-4 py-16', {
      children: [
        el('div', 'mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 @3xl:grid-cols-2', {
          children: [
            atom('Image', 'w-full rounded-box object-cover shadow-md', {
              ratio: 'wide',
              alt: 'The sparx storefront editor in action',
            }),
            el('div', 'flex flex-col items-start gap-5', {
              children: [
                atom('Badge', 'st-badge st-c-primary st-v-soft', { label: 'Storefront builder' }),
                atom(
                  'Heading',
                  'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl',
                  {
                    level: 'h2',
                    text: 'Design your store, your way',
                  }
                ),
                el('p', 'text-lg leading-relaxed text-base-content/70', {
                  text: 'Drag, drop, and theme every section with live brand controls. What you see in the editor is exactly what your customers get.',
                }),
                el('ul', 'flex flex-col gap-3', {
                  children: [
                    featureLine('Real-time brand theming across every page'),
                    featureLine('Responsive by default on every device'),
                    featureLine('Reusable sections you build once'),
                  ],
                }),
                atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-md', {
                  label: 'Explore the builder',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Bento grid — an asymmetric feature mosaic ─────────────────────────────────
  entry({
    key: 'bento_grid',
    name: 'Bento grid',
    category: 'marketing',
    kind: 'comprehensive',
    icon: 'layout-dashboard',
    description:
      'An asymmetric mosaic of feature tiles — wide and standard cells in a balanced grid that collapses to one column on a narrow container.',
    surfaces: ['page', 'site'],
    tags: ['bento', 'mosaic', 'features', 'grid', 'highlights', 'marketing'],
    tree: el('section', 'w-full px-4 py-16', {
      name: 'Bento grid',
      children: [
        el('div', 'mx-auto max-w-6xl', {
          children: [
            atom('Heading', 'mb-8 text-3xl font-bold tracking-tight text-base-content', {
              level: 'h2',
              text: 'Everything in one place',
            }),
            el('div', 'grid grid-cols-1 gap-4 @xl:grid-cols-3', {
              name: 'Tiles',
              children: [
                bentoCell(
                  '@xl:col-span-2',
                  'bg-primary text-primary-content',
                  'Build once, publish everywhere',
                  'Pages, posts, and products share one canvas — design a section and reuse it across every site you run.'
                ),
                bentoCell(
                  '',
                  'bg-base-200 text-base-content',
                  'Fast by default',
                  'Static-rendered and image-optimized out of the box.'
                ),
                bentoCell(
                  '',
                  'bg-base-200 text-base-content',
                  'Yours to own',
                  'Export your work anytime — no lock-in, no surprises.'
                ),
                bentoCell(
                  '@xl:col-span-2',
                  'bg-neutral text-neutral-content',
                  'Grows with you',
                  'Turn on commerce, email, or a CRM the day you need it — the rest stays out of your way.'
                ),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Video hero — a centered pitch above an embedded video ─────────────────────
  entry({
    key: 'video_hero',
    name: 'Video hero',
    category: 'marketing',
    kind: 'common',
    icon: 'circle-play',
    description:
      'A centered headline and call-to-action above a framed video embed — paste a video URL into the frame to bring it to life.',
    surfaces: ['page', 'site'],
    tags: ['video', 'hero', 'embed', 'demo', 'media', 'marketing'],
    tree: el('section', 'w-full px-4 py-20', {
      name: 'Video hero',
      children: [
        el('div', 'mx-auto flex max-w-3xl flex-col items-center gap-6 text-center', {
          children: [
            atom('Heading', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
              level: 'h2',
              text: 'See it in motion',
            }),
            atom('Text', 'text-lg text-base-content/70', {
              variant: 'body',
              text: 'A two-minute look at how it all fits together — from a blank canvas to a published, polished site.',
            }),
            atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-lg', { label: 'Start free' }),
          ],
        }),
        el('div', 'mx-auto mt-10 w-full max-w-4xl overflow-hidden rounded-box shadow-lg', {
          name: 'Video frame',
          children: [atom('Video', 'w-full', { ratio: 'wide', url: '' })],
        }),
      ],
    }),
  }),

  // ── How it works — three numbered steps ───────────────────────────────────────
  entry({
    key: 'process_steps',
    name: 'How it works',
    category: 'marketing',
    kind: 'common',
    icon: 'list-ordered',
    description:
      'A three-step “how it works” row — a numbered badge, heading, and a line of copy each, side by side and stacking on narrow containers.',
    surfaces: ['page', 'site'],
    tags: ['steps', 'process', 'how it works', 'onboarding', 'guide', 'marketing'],
    tree: el('section', 'w-full px-4 py-16', {
      name: 'How it works',
      children: [
        el('div', 'mx-auto max-w-5xl', {
          children: [
            atom(
              'Heading',
              'mb-10 text-center text-3xl font-bold tracking-tight text-base-content',
              { level: 'h2', text: 'Up and running in three steps' }
            ),
            el('div', 'grid grid-cols-1 gap-10 @2xl:grid-cols-3', {
              name: 'Steps',
              children: [
                stepItem(
                  '1',
                  'Create your space',
                  'Sign up and name your site — you are in the editor in under a minute.'
                ),
                stepItem(
                  '2',
                  'Add your content',
                  'Drop in sections, write your words, and connect products or posts.'
                ),
                stepItem(
                  '3',
                  'Publish and grow',
                  'Go live on your domain, then turn on what you need as you scale.'
                ),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Masonry gallery — a multi-column image wall ───────────────────────────────
  entry({
    key: 'gallery_masonry',
    name: 'Masonry gallery',
    category: 'marketing',
    kind: 'common',
    icon: 'images',
    description:
      'A multi-column image wall where photos keep their natural proportions — a portfolio or lookbook that reflows from one to three columns.',
    surfaces: ['page', 'site'],
    tags: ['gallery', 'masonry', 'portfolio', 'photos', 'lookbook', 'grid', 'marketing'],
    tree: el('section', 'w-full px-4 py-16', {
      name: 'Masonry gallery',
      children: [
        el('div', 'mx-auto max-w-5xl', {
          children: [
            atom('Heading', 'mb-8 text-3xl font-bold tracking-tight text-base-content', {
              level: 'h2',
              text: 'Selected work',
            }),
            el('div', 'columns-1 gap-4 @xl:columns-2 @3xl:columns-3', {
              name: 'Photos',
              children: [
                galleryImage('portrait'),
                galleryImage('square'),
                galleryImage('wide'),
                galleryImage('square'),
                galleryImage('portrait'),
                galleryImage('wide'),
              ],
            }),
          ],
        }),
      ],
    }),
  }),
];
