// Farm Fresh generator — imagery + the emoji "photo" panel. `photoSvg()` builds a
// self-contained data-URI product image (a brand-coloured panel + the food emoji);
// `emojiPanel()` is the mockup's `.photo` block — a rounded colored panel with a big
// centered food emoji, used by the section builders. Both are 100% reliable: no
// remote load means no throttled / failed placeholder (a remote photo service
// returned solid-colour error blocks for ~⅓ of the catalog — never on a gold
// standard). The tenant swaps these for real photography post-install.

import { node, type BuilderNode } from './_kit';
import { BERRY, LEAF, MANGO, SAGE } from './theme';

/** The brand hex behind each PANEL_SURFACE role — the data-URI panel can't read the
 *  tenant `--st-*` vars (it renders in an isolated <img> context), so it bakes the
 *  blueprint's own palette, matching what the home cards paint via their surface. */
const SURFACE_HEX: Record<PanelSurface, string> = {
  accent: BERRY,
  brand: LEAF,
  secondary: MANGO,
  subtle: SAGE,
};

/** A product "photo" as a self-contained SVG data URI: the food's brand-surface
 *  colour with its big food emoji centred — the same look the home menu cards paint,
 *  but as a real image so a bound `item.images` (Menu grid, product detail) renders
 *  it. No network, so it always resolves. */
export const photoSvg = (seed: string): string => {
  const fill = SURFACE_HEX[emojiSurface(seed)];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">` +
    `<rect width="800" height="800" fill="${fill}"/>` +
    `<text x="400" y="400" font-size="420" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${emojiOf(seed)}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// Mockup-style "photo" = a rounded colored panel with a big food emoji centered
// (the example's `.photo` blocks are exactly this: a gradient + a `.emoji`). No
// remote image, so it's 100% reliable — never a throttled placeholder. The surface
// picks a brand colour per food; the emoji carries the subject.
type PanelSurface = 'subtle' | 'brand' | 'accent' | 'secondary';
const PANEL_EMOJI: Record<string, string> = {
  care: '🍓',
  love: '🥣',
  'story-care': '🥗',
  'story-food': '🥣',
  acai: '🥣',
  strawberry: '🍓',
  green: '🥝',
  mango: '🥭',
  blueberry: '🫐',
  citrus: '🍊',
  coconut: '🥥',
  kale: '🥗',
  avocado: '🥑',
  southwest: '🌽',
};
const PANEL_SURFACE: Record<string, PanelSurface> = {
  care: 'accent',
  love: 'subtle',
  'story-care': 'brand',
  'story-food': 'subtle',
  acai: 'accent',
  strawberry: 'accent',
  green: 'brand',
  mango: 'secondary',
  blueberry: 'subtle',
  citrus: 'secondary',
  coconut: 'subtle',
  kale: 'brand',
  avocado: 'brand',
  southwest: 'secondary',
};
export const emojiOf = (seed: string): string => PANEL_EMOJI[seed] ?? '🥣';
export const emojiSurface = (seed: string): PanelSurface => PANEL_SURFACE[seed] ?? 'subtle';

/** A standalone decorative emoji "photo" band (the split-band photo column): a
 *  rounded colored panel with a big centered food emoji. A FIXED 300px tall — NOT
 *  the box `height` scale (`min-h-[50vh]`), which is viewport-relative and made the
 *  editorial image cards balloon on tall screens. */
export const emojiPanel = (seed: string): BuilderNode =>
  node('Section', {
    cls: 'h-[300px]',
    box: {
      surface: emojiSurface(seed),
      align: 'center',
      backgroundWidth: 'contained',
      contentWidth: 'full',
      padding: 'lg',
    },
    layout: { direction: 'stack', gap: 'none', alignItems: 'center', justify: 'center' },
    children: [
      node('Heading', {
        box: { align: 'center' },
        props: { level: 'h1', size: 'display', text: emojiOf(seed) },
      }),
    ],
  });

/** A menu-card photo header (mockup `.photo h-48 rounded-t-[28px]`): a FIXED-height
 *  colored emoji panel flush to the card top. It uses a fixed `heightCls` (e.g.
 *  `h-48`), NOT the box `height` scale — that maps to `min-h-[25vh]`, which is
 *  viewport-relative and elongates the card. The card's `overflow-hidden` rounds the
 *  top corners; `rounded-b-none` keeps the bottom square so it meets the card body. */
export const cardPhoto = (seed: string, heightCls: string): BuilderNode =>
  node('Section', {
    cls: `${heightCls} rounded-b-none`,
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
  });
