// Atomic email components + brand tokens. Templates compose these inside
// <EmailLayout>; the contract is that no template inlines raw style props —
// extend a component here instead.

export { EmailWordmark, PlatformWordmark, type EmailWordmarkProps } from './wordmark';
export {
  EmailHeading,
  EmailParagraph,
  EmailMuted,
  EmailLink,
  EmailButton,
  EmailCallout,
  EmailFieldPanel,
  EmailSpacer,
  EmailDivider,
  type EmailHeadingProps,
  type EmailParagraphProps,
  type EmailMutedProps,
  type EmailLinkProps,
  type EmailButtonProps,
  type EmailCalloutProps,
  type EmailFieldRow,
  type EmailFieldPanelProps,
  type EmailSpacerProps,
} from './primitives';
export { colors, typography, spacing, radius, fontFamily, signal } from './tokens';
export {
  BrandProvider,
  useBrand,
  usePlatform,
  usePlatformName,
  platformNameOf,
  usePalette,
  paletteOf,
  defaultBrand,
  type BrandTokens,
  type PlatformIdentity,
} from './brand';

// "Signal" — structural block components for PLATFORM emails (composed inside
// PlatformEmailLayout). See ./blocks.
export {
  EmailDisplayHeading,
  EmailLead,
  EmailSectionLabel,
  EmailStatusPill,
  EmailStatusList,
  EmailAmountHero,
  EmailSteps,
  EmailLineItems,
  EmailPayCard,
  EmailTimeline,
  EmailAlert,
  EmailActionButton,
  EmailCodeBlock,
  EmailFallbackLink,
  EmailFinePrint,
  type Tone,
  type StepItem,
  type LineItem,
  type SummaryRow,
  type TimelineRow,
  type StatusRow,
} from './blocks';
