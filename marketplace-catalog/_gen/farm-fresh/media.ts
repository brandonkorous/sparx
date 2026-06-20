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

/** Lighten a `#rrggbb` toward white by `amt` (0..1) — builds the top stop of the
 *  panel gradient so a product photo reads as a soft, designed surface instead of a
 *  flat saturated block. */
const lighten = (hex: string, amt: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number): number => Math.round(c + (255 - c) * amt);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

/** A product "photo" as a self-contained SVG data URI: the food's brand-surface
 *  colour with its big food emoji centred — the same look the home menu cards paint,
 *  but as a real image so a bound `item.images` (Menu grid, product detail) renders
 *  it. A single soft radial gradient (a lighter tint behind the food easing to the
 *  base colour at the edges) reads as a designed spotlight panel, not a flat block.
 *  The whole URI must stay under the `media_assets.key` cap (1024 chars) — this fits
 *  comfortably (~740). No network, so it always resolves. */
export const photoSvg = (seed: string): string => {
  const fill = SURFACE_HEX[emojiSurface(seed)];
  const tint = lighten(fill, 0.28);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">` +
    `<defs><radialGradient id="g" cx="0.5" cy="0.42" r="0.72">` +
    `<stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="${fill}"/>` +
    `</radialGradient></defs>` +
    `<rect width="800" height="800" fill="url(#g)"/>` +
    `<text x="400" y="408" font-size="376" text-anchor="middle" dominant-baseline="central" ` +
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
