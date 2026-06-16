// Catalog · Data display (docs/98 §5). Cards, stats, tables, timelines, lists.
//
// The "show me a record" family — every entry presents content the tenant already
// has (a product, a customer, an order, an activity feed) rather than navigating
// or collecting input. Each is a composed node tree of raw `el()` + named atoms,
// skinned with our token utilities: a card is a `rounded-box` figure, a stat row
// is a responsive grid, a data table is a real `<table>`. Interactivity that would
// normally need JS (accordions, "show more", carousels) is done CSS-natively with
// `<details>` and scroll-snap, exactly like navigation.ts.

import type { BuilderNode } from '../node';
import { el, atom, bound, entry, type PlatformCatalogEntry } from './_kit';

// A semantic badge pill — one of our color roles, soft-filled.
const pill = (label: string, color: string) =>
  el(
    'span',
    `inline-flex items-center rounded-selector bg-${color}/10 px-2.5 py-1 text-xs font-medium text-${color}`,
    {
      text: label,
    }
  );

// One filled or empty star glyph (static rating display).
const star = (filled: boolean) =>
  el('span', filled ? 'text-warning' : 'text-base-content/20', { text: '★' });

// A single keycap, styled like a physical key (no native <kbd> needed — a span
// wears the chrome; the contract whitelists `code`/`span` text tags).
const keycap = (glyph: string) =>
  el(
    'span',
    'inline-flex min-w-7 items-center justify-center rounded-field border border-base-300 bg-base-200 px-2 py-1 text-xs font-semibold text-base-content shadow-sm',
    { text: glyph }
  );

// One overlapping avatar in a stack — a colored initials circle, ringed against
// the surface so the overlap reads cleanly.
const avatarCircle = (initials: string, color: string) =>
  el(
    'span',
    `inline-flex h-10 w-10 items-center justify-center rounded-full bg-${color}/15 text-sm font-semibold text-${color} ring-2 ring-base-100`,
    { text: initials }
  );

export const DATA_DISPLAY_CATALOG: PlatformCatalogEntry[] = [
  // ── Card — image + title + body + actions ────────────────────────────────────
  entry({
    key: 'card',
    name: 'Card',
    category: 'data-display',
    kind: 'common',
    icon: 'square',
    description:
      'A vertical card — cover image, heading, supporting text, and an action. The workhorse content block.',
    surfaces: ['page', 'site'],
    tags: ['card', 'tile', 'panel', 'product', 'article', 'data-display'],
    tree: el(
      'article',
      'flex w-full max-w-sm flex-col overflow-hidden rounded-box border border-base-200 bg-base-100 shadow-sm',
      {
        children: [
          bound(
            atom('Image', 'w-full', { ratio: 'wide', alt: 'Card cover image' }),
            'product.image'
          ),
          el('div', 'flex flex-1 flex-col gap-2 p-5', {
            children: [
              bound(
                atom('Heading', 'text-lg font-semibold text-base-content', {
                  level: 'h3',
                  text: 'Trail-ready performance pack',
                }),
                'product.title'
              ),
              bound(
                atom('Text', 'text-sm text-base-content/70', {
                  variant: 'body',
                  text: 'Everything you need for the long haul — sealed bearings, a reinforced frame, and a five-year warranty.',
                }),
                'product.description'
              ),
              el('div', 'mt-3 flex items-center gap-3', {
                children: [
                  atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-sm', {
                    label: 'View details',
                  }),
                  el(
                    'a',
                    'text-sm font-medium text-base-content/60 transition-colors hover:text-primary',
                    {
                      text: 'Compare',
                      attrs: { href: '#' },
                    }
                  ),
                ],
              }),
            ],
          }),
        ],
      }
    ),
  }),

  // ── Card (horizontal) — image beside content, stacks when narrow ─────────────
  entry({
    key: 'card_horizontal',
    name: 'Card — horizontal',
    category: 'data-display',
    kind: 'common',
    icon: 'rectangle-horizontal',
    description:
      'A side-by-side card — image left, content right — that collapses to a stack on narrow containers.',
    surfaces: ['page', 'site'],
    tags: ['card', 'horizontal', 'media', 'list', 'data-display'],
    tree: el(
      'article',
      'flex w-full flex-col overflow-hidden rounded-box border border-base-200 bg-base-100 shadow-sm @3xl:flex-row',
      {
        children: [
          atom('Image', 'w-full shrink-0 @3xl:w-56', { ratio: 'wide', alt: 'Card cover image' }),
          el('div', 'flex flex-1 flex-col justify-center gap-2 p-5', {
            children: [
              el('div', 'flex items-center gap-2', {
                children: [pill('In stock', 'success')],
              }),
              atom('Heading', 'text-lg font-semibold text-base-content', {
                level: 'h3',
                text: 'Fleet maintenance plan',
              }),
              atom('Text', 'text-sm text-base-content/70', {
                variant: 'body',
                text: 'Scheduled service across every vehicle, billed monthly with priority bay access and loaner coverage.',
              }),
              el('div', 'mt-2', {
                children: [
                  atom('Button', 'st-btn st-c-primary st-v-soft st-btn--sz-sm', {
                    label: 'Learn more',
                  }),
                ],
              }),
            ],
          }),
        ],
      }
    ),
  }),

  // ── Stat row — three figures in a responsive grid with dividers ──────────────
  entry({
    key: 'stat_row',
    name: 'Stat row',
    category: 'data-display',
    kind: 'common',
    icon: 'bar-chart-3',
    description:
      'A row of key figures — value over label — that wraps from three columns to one on narrow containers.',
    surfaces: ['page', 'site'],
    tags: ['stats', 'metrics', 'kpi', 'figures', 'data-display'],
    tree: el(
      'dl',
      'grid w-full grid-cols-1 gap-px overflow-hidden rounded-box border border-base-200 bg-base-200 @2xl:grid-cols-3',
      {
        children: [
          el('div', 'flex flex-col gap-1 bg-base-100 p-6', {
            children: [atom('Stat', '', { value: '12,480', label: 'Orders shipped' })],
          }),
          el('div', 'flex flex-col gap-1 bg-base-100 p-6', {
            children: [atom('Stat', '', { value: '99.2%', label: 'On-time delivery' })],
          }),
          el('div', 'flex flex-col gap-1 bg-base-100 p-6', {
            children: [atom('Stat', '', { value: '4.9 / 5', label: 'Customer rating' })],
          }),
        ],
      }
    ),
  }),

  // ── Badge row — semantic pills across the color roles ────────────────────────
  entry({
    key: 'badge_row',
    name: 'Badge row',
    category: 'data-display',
    kind: 'common',
    icon: 'tags',
    description: 'A wrapping row of status badges spanning the semantic color roles.',
    surfaces: ['page', 'site'],
    tags: ['badge', 'pill', 'tag', 'status', 'label', 'data-display'],
    tree: el('div', 'flex w-full flex-wrap items-center gap-2', {
      children: [
        atom('Badge', 'st-badge st-c-primary st-v-soft', { label: 'Featured' }),
        atom('Badge', 'st-badge st-c-success st-v-soft', { label: 'In stock' }),
        atom('Badge', 'st-badge st-c-warning st-v-soft', { label: 'Low stock' }),
        atom('Badge', 'st-badge st-c-danger st-v-soft', { label: 'Backordered' }),
        atom('Badge', 'st-badge st-c-neutral st-v-soft', { label: 'Archived' }),
      ],
    }),
  }),

  // ── Avatar group — overlapping circles + an overflow chip ────────────────────
  entry({
    key: 'avatar_group',
    name: 'Avatar group',
    category: 'data-display',
    kind: 'common',
    icon: 'users',
    description: 'A stack of overlapping member avatars with a trailing overflow count.',
    surfaces: ['page', 'site'],
    tags: ['avatar', 'group', 'team', 'members', 'stack', 'data-display'],
    tree: el('div', 'flex w-full items-center gap-3', {
      children: [
        // The negative left margin on each circle after the first creates the overlap.
        el('div', 'flex items-center -space-x-3', {
          children: [
            avatarCircle('JM', 'primary'),
            avatarCircle('AR', 'accent'),
            avatarCircle('TK', 'info'),
            avatarCircle('LP', 'success'),
            el(
              'span',
              'inline-flex h-10 w-10 items-center justify-center rounded-full bg-base-200 text-xs font-semibold text-base-content ring-2 ring-base-100',
              { text: '+5' }
            ),
          ],
        }),
        el('span', 'text-sm text-base-content/70', { text: '9 people on this account' }),
      ],
    }),
  }),

  // ── Accordion — native <details>, CSS-only chevron rotate ────────────────────
  entry({
    key: 'accordion',
    name: 'Accordion',
    category: 'data-display',
    kind: 'common',
    icon: 'chevron-down',
    description:
      'A stack of expandable panels built on native disclosure — no scripting. The chevron rotates as each opens.',
    surfaces: ['page', 'site'],
    tags: ['accordion', 'faq', 'disclosure', 'expand', 'collapse', 'data-display'],
    tree: el(
      'div',
      'flex w-full flex-col divide-y divide-base-200 overflow-hidden rounded-box border border-base-200 bg-base-100',
      {
        children: [
          accordionItem(
            'How does billing work?',
            'You pay only for the modules you activate, prorated to the day. Switch plans or pause any time from the dashboard.',
            true
          ),
          accordionItem(
            'Can I bring my own domain?',
            'Yes. Point your domain at us and we issue and renew the certificate automatically — no manual DNS juggling.',
            false
          ),
          accordionItem(
            'Do you offer wholesale pricing?',
            'B2B accounts unlock tiered price lists, net terms, and a dedicated buyer portal once the wholesale module is enabled.',
            false
          ),
        ],
      }
    ),
  }),

  // ── Data table — a real table with header + zebra rows ───────────────────────
  entry({
    key: 'data_table',
    name: 'Data table',
    category: 'data-display',
    kind: 'common',
    icon: 'table',
    description:
      'A semantic table with a header row and zebra-striped body rows for tabular records.',
    surfaces: ['page', 'site'],
    tags: ['table', 'grid', 'rows', 'records', 'data-display'],
    tree: el('div', 'w-full overflow-x-auto rounded-box border border-base-200', {
      children: [
        el('table', 'w-full border-collapse text-left text-sm', {
          children: [
            el('thead', 'bg-base-200 text-xs font-semibold text-base-content/70', {
              children: [
                el('tr', '', {
                  children: [
                    el('th', 'px-4 py-3', { text: 'Order', attrs: { scope: 'col' } }),
                    el('th', 'px-4 py-3', { text: 'Customer', attrs: { scope: 'col' } }),
                    el('th', 'px-4 py-3', { text: 'Status', attrs: { scope: 'col' } }),
                    el('th', 'px-4 py-3 text-right', { text: 'Total', attrs: { scope: 'col' } }),
                  ],
                }),
              ],
            }),
            el('tbody', 'divide-y divide-base-200 text-base-content', {
              children: [
                tableRow('#10428', 'Marcus Reyes', pill('Paid', 'success'), '$248.00', false),
                tableRow(
                  '#10427',
                  'Dana Whitfield',
                  pill('Processing', 'warning'),
                  '$1,120.50',
                  true
                ),
                tableRow('#10426', 'Owen Castillo', pill('Refunded', 'danger'), '$64.00', false),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Vertical timeline — dots, connecting line, dated entries ─────────────────
  entry({
    key: 'timeline_vertical',
    name: 'Timeline (vertical)',
    category: 'data-display',
    kind: 'common',
    icon: 'git-commit-vertical',
    description:
      'A vertical activity timeline — dotted markers on a connecting rail with dated entries.',
    surfaces: ['page', 'site'],
    tags: ['timeline', 'activity', 'history', 'feed', 'log', 'data-display'],
    tree: el('ol', 'flex w-full flex-col', {
      children: [
        timelineEntry(
          'Order placed',
          'Jun 2',
          'Marcus submitted a 14-line order from the wholesale portal.',
          'primary',
          false
        ),
        timelineEntry(
          'Payment captured',
          'Jun 2',
          'Net-30 invoice generated and emailed to accounts payable.',
          'success',
          false
        ),
        timelineEntry(
          'Shipment scheduled',
          'Jun 4',
          'Two pallets booked with the carrier for Thursday pickup.',
          'info',
          true
        ),
      ],
    }),
  }),

  // ── Chat thread — incoming + outgoing bubbles ────────────────────────────────
  entry({
    key: 'chat_thread',
    name: 'Chat thread',
    category: 'data-display',
    kind: 'common',
    icon: 'messages-square',
    description:
      'A short conversation — incoming bubble on the left, outgoing on the right, each with sender and time.',
    surfaces: ['page', 'site'],
    tags: ['chat', 'message', 'conversation', 'bubble', 'support', 'data-display'],
    tree: el('div', 'flex w-full flex-col gap-4', {
      children: [
        // Incoming — avatar leads, bubble aligned left.
        el('div', 'flex items-end gap-3', {
          children: [
            avatarCircle('SR', 'info'),
            el('div', 'flex max-w-md flex-col gap-1', {
              children: [
                el('div', 'flex items-center gap-2', {
                  children: [
                    el('span', 'text-sm font-medium text-base-content', { text: 'Sasha Rivera' }),
                    el('span', 'text-xs text-base-content/50', { text: '9:41 AM' }),
                  ],
                }),
                el(
                  'div',
                  'rounded-box rounded-bl-sm bg-base-200 px-4 py-2.5 text-sm text-base-content',
                  {
                    text: 'Hey! Are the new brake kits back in stock yet?',
                  }
                ),
              ],
            }),
          ],
        }),
        // Outgoing — pushed right, brand-filled bubble, avatar trails.
        el('div', 'flex flex-row-reverse items-end gap-3', {
          children: [
            avatarCircle('YO', 'primary'),
            el('div', 'flex max-w-md flex-col items-end gap-1', {
              children: [
                el('div', 'flex items-center gap-2', {
                  children: [
                    el('span', 'text-xs text-base-content/50', { text: '9:43 AM' }),
                    el('span', 'text-sm font-medium text-base-content', { text: 'You' }),
                  ],
                }),
                el(
                  'div',
                  'rounded-box rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-content',
                  {
                    text: 'Just restocked this morning — want me to set two aside for you?',
                  }
                ),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Keyboard shortcut — styled keycaps ───────────────────────────────────────
  entry({
    key: 'kbd_shortcut',
    name: 'Keyboard shortcut',
    category: 'data-display',
    kind: 'common',
    icon: 'command',
    description:
      'Inline keycaps describing a shortcut, with a label and a join glyph between keys.',
    surfaces: ['page', 'site'],
    tags: ['kbd', 'shortcut', 'keys', 'hotkey', 'keyboard', 'data-display'],
    tree: el('div', 'flex w-full flex-wrap items-center gap-2 text-sm text-base-content/70', {
      children: [
        el('span', '', { text: 'Open the command palette' }),
        el('span', 'inline-flex items-center gap-1', {
          children: [keycap('⌘'), el('span', 'text-base-content/40', { text: '+' }), keycap('K')],
        }),
      ],
    }),
  }),

  // ── Rating stars — static five-star display ──────────────────────────────────
  entry({
    key: 'rating_stars',
    name: 'Rating stars',
    category: 'data-display',
    kind: 'common',
    icon: 'star',
    description: 'A static five-star rating with filled stars and a review count beside it.',
    surfaces: ['page', 'site'],
    tags: ['rating', 'stars', 'review', 'score', 'data-display'],
    tree: el('div', 'flex w-full items-center gap-2', {
      children: [
        el('div', 'flex items-center gap-0.5 text-lg leading-none', {
          children: [star(true), star(true), star(true), star(true), star(false)],
        }),
        el('span', 'text-sm font-medium text-base-content', { text: '4.0' }),
        el('span', 'text-sm text-base-content/50', { text: '(218 reviews)' }),
      ],
    }),
  }),

  // ── Carousel — horizontal scroll-snap row of cards (CSS-only) ────────────────
  entry({
    key: 'carousel_scroll',
    name: 'Carousel (scroll)',
    category: 'data-display',
    kind: 'comprehensive',
    icon: 'gallery-horizontal',
    description:
      'A horizontal scroll-snap rail of cards — swipe or scroll to advance, no scripting required.',
    surfaces: ['page', 'site'],
    tags: ['carousel', 'slider', 'scroll', 'gallery', 'snap', 'data-display'],
    tree: el('div', 'flex w-full snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2', {
      children: [
        carouselCard('Mountain series', 'Built for elevation and abuse.'),
        carouselCard('City series', 'Quiet, light, and quick to fold.'),
        carouselCard('Cargo series', 'Haul the week in one trip.'),
        carouselCard('Trail series', 'Grip where the pavement ends.'),
      ],
    }),
  }),

  // ── Collapse — single "show more" disclosure ─────────────────────────────────
  entry({
    key: 'collapse',
    name: 'Collapse',
    category: 'data-display',
    kind: 'common',
    icon: 'chevrons-down-up',
    description:
      'A single native disclosure that reveals more detail on click — a tidy "show more".',
    surfaces: ['page', 'site'],
    tags: ['collapse', 'show more', 'disclosure', 'expand', 'details', 'data-display'],
    tree: el('details', 'group w-full rounded-box border border-base-200 bg-base-100 p-5', {
      attrs: { open: true },
      children: [
        el(
          'summary',
          'flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-base-content [&::-webkit-details-marker]:hidden',
          {
            children: [
              el('span', '', { text: 'Shipping & returns' }),
              el('span', 'text-base-content/50 transition-transform group-open:rotate-180', {
                text: '⌄',
              }),
            ],
          }
        ),
        atom('Text', 'mt-3 text-sm text-base-content/70', {
          variant: 'body',
          text: 'Orders ship within one business day. Returns are accepted within 30 days in original condition — we cover return shipping on defects.',
        }),
      ],
    }),
  }),

  // ── Description list — labeled key/value detail rows ──────────────────────────
  entry({
    key: 'description_list',
    name: 'Description list',
    category: 'data-display',
    kind: 'common',
    icon: 'list',
    description:
      'A semantic term/detail list for record attributes — label left, value right, ruled between rows.',
    surfaces: ['page', 'site'],
    tags: ['description', 'detail', 'attributes', 'spec', 'key value', 'data-display'],
    tree: el(
      'dl',
      'flex w-full flex-col divide-y divide-base-200 rounded-box border border-base-200 bg-base-100',
      {
        children: [
          descRow('SKU', 'GDS-4420-XL'),
          descRow('Material', 'Forged 6061 aluminum'),
          descRow('Weight', '2.4 kg'),
          descRow('Warranty', '5 years, parts and labor'),
        ],
      }
    ),
  }),

  // ── Feature list — icon + text rows ──────────────────────────────────────────
  entry({
    key: 'feature_list',
    name: 'Feature list',
    category: 'data-display',
    kind: 'common',
    icon: 'list-checks',
    description:
      'A vertical list of benefits, each led by a check icon — for plan inclusions and spec highlights.',
    surfaces: ['page', 'site'],
    tags: ['features', 'benefits', 'checklist', 'inclusions', 'list', 'data-display'],
    tree: el('ul', 'flex w-full flex-col gap-3', {
      children: [
        featureRow('Unlimited products and collections'),
        featureRow('Automatic domain SSL and renewal'),
        featureRow('Built-in CRM with order history'),
        featureRow('Priority email and chat support'),
      ],
    }),
  }),
];

// ── Local composers (kept below the catalog, like navigation.ts's link helpers) ─

// One accordion panel — a native <details>; the chevron rotates via group-open.
function accordionItem(question: string, answer: string, open: boolean): BuilderNode {
  return el('details', 'group', {
    attrs: open ? { open: true } : {},
    children: [
      el(
        'summary',
        'flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-base-content hover:bg-base-200 [&::-webkit-details-marker]:hidden',
        {
          children: [
            el('span', '', { text: question }),
            el('span', 'shrink-0 text-base-content/50 transition-transform group-open:rotate-180', {
              text: '⌄',
            }),
          ],
        }
      ),
      el('div', 'px-5 pb-4 text-sm text-base-content/70', { text: answer }),
    ],
  });
}

// One table body row — zebra shading optional via the `striped` flag.
function tableRow(
  order: string,
  customer: string,
  status: BuilderNode,
  total: string,
  striped: boolean
): BuilderNode {
  return el('tr', striped ? 'bg-base-200/40' : '', {
    children: [
      el('td', 'px-4 py-3 font-medium', { text: order }),
      el('td', 'px-4 py-3', { text: customer }),
      el('td', 'px-4 py-3', { children: [status] }),
      el('td', 'px-4 py-3 text-right font-semibold', { text: total }),
    ],
  });
}

// One timeline entry — marker + connecting rail on the left, content on the right.
// The rail is hidden on the last entry so the line stops at the final dot.
function timelineEntry(
  title: string,
  date: string,
  body: string,
  color: string,
  last: boolean
): BuilderNode {
  // Marker column: a dot, plus the connecting rail on every entry but the last.
  const marker = [
    el('span', `mt-1 h-3 w-3 shrink-0 rounded-full bg-${color} ring-4 ring-${color}/15`, {}),
  ];
  if (!last) marker.push(el('span', 'mt-1 w-px flex-1 bg-base-300', {}));
  return el('li', 'flex gap-4', {
    children: [
      el('div', 'flex flex-col items-center', { children: marker }),
      el('div', last ? 'pb-1' : 'pb-6', {
        children: [
          el('div', 'flex flex-wrap items-baseline gap-2', {
            children: [
              el('p', 'text-sm font-semibold text-base-content', { text: title }),
              el('time', 'text-xs text-base-content/50', {
                text: date,
                attrs: { datetime: '2026-06' },
              }),
            ],
          }),
          el('p', 'mt-1 text-sm text-base-content/70', { text: body }),
        ],
      }),
    ],
  });
}

// One card in the horizontal carousel rail — snaps to its start, never shrinks.
function carouselCard(title: string, body: string): BuilderNode {
  return el(
    'article',
    'flex w-72 shrink-0 snap-start flex-col overflow-hidden rounded-box border border-base-200 bg-base-100 shadow-sm',
    {
      children: [
        atom('Image', 'w-full', { ratio: 'wide', alt: `${title} cover` }),
        el('div', 'flex flex-col gap-1 p-4', {
          children: [
            el('p', 'text-base font-semibold text-base-content', { text: title }),
            el('p', 'text-sm text-base-content/70', { text: body }),
          ],
        }),
      ],
    }
  );
}

// One term/detail pair in the description list.
function descRow(term: string, detail: string): BuilderNode {
  return el('div', 'flex items-baseline justify-between gap-4 px-5 py-3', {
    children: [
      el('dt', 'text-sm text-base-content/60', { text: term }),
      el('dd', 'text-sm font-medium text-base-content', { text: detail }),
    ],
  });
}

// One check-led feature row.
function featureRow(text: string): BuilderNode {
  return el('li', 'flex items-start gap-3', {
    children: [
      el(
        'span',
        'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-xs font-bold text-success',
        { text: '✓' }
      ),
      el('span', 'text-sm text-base-content', { text }),
    ],
  });
}
