// @sparx/site-ui — public barrel.
//
// The tenant-themed (--sf-*) site component library. Consumed by the
// site chrome, the Builder renderer, and the editor canvas so the preview
// renders the exact components the site ships (docs/46).
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
export { CollapsibleNav, type CollapsibleNavProps } from './components/collapsible-nav';
export { SocialLinks, type SocialLinksProps, type SocialItem } from './components/social-links';
export { EditorialSection, type EditorialSectionProps } from './components/editorial-section';
export { FAQ, type FaqProps, type FaqEntry } from './components/faq';
export { FeatureGrid, type FeatureGridProps, type FeatureItem } from './components/feature-grid';
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

// ── Tier 4: interactive (Radix behavior, Surface appearance) ─
export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  type AccordionProps,
  type AccordionIcon,
} from './components/accordion';
export { Collapse, CollapseTrigger, CollapseContent } from './components/collapse';
export {
  Tabs,
  TabsList,
  TabsTab,
  TabsPanel,
  type TabsProps,
  type TabsVariant,
} from './components/tabs';
export { Tooltip, type TooltipProps, type TooltipSide } from './components/tooltip';
export {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  type DialogContentProps,
  type DialogPlacement,
} from './components/dialog';
export {
  Drawer,
  DrawerContent,
  DrawerTitle,
  type DrawerContentProps,
  type DrawerSide,
} from './components/drawer';
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './components/dropdown-menu';
export { Popover, PopoverContent } from './components/popover';

// ── Catalog: color-bearing / structural primitives ─────────
export { Link, type LinkProps, type LinkUnderline } from './components/link';
export { Status, type StatusProps } from './components/status';
export { Kbd, type KbdProps } from './components/kbd';
export {
  Steps,
  Step,
  type StepsProps,
  type StepProps,
  type StepsOrientation,
  type StepState,
} from './components/steps';
export { RadialProgress, type RadialProgressProps } from './components/radial-progress';
export {
  ChatBubble,
  ChatAvatar,
  ChatHeader,
  ChatMessage,
  ChatFooter,
  type ChatBubbleProps,
  type ChatMessageProps,
  type ChatPlacement,
} from './components/chat-bubble';
export { Range, type RangeProps } from './components/range';
export { Rating, type RatingProps } from './components/rating';

// ── Catalog: layout / navigation ───────────────────────────
export { Hero, type HeroProps, type HeroAlign } from './components/hero';
export {
  Footer,
  FooterColumn,
  FooterTitle,
  type FooterProps,
  type FooterSlotProps,
} from './components/footer';
export {
  Navbar,
  NavbarStart,
  NavbarCenter,
  NavbarEnd,
  type NavbarProps,
  type NavbarSlotProps,
} from './components/navbar';
export {
  Menu,
  MenuItem,
  type MenuProps,
  type MenuItemProps,
  type MenuOrientation,
} from './components/menu';
export { Dock, DockItem, type DockProps, type DockItemProps } from './components/dock';
export { List, ListRow, type ListProps, type ListRowProps } from './components/list';
export { Table, type TableProps } from './components/table';
export {
  Indicator,
  IndicatorItem,
  type IndicatorProps,
  type IndicatorItemProps,
  type IndicatorPlacement,
} from './components/indicator';
export { Join, type JoinProps, type JoinOrientation } from './components/join';
export { Mask, type MaskProps, type MaskShape } from './components/mask';
export {
  Toast,
  type ToastProps,
  type ToastHorizontal,
  type ToastVertical,
} from './components/toast';

// ── Catalog: display / input ───────────────────────────────
export { Countdown, type CountdownProps } from './components/countdown';
export {
  Diff,
  DiffItem1,
  DiffItem2,
  DiffResizer,
  type DiffProps,
  type DiffSlotProps,
} from './components/diff';
export { Hover3DCard, type Hover3DCardProps } from './components/hover-3d-card';
export {
  HoverGallery,
  type HoverGalleryProps,
  type HoverGalleryImage,
} from './components/hover-gallery';
export { TextRotate, type TextRotateProps } from './components/text-rotate';
export { Swap, type SwapProps, type SwapAnimation } from './components/swap';
export { FAB, type FABProps, type FABPlacement } from './components/fab';
export { Calendar, calendarMonth, type CalendarProps } from './components/calendar';
export { FileInput, type FileInputProps } from './components/file-input';
export { Filter, type FilterProps, type FilterOption } from './components/filter';
export { Validator, type ValidatorProps } from './components/validator';
export {
  ThemeController,
  type ThemeControllerProps,
  type ThemeMode,
  type ThemeControllerVariant,
} from './components/theme-controller';

// ── Catalog: mockups ───────────────────────────────────────
export { Browser, type BrowserProps } from './components/browser';
export { Code, CodeLine, type CodeProps, type CodeLineProps } from './components/code';
export { Phone, type PhoneProps } from './components/phone';
export { Window, type WindowProps } from './components/window';
