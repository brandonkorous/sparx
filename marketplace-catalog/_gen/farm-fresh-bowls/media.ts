// Farm Fresh generator — imagery + the emoji "photo" panel. `pic()` builds a
// keyworded, deterministic loremflickr URL (used for the product/asset references);
// `emojiPanel()` is the mockup's `.photo` block — a rounded colored panel with a big
// centered food emoji, 100% reliable (no remote load), used by the section builders.

import { node, type BuilderNode } from './_kit';

// Food-relevant, always-resolvable photos (the tenant swaps these post-install).
// loremflickr serves real Creative-Commons food photos BY KEYWORD, so the imagery
// reads as açaí/smoothie/salad instead of generic stock; `?lock=<n>` pins a stable
// image per seed (deterministic regen, no per-request flicker).
const FOOD_TAGS: Record<string, string> = {
  hero: 'acai,bowl',
  care: 'healthy,bowl',
  love: 'smoothie,bowl',
  'story-hero': 'fresh,fruit',
  'story-care': 'farm,vegetables',
  'story-food': 'healthy,food',
  'catering-hero': 'catering,food',
  acai: 'acai,bowl',
  strawberry: 'strawberry,smoothie',
  green: 'green,smoothie',
  mango: 'mango,smoothie',
  blueberry: 'blueberry,smoothie',
  citrus: 'orange,juice',
  coconut: 'coconut,bowl',
  kale: 'kale,salad',
  avocado: 'avocado,salad',
  southwest: 'grain,bowl',
};

/** A small stable hash → a deterministic loremflickr `lock` per seed. */
const lockOf = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h + 1;
};

export const pic = (seed: string, w = 1600, h = 1100): string => {
  const key = seed.replace(/^prod-/, '');
  const tags = FOOD_TAGS[key] ?? 'healthy,food';
  return `https://loremflickr.com/${w}/${h}/${tags}?lock=${lockOf(seed)}`;
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
