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
export {
  Card,
  CardBody,
  CardTitle,
  CardActions,
  type CardProps,
  type CardBorder,
  type CardModifier,
  type CardSlotProps,
  type CardTitleProps,
} from './components/card';
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

// ── Tier 1: layout archetypes (docs/47 §11 B1) ─────────────
export { Section, type SectionProps, type SectionContentWidth } from './components/section';
export { Container, type ContainerProps, type ContainerWidth } from './components/container';
export { Grid, type GridProps, type GridCols } from './components/grid';
export {
  Stack,
  type StackProps,
  type StackDirection,
  type StackAlign,
  type StackJustify,
} from './components/stack';

// ── Tier 2: color-bearing primitives (recipe consumers) ────
export { Badge, type BadgeProps } from './components/badge';
export { Tag, type TagProps } from './components/tag';
export {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertBody,
  type AlertProps,
  type AlertSlotProps,
} from './components/alert';
export { Callout, type CalloutProps } from './components/callout';
export {
  Avatar,
  initials,
  type AvatarProps,
  type AvatarShape,
  type AvatarStatus,
} from './components/avatar';
export { Label, type LabelProps } from './components/label';

// ── Tier 2b: structural primitives (no color axis) ─────────
export { Skeleton, type SkeletonProps, type SkeletonShape } from './components/skeleton';
export { Spinner, type SpinnerProps, type SpinnerKind } from './components/spinner';
export { Progress, type ProgressProps } from './components/progress';
export {
  Breadcrumb,
  BreadcrumbItem,
  type BreadcrumbProps,
  type BreadcrumbItemProps,
} from './components/breadcrumb';
export { Pagination, paginationRange, type PaginationProps } from './components/pagination';

// ── Tier 3: form controls ──────────────────────────────────
export { Input, type InputProps, type FieldVariant } from './components/input';
export { Textarea, type TextareaProps } from './components/textarea';
export { NativeSelect, type NativeSelectProps } from './components/native-select';
export { Checkbox, type CheckboxProps } from './components/checkbox';
export {
  Radio,
  RadioGroup,
  type RadioProps,
  type RadioGroupProps,
  type RadioGroupOrientation,
} from './components/radio';
export { Switch, type SwitchProps } from './components/switch';
export { Field, type FieldProps } from './components/field';
