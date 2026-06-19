// Farm Fresh Bowls generator — reusable section builders shared across the layout +
// pages: the footer column label, the editorial split band, value/menu/step/location/
// testimonial cards, and the labeled menu group. Each returns a BuilderNode; they call
// node() when invoked (not at import), so the shared id counter only advances when
// manifest.ts assembles the trees.

import { node, type BuilderNode, type MenuItem } from './_kit';
import { emojiPanel } from './media';
import { CARD_CLS } from './theme';

/** A footer COLUMN label — the mockup's small, bold, uppercase, fern-green column
 *  heads (not a full h3): on the dark ink footer a default heading reads too big
 *  and washes into the body text, so these are a tight column label. */
export const footerHead = (text: string): BuilderNode =>
  node('Heading', {
    cls: 'text-xs font-bold uppercase tracking-widest text-[#7FA85B]',
    props: { level: 'h3', text },
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
  const photo = emojiPanel(opts.seed, 'md');
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

/** A value card (icon emoji in the heading + a one-liner). */
export const valueCard = (emoji: string, title: string, body: string): BuilderNode =>
  node('Card', {
    box: { surface: 'subtle', padding: 'lg', align: 'center' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'start' },
    children: [
      node('Heading', { box: { align: 'center' }, props: { level: 'h3', text: `${emoji}  ${title}` } }),
      node('Text', { box: { align: 'center' }, props: { variant: 'meta', text: body } }),
    ],
  });

/** A menu showcase card: photo header + name/price + description + tags. */
export const menuCard = (m: MenuItem): BuilderNode =>
  node('Card', {
    cls: `overflow-hidden ${CARD_CLS}`,
    box: { padding: 'none' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      emojiPanel(m.seed, 'sm'),
      node('Stack', {
        box: { padding: 'lg' },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
        children: [
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'row', justify: 'between', alignItems: 'center' },
            children: [
              node('Heading', { props: { level: 'h3', text: m.name } }),
              node('Text', { props: { variant: 'body', text: m.price } }),
            ],
          }),
          node('Text', { props: { variant: 'body', text: m.desc } }),
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

/** A labeled menu group: a left-aligned subhead over a full-width card grid (the
 *  mockup's "Açaí & Smoothie Bowls" / "Cold-Pressed Smoothies" / "Salads & Grain
 *  Bowls" sections). `backgroundWidth: full` forces `w-full` so the group spans the
 *  menu column even though the parent centers its children. */
export const menuGroup = (title: string, items: MenuItem[], cols: number): BuilderNode =>
  node('Stack', {
    box: { name: title, padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h3', text: title } }),
      node('Section', {
        box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
        layout: { direction: 'grid', columns: cols, gap: 'lg' },
        children: items.map(menuCard),
      }),
    ],
  });

/** A step card for "how it works" (text on the dark band). */
export const stepCard = (title: string, body: string): BuilderNode =>
  node('Stack', {
    box: { padding: 'none', align: 'center' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'start' },
    children: [
      node('Heading', { box: { align: 'center' }, props: { level: 'h3', text: title } }),
      node('Text', { box: { align: 'center' }, props: { variant: 'body', text: body } }),
    ],
  });

/** A location card: name + address + hours + actions. */
export const locationCard = (name: string, address: string, hours: string): BuilderNode =>
  node('Card', {
    cls: CARD_CLS,
    box: { padding: 'lg' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h3', text: name } }),
      node('Text', { props: { variant: 'body', text: address } }),
      node('Text', { props: { variant: 'meta', text: hours } }),
      node('Stack', {
        box: { padding: 'none' },
        layout: { direction: 'row', gap: 'sm' },
        children: [
          node('Button', { props: { label: 'Order Pickup', style: 'primary', href: '/menu' } }),
          node('Button', { props: { label: 'Directions', style: 'soft', href: '/locations' } }),
        ],
      }),
    ],
  });

/** A testimonial card. */
export const testimonialCard = (quote: string, who: string): BuilderNode =>
  node('Card', {
    cls: CARD_CLS,
    box: { padding: 'lg' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Text', { props: { variant: 'body', text: '★★★★★' } }),
      node('Text', { props: { variant: 'body', text: quote } }),
      node('Text', { props: { variant: 'meta', text: who } }),
    ],
  });
