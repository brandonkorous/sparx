import * as React from 'react';
import {
  Button as ReButton,
  Heading as ReHeading,
  Hr as ReHr,
  Link as ReLink,
  Section as ReSection,
  Text as ReText,
} from '@react-email/components';
import { colors, radius, spacing, typography } from './tokens';
import { useBrand } from './brand';

// Atomic email components. Wrappers around @react-email/components that bake in
// the active brand styling so callers never inline raw style props. Brand-
// driven colors + fonts come from the BrandContext (per-tenant); typography
// scale, spacing, radius, and the muted/callout chrome stay fixed.
//
// Why no Tailwind: @react-email's Tailwind support exists but adds a build
// step and a wrapper component the renderer has to traverse. Inline style
// objects keep render simple, predictable, and easy to debug — the rendered
// HTML matches the JSX 1:1.

// ────────────────────────────────────────────────────────────────────────
// Typography
// ────────────────────────────────────────────────────────────────────────

export interface EmailHeadingProps {
  children: React.ReactNode;
  /** h1 (display) vs h2 (section). Default h1. */
  level?: 1 | 2;
  /** Builder-supplied overrides compiled from the node's class (Email v2). Merged
   *  LAST so an author's size/weight/color/alignment wins over the brand default;
   *  hand-authored templates leave it unset and keep the fixed chrome. */
  style?: React.CSSProperties;
}

export function EmailHeading({ children, level = 1, style }: EmailHeadingProps) {
  const brand = useBrand();
  const base = level === 1 ? typography.heading : typography.subheading;
  return (
    <ReHeading
      as={level === 1 ? 'h1' : 'h2'}
      style={{
        ...base,
        color: brand.foreground,
        margin: `0 0 ${spacing.sm}px`,
        fontFamily: brand.fontHeading,
        ...style,
      }}
    >
      {children}
    </ReHeading>
  );
}

export interface EmailParagraphProps {
  children: React.ReactNode;
  /** Drops bottom margin — use when this paragraph is the last child of a
   *  section so the next-section spacer doesn't double up. */
  flush?: boolean;
  /** Builder class-compiled overrides (Email v2), merged last. */
  style?: React.CSSProperties;
}

export function EmailParagraph({ children, flush = false, style }: EmailParagraphProps) {
  const brand = useBrand();
  return (
    <ReText
      style={{
        ...typography.body,
        color: brand.foreground,
        fontFamily: brand.fontBody,
        margin: `0 0 ${flush ? 0 : spacing.md}px`,
        ...style,
      }}
    >
      {children}
    </ReText>
  );
}

export interface EmailMutedProps {
  children: React.ReactNode;
  /** Builder class-compiled overrides (Email v2), merged last. */
  style?: React.CSSProperties;
}

export function EmailMuted({ children, style }: EmailMutedProps) {
  const brand = useBrand();
  return (
    <ReText
      style={{
        ...typography.muted,
        color: colors.textMuted,
        fontFamily: brand.fontBody,
        margin: `${spacing.md}px 0 0`,
        ...style,
      }}
    >
      {children}
    </ReText>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Links
// ────────────────────────────────────────────────────────────────────────

export interface EmailLinkProps {
  href: string;
  children: React.ReactNode;
}

export function EmailLink({ href, children }: EmailLinkProps) {
  const brand = useBrand();
  return (
    <ReLink
      href={href}
      style={{
        color: brand.primary,
        textDecoration: 'underline',
        wordBreak: 'break-word',
      }}
    >
      {children}
    </ReLink>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Buttons
// ────────────────────────────────────────────────────────────────────────

export interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
  /** primary: filled brand (default). secondary: outlined. */
  variant?: 'primary' | 'secondary';
  /** Builder class-compiled overrides (Email v2), merged last — an author can recolor
   *  or resize the button from its class while the layout/hit-area defaults remain. */
  style?: React.CSSProperties;
}

export function EmailButton({ href, children, variant = 'primary', style }: EmailButtonProps) {
  const brand = useBrand();
  const variantStyle =
    variant === 'primary'
      ? { backgroundColor: brand.primary, color: brand.primaryForeground, border: 'none' }
      : {
          backgroundColor: brand.background,
          color: brand.primary,
          border: `1px solid ${brand.primary}`,
        };
  return (
    <ReButton
      href={href}
      style={{
        ...variantStyle,
        borderRadius: radius.button,
        fontSize: typography.body.fontSize,
        fontWeight: 500,
        padding: '10px 18px',
        textDecoration: 'none',
        display: 'inline-block',
        fontFamily: brand.fontBody,
        ...style,
      }}
    >
      {children}
    </ReButton>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Callout — bordered tinted block for "important" notices.
// ────────────────────────────────────────────────────────────────────────

export interface EmailCalloutProps {
  children: React.ReactNode;
  /** info: indigo tint. warn: amber. success: green. Default info. */
  tone?: 'info' | 'warn' | 'success';
}

export function EmailCallout({ children, tone = 'info' }: EmailCalloutProps) {
  const brand = useBrand();
  const bg =
    tone === 'warn'
      ? colors.calloutWarnBg
      : tone === 'success'
        ? colors.calloutSuccessBg
        : colors.calloutInfoBg;
  return (
    <ReSection
      style={{
        backgroundColor: bg,
        borderRadius: radius.callout,
        padding: spacing.md,
        margin: `${spacing.md}px 0`,
      }}
    >
      <ReText
        style={{
          ...typography.body,
          color: brand.foreground,
          fontFamily: brand.fontBody,
          margin: 0,
        }}
      >
        {children}
      </ReText>
    </ReSection>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Field panel — a bordered, inset label→value card. The legacy-layout twin of
// the silica `detailPanel`: it turns the owner/applicant notification emails
// (a form submission, a job application, a chat) from a flat run of muted
// labels into a scannable record the reader takes in at a glance. Brand-driven
// like every atomic here; a multi-line value renders with its breaks preserved.
// ────────────────────────────────────────────────────────────────────────

export interface EmailFieldRow {
  label: string;
  value: React.ReactNode;
}

export interface EmailFieldPanelProps {
  rows: EmailFieldRow[];
}

export function EmailFieldPanel({ rows }: EmailFieldPanelProps) {
  const brand = useBrand();
  return (
    <ReSection
      style={{
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.callout,
        border: `1px solid ${brand.border}`,
        padding: `${spacing.xs}px ${spacing.lg}px ${spacing.lg}px`,
        margin: `${spacing.md}px 0`,
      }}
    >
      {rows.map((r, i) => (
        <React.Fragment key={`${r.label}-${i}`}>
          <ReText
            style={{
              ...typography.muted,
              color: colors.textMuted,
              fontFamily: brand.fontBody,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: `${spacing.md}px 0 0`,
            }}
          >
            {r.label}
          </ReText>
          <ReText
            style={{
              ...typography.body,
              color: brand.foreground,
              fontFamily: brand.fontBody,
              whiteSpace: 'pre-line',
              margin: '2px 0 0',
            }}
          >
            {r.value}
          </ReText>
        </React.Fragment>
      ))}
    </ReSection>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Spacer + Divider — explicit vertical rhythm controls.
// ────────────────────────────────────────────────────────────────────────

export interface EmailSpacerProps {
  /** Vertical space in px. Default 16. */
  size?: number;
}

export function EmailSpacer({ size = spacing.md }: EmailSpacerProps) {
  return <div style={{ height: size, lineHeight: `${size}px` }}>&nbsp;</div>;
}

export function EmailDivider() {
  const brand = useBrand();
  return <ReHr style={{ borderColor: brand.border, margin: `${spacing.lg}px 0` }} />;
}
