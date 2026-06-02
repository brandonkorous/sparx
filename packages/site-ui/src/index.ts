// @sparx/site-ui — public barrel.
//
// The tenant-themed (--sf-*) storefront component library. Consumed by the
// storefront chrome, the Builder renderer, and the editor canvas so the preview
// renders the exact components the storefront ships (docs/46).
//
// Components emit semantic `sf-*` classes; consumers must also import the
// stylesheet once: `import '@sparx/site-ui/styles.css'`.

// ── Utilities ──────────────────────────────────────────────
export { cx, type ClassValue } from './utils/cx';
export { youtubeEmbed, mapEmbed } from './utils/embed';
export { photoPanelStyle, type PhotoPanelInput } from './utils/photo-panel';

// ── Variant recipe (docs/35 / docs/46 §3.6) — the foundation every ──────────
//    color-bearing component composes color × variant (× size) off.
export {
  COLOR_KEYS,
  colorVariants,
  colorClass,
  treatmentVariants,
  chipTreatmentVariants,
  SIZE_KEYS,
  type ColorKey,
  type TreatmentKey,
  type ChipTreatmentKey,
  type SizeKey,
} from './components/_recipes/variants';

// ── Components ─────────────────────────────────────────────
export { Button, type ButtonProps } from './components/button';
export { Heading, type HeadingProps, type HeadingLevel } from './components/heading';
export { Text, type TextProps, type TextVariant } from './components/text';
export { Divider, type DividerProps } from './components/divider';
export { PriceTag, type PriceTagProps } from './components/price-tag';
export { Image, type ImageProps, type ImageRatio } from './components/image';
export { Logo, type LogoProps } from './components/logo';
export {
  NavMenu,
  type NavMenuProps,
  type NavItem,
  type NavOrientation,
} from './components/nav-menu';
export { SocialLinks, type SocialLinksProps, type SocialItem } from './components/social-links';
export { EmbedFrame, type EmbedFrameProps, type EmbedRatio } from './components/embed-frame';
export { Video, type VideoProps } from './components/video';
export { Map, type MapProps } from './components/map';
export { Stat, type StatProps } from './components/stat';
export { Carousel, type CarouselProps } from './components/carousel';
