// The sparx components that fill silicaui's gaps for the site render path.
//
// Everything a builder page renders comes from silicaui — its React components on
// interactive surfaces, its CSS classes on server-rendered ones. This directory is
// the remainder: the handful of things silica genuinely does not cover, each built
// ON silica rather than beside it (root CLAUDE.md RULE #1).
//
// The bar for adding a file here is that silica has no equivalent AND the
// difference is real — a different mechanism (ThemeToggle needs a cookie, not
// localStorage, so the server can resolve the mode without a flash), a different
// owner (SocialLinks draws other companies' marks), or a constraint that comes
// from builder NODES (NavShell must render its children exactly once because a
// node id is also a dnd-kit sortable id). "silica's version looks slightly
// different" is not on that list — restyle nothing, and never reintroduce a
// parallel class vocabulary.
//
// See docs/implementation/st-token-retirement.md.

export { FAB, type FABPlacement, type FABProps } from './fab';
export { Hover3DCard, type Hover3DCardProps } from './hover-3d-card';
export { HoverGallery, type HoverGalleryImage, type HoverGalleryProps } from './hover-gallery';
export { TextRotate, type TextRotateProps } from './text-rotate';
export {
  ToastRegion,
  type ToastHorizontal,
  type ToastRegionProps,
  type ToastVertical,
} from './toast-region';

export {
  NAV_CARET_CLASS,
  NAV_DROPDOWN_CLASS,
  NAV_DROPDOWN_PANEL_CLASS,
  NAV_ICON_CLASS,
  NAV_ITEM_CLASS,
  NAV_MEGA_CLASS,
  NAV_SUMMARY_CLASS,
  NavShell,
  navMegaPanelClass,
  type NavShellOrientation,
  type NavShellProps,
} from './nav';

export {
  SiteLogo,
  SiteWordmark,
  type SiteLogoProps,
  type SiteWordmarkProps,
  type WordmarkCollapse,
} from './brand';

export {
  PriceTag,
  SiteDivider,
  SiteHeading,
  SiteStat,
  SiteText,
  type HeadingLevel,
  type PriceTagProps,
  type SiteHeadingProps,
  type SiteStatProps,
  type SiteTextProps,
  type TextVariant,
} from './typography';

export {
  EmbedFrame,
  SiteImage,
  type EmbedFrameProps,
  type EmbedRatio,
  type ImageRatio,
  type SiteImageProps,
} from './media';

export {
  EditorialSection,
  FAQ,
  FeatureGrid,
  type EditorialSectionProps,
  type FaqEntry,
  type FaqProps,
  type FeatureGridProps,
  type FeatureItem,
} from './content';

export { SocialLinks, type SocialItem, type SocialLinksProps } from './social-links';
export { Signup, type SignupProps } from './signup';
export { ThemeToggle, type ThemeToggleProps } from './theme-toggle';
export { AccountMenu, type AccountMenuProps, type AccountStatus } from './account-menu';
