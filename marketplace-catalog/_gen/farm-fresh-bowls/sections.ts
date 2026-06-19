// Farm Fresh generator — reusable section builders shared across the layout +
// pages: the footer column label, the editorial split band, value/menu/step/location/
// testimonial cards, and the labeled menu group. Each returns a BuilderNode; they call
// node() when invoked (not at import), so the shared id counter only advances when
// manifest.ts assembles the trees. Class strings track docs/mockups/examples/
// farmfreshbowls.html (berry = accent, leaf = primary, mango = secondary, sage =
// base-200, fern = #7FA85B which has no token).

import { node, type BuilderNode, type MenuItem } from './_kit';
import { cardPhoto, emojiOf, emojiPanel, emojiSurface } from './media';
import { CARD_CLS } from './theme';

/** A footer COLUMN label — the mockup's small, bold, uppercase, fern-green column
 *  heads (not a full h3): on the dark ink footer a default heading reads too big
 *  and washes into the body text, so these are a tight column label. */
export const footerHead = (text: string): BuilderNode =>
  node('Heading', {
    cls: 'text-xs font-bold uppercase tracking-widest text-[#7FA85B]',
    props: { level: 'h3', text },
  });

/** A small round emoji "icon" badge (value strip, how-it-works steps, testimonial
 *  avatars): a colored circle with a centered emoji. The badge IS a single Text node
 *  (the emoji is its content, the circle is its box) — a Section/Stack would pick up
 *  box→class's contained-band `w-full max-w-site` and stretch to the column. `sizeCls`
 *  is the diameter (`h-16 w-16`), `bgCls` the fill, `emojiCls` the glyph size. */
const emojiBadge = (emoji: string, sizeCls: string, bgCls: string, emojiCls: string): BuilderNode =>
  node('Text', {
    cls: `${sizeCls} ${bgCls} ${emojiCls} shrink-0 inline-flex items-center justify-center rounded-full leading-none`,
    props: { variant: 'body', text: emoji },
  });

/** A "split" band: text column + photo column, optionally photo-first. The mockup's
 *  editorial heads are LARGE (≈46px), display-weight, and brand-colored (berry for
 *  "We Really Do Care", leaf for "We Love For You To"), each over a short accent
 *  hairline — `accent` picks the brand role for both the rule and the heading. */
export function splitBand(opts: {
  name: string;
  surface?: 'none' | 'subtle' | 'muted';
  heading: string;
  accent?: 'accent' | 'primary';
  paragraphs: string[];
  seed: string;
  photoFirst?: boolean;
  cta?: { label: string; href: string };
}): BuilderNode {
  const accent = opts.accent ?? 'accent';
  const text = node('Stack', {
    box: { padding: 'none' },
    layout: { direction: 'stack', gap: 'md', alignItems: 'start', justify: 'center' },
    children: [
      // Accent hairline (mockup `.hairline`): a short 3px brand-colored rule.
      node('Section', { cls: `h-[3px] w-16 rounded-full bg-${accent}`, box: { padding: 'none' } }),
      node('Heading', {
        cls: `text-4xl @3xl:text-5xl font-bold leading-tight text-${accent}`,
        props: { level: 'h2', text: opts.heading },
      }),
      ...opts.paragraphs.map((t) => node('Text', { props: { variant: 'body', text: t } })),
      ...(opts.cta
        ? [node('Button', { props: { label: opts.cta.label, style: 'primary', href: opts.cta.href } })]
        : []),
    ],
  });
  const photo = emojiPanel(opts.seed);
  return node('Section', {
    box: {
      name: opts.name,
      surface: opts.surface ?? 'none',
      padding: 'xl',
      backgroundWidth: 'full',
      contentWidth: 'contained',
    },
    layout: { direction: 'grid', columns: 2, gap: 'lg', alignItems: 'center' },
    children: opts.photoFirst ? [photo, text] : [text, photo],
  });
}

/** A value cell (mockup values strip): a centered round sage badge with the emoji,
 *  then an 18px title and a small muted caption. NOT a card — centered content. */
export const valueCard = (emoji: string, title: string, body: string): BuilderNode =>
  node('Stack', {
    box: { padding: 'none', align: 'center' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'start' },
    children: [
      emojiBadge(emoji, 'h-16 w-16', 'bg-base-200', 'text-3xl'),
      node('Heading', { box: { align: 'center' }, cls: 'text-lg', props: { level: 'h3', text: title } }),
      node('Text', { box: { align: 'center' }, cls: 'text-sm', props: { variant: 'meta', text: body } }),
    ],
  });

/** A menu showcase card: fixed-height photo header + name/berry-price row + small
 *  description + tags. `photoH` is the mockup's fixed header height (`h-48`/`h-40`). */
export const menuCard = (m: MenuItem, photoH: string): BuilderNode =>
  node('Card', {
    cls: `overflow-hidden ${CARD_CLS}`,
    box: { padding: 'none' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      cardPhoto(m.seed, photoH),
      node('Stack', {
        box: { padding: 'md' },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
        children: [
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'row', justify: 'between', alignItems: 'start' },
            children: [
              node('Heading', { cls: 'text-xl', props: { level: 'h3', text: m.name } }),
              node('Text', {
                cls: 'text-accent font-extrabold text-lg whitespace-nowrap',
                props: { variant: 'body', text: m.price },
              }),
            ],
          }),
          node('Text', { cls: 'text-sm leading-relaxed', props: { variant: 'body', text: m.desc } }),
          ...(m.tags.length
            ? [
                node('Stack', {
                  box: { padding: 'none' },
                  layout: { direction: 'row', gap: 'sm', wrap: true },
                  children: m.tags.map((t) => node('Badge', { props: { label: t } })),
                }),
              ]
            : []),
        ],
      }),
    ],
  });

/** A labeled menu group: a leaf subhead over a full-width card grid. `photoH` flows
 *  to each card's header height so a group can run shorter cards (smoothies). */
export const menuGroup = (
  title: string,
  items: MenuItem[],
  cols: number,
  photoH: string
): BuilderNode =>
  node('Stack', {
    box: { name: title, padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
    children: [
      node('Heading', { cls: 'text-primary text-2xl', props: { level: 'h3', text: title } }),
      node('Section', {
        box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
        layout: { direction: 'grid', columns: cols, gap: 'lg' },
        children: items.map((m) => menuCard(m, photoH)),
      }),
    ],
  });

/** A step card for "how it works" (text on the dark band): a fern-tinted emoji
 *  circle over a numbered title + a short line. */
export const stepCard = (emoji: string, title: string, body: string): BuilderNode =>
  node('Stack', {
    box: { padding: 'none', align: 'center' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'start' },
    children: [
      emojiBadge(emoji, 'h-20 w-20', 'bg-[#7FA85B]/25', 'text-4xl'),
      node('Heading', { box: { align: 'center' }, cls: 'text-xl text-white', props: { level: 'h3', text: title } }),
      node('Text', {
        box: { align: 'center' },
        cls: 'text-[15px] leading-relaxed text-[#E8EEDF]',
        props: { variant: 'body', text: body },
      }),
    ],
  });

/** A location card (locations teaser): a HORIZONTAL card — emoji photo on the left
 *  (stacks on top below @3xl), leaf name + address + hours + actions on the right. */
export const locationCard = (
  name: string,
  address: string,
  hours: string,
  seed: string
): BuilderNode =>
  node('Card', {
    cls: `overflow-hidden ${CARD_CLS}`,
    box: { padding: 'none' },
    layout: { direction: 'row' },
    children: [
      node('Section', {
        // shrink-0: hold the 2/5 width — as a flex item it would otherwise collapse
        // to the emoji's content width next to the growing content column.
        cls: 'h-40 @3xl:h-auto w-full @3xl:w-2/5 shrink-0 rounded-b-none',
        box: {
          surface: emojiSurface(seed),
          align: 'center',
          backgroundWidth: 'full',
          contentWidth: 'full',
          padding: 'none',
        },
        layout: { direction: 'stack', gap: 'none', alignItems: 'center', justify: 'center' },
        children: [
          node('Text', { cls: 'text-6xl leading-none', props: { variant: 'body', text: emojiOf(seed) } }),
        ],
      }),
      node('Stack', {
        // min-w-0: a flex item defaults to min-width:auto and won't shrink below its
        // text's intrinsic width — without this the content overflows the card's right
        // edge (and overflow-hidden clips the address/buttons).
        cls: 'flex-1 min-w-0',
        box: { padding: 'lg' },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
        children: [
          node('Heading', { cls: 'text-primary text-xl', props: { level: 'h3', text: name } }),
          node('Text', { cls: 'text-sm', props: { variant: 'body', text: address } }),
          node('Text', { cls: 'text-sm', props: { variant: 'meta', text: hours } }),
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'row', gap: 'sm', wrap: true },
            children: [
              node('Button', { props: { label: 'Order Pickup', style: 'primary', href: '/menu' } }),
              node('Button', { props: { label: 'Directions', style: 'soft', href: '/locations' } }),
            ],
          }),
        ],
      }),
    ],
  });

/** A testimonial card: a mango star row, an italic quote, then an avatar emoji badge
 *  beside the reviewer's name + location. */
export const testimonialCard = (
  quote: string,
  name: string,
  location: string,
  emoji: string
): BuilderNode =>
  node('Card', {
    cls: CARD_CLS,
    box: { padding: 'lg' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Text', { cls: 'text-secondary text-lg', props: { variant: 'body', text: '★★★★★' } }),
      node('Text', { cls: 'italic leading-relaxed', props: { variant: 'body', text: quote } }),
      node('Stack', {
        box: { padding: 'none' },
        layout: { direction: 'row', gap: 'sm', alignItems: 'center' },
        children: [
          emojiBadge(emoji, 'h-10 w-10', 'bg-base-200', 'text-lg'),
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'stack', gap: 'none', alignItems: 'start' },
            children: [
              node('Text', { cls: 'font-extrabold', props: { variant: 'body', text: name } }),
              node('Text', { cls: 'text-xs', props: { variant: 'meta', text: location } }),
            ],
          }),
        ],
      }),
    ],
  });
