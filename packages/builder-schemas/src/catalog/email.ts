// Catalog · Email (docs/98 §3.6c, Email v2). Pre-composed blocks for the EMAIL
// surface — `surfaces: ['email']`, so they appear only in the email Add palette
// (catalogGroupsForSurface filters on this) and never leak into a page/site.
//
// Email is its own medium: NO raw HTML elements (the email palette is the curated
// EMAIL_TYPES allow-list), NO flex/grid CHILD positioning, NO states/breakpoints,
// NO behavior runtime. So these blocks are authored from NAMED nodes (`atom`) only,
// with BASE classes the email pipeline actually honors:
//   · containers (Section / Stack / Grid) carry `flex flex-col` / `grid grid-cols-N`
//     / `gap-N` / `p-N` / `bg-*` — the send (@sparx/email render-email-tree) parses
//     direction/columns/gap/padding into its Row/Column table layout, and inlines
//     bg/border/radius via classStyleFor;
//   · leaves (Heading / Text / Button) carry typography + color + alignment, which
//     `emailStyleFor` compiles to inline styles on both the canvas preview and the
//     send (so what the author sees is what ships).
// A `*:`-prefixed or arbitrary token would simply be dropped by the email compiler,
// so none are used here. The pinned `email_wordmark` header is auto-injected by
// `normalizeEmailTree`, so no header block exists here (a second one would dedupe).

import { atom, bound, entry, type PlatformCatalogEntry } from './_kit';

// A single product card for the promo grid — a slot image, a name, a price, and a
// shop link, stacked. Authored from named atoms (the email surface has no raw HTML).
const promoCard = (name: string, price: string) =>
  atom('Stack', 'flex flex-col gap-2', {}, [
    atom('ImageDisplay', 'rounded-lg', { ratio: 'square', alt: name }),
    atom('Text', 'text-base font-semibold text-base-content', { variant: 'body', text: name }),
    atom('Text', 'text-sm text-base-content/70', { variant: 'body', text: price }),
    atom('Button', 'bg-base-100 text-primary', { label: 'Shop', href: '#' }),
  ]);

export const EMAIL_CATALOG: PlatformCatalogEntry[] = [
  // ── Hero — tinted banner with a headline, a line of copy, and a CTA ───────────
  entry({
    key: 'email_hero',
    name: 'Hero',
    category: 'marketing',
    kind: 'common',
    icon: 'sparkles',
    description:
      'A tinted banner with a bold headline, a supporting line, and a call-to-action button — centered.',
    surfaces: ['email'],
    tags: ['hero', 'banner', 'announcement', 'promo', 'email'],
    tree: atom('Section', 'flex flex-col gap-3 rounded-lg bg-base-200 p-8 text-center', {}, [
      atom('Heading', 'text-2xl font-bold text-base-content', {
        level: 'h1',
        text: 'Big news for you',
      }),
      atom('Text', 'text-base text-base-content/70', {
        variant: 'body',
        text: 'A short, friendly line that sets up the offer and gives them a reason to read on.',
      }),
      atom('Button', '', { label: 'Shop the sale', href: '#' }),
    ]),
  }),

  // ── Content — a headline + two paragraphs + a link, the everyday body block ────
  entry({
    key: 'email_content',
    name: 'Content block',
    category: 'marketing',
    kind: 'common',
    icon: 'align-left',
    description:
      'A headline, a couple of body paragraphs, and a button — the workhorse email body.',
    surfaces: ['email'],
    tags: ['content', 'body', 'paragraph', 'text', 'email'],
    tree: atom('Section', 'flex flex-col gap-4 p-2', {}, [
      atom('Heading', 'text-xl font-semibold text-base-content', {
        level: 'h1',
        text: 'A clear, friendly headline',
      }),
      atom('Text', 'text-base text-base-content', {
        variant: 'body',
        text: 'Open with the one thing you want them to know. Keep it to a sentence or two so the message stays scannable in the inbox.',
      }),
      atom('Text', 'text-base text-base-content/80', {
        variant: 'body',
        text: 'Add any supporting detail here, then point them at a single, obvious next step.',
      }),
      atom('Button', '', { label: 'Learn more', href: '#' }),
    ]),
  }),

  // ── CTA — accent band with a contrasting button ───────────────────────────────
  entry({
    key: 'email_cta',
    name: 'CTA band',
    category: 'marketing',
    kind: 'common',
    icon: 'megaphone',
    description: 'A full-width accent band with a headline and a high-contrast call-to-action.',
    surfaces: ['email'],
    tags: ['cta', 'call to action', 'band', 'convert', 'email'],
    tree: atom('Section', 'flex flex-col gap-4 rounded-lg bg-primary p-8 text-center', {}, [
      atom('Heading', 'text-xl font-bold text-primary-content', {
        level: 'h1',
        text: 'Ready to get started?',
      }),
      atom('Text', 'text-base text-primary-content/90', {
        variant: 'body',
        text: 'One line of supporting copy that nudges them over the line.',
      }),
      // White button on the accent band — the class recolors the email CTA (the send
      // and canvas both honor bg/text from class) so it reads against the fill.
      atom('Button', 'bg-base-100 text-primary', { label: 'Get started', href: '#' }),
    ]),
  }),

  // ── Order summary — heading + bound line items + a total ───────────────────────
  entry({
    key: 'email_order_summary',
    name: 'Order summary',
    category: 'data-display',
    kind: 'comprehensive',
    icon: 'receipt',
    description:
      'A line-item table over the order/cart/quote/invoice items with a total — bound to `order.items` by default.',
    surfaces: ['email'],
    tags: ['order', 'summary', 'receipt', 'line items', 'invoice', 'total', 'email'],
    tree: atom('Section', 'flex flex-col gap-3 p-2', {}, [
      atom('Heading', 'text-base font-semibold text-base-content', {
        level: 'h2',
        text: 'Order summary',
      }),
      // Bound to the order line items (cart/quote/invoice are the other valid sources);
      // the canvas previews representative sample rows until it resolves.
      bound(atom('line_item_table', '', {}), 'order.items'),
      atom('Divider', '', {}),
      atom('Text', 'text-base font-semibold text-base-content text-right', {
        variant: 'body',
        text: 'Total: {{order.total}}',
      }),
    ]),
  }),

  // ── Promo grid — two product cards side by side ────────────────────────────────
  entry({
    key: 'email_promo_grid',
    name: 'Product grid',
    category: 'marketing',
    kind: 'comprehensive',
    icon: 'layout-grid',
    description: 'A two-column grid of product cards — image, name, price, and a shop link each.',
    surfaces: ['email'],
    tags: ['products', 'grid', 'showcase', 'featured', 'cross-sell', 'email'],
    tree: atom('Section', 'flex flex-col gap-4 p-2', {}, [
      atom('Heading', 'text-base font-semibold text-base-content', {
        level: 'h2',
        text: 'Featured picks',
      }),
      // grid-cols-2 → the send lays the cards out as a two-column Row of tables.
      atom('Grid', 'grid grid-cols-2 gap-4', {}, [
        promoCard('Product one', '$48.00'),
        promoCard('Product two', '$64.00'),
      ]),
    ]),
  }),

  // ── Footer — compliance block: divider, unsubscribe, mailing address ───────────
  entry({
    key: 'email_footer',
    name: 'Compliance footer',
    category: 'layout',
    kind: 'common',
    icon: 'panel-bottom',
    description:
      'The CAN-SPAM footer — a divider, a one-click unsubscribe link, and your mailing address. Required on marketing sends.',
    surfaces: ['email'],
    tags: ['footer', 'unsubscribe', 'compliance', 'can-spam', 'address', 'email'],
    tree: atom('Section', 'flex flex-col gap-2 p-2 text-center', {}, [
      atom('Divider', '', {}),
      atom('unsubscribe_link', '', {}),
      atom('physical_address', '', {}),
    ]),
  }),
];
