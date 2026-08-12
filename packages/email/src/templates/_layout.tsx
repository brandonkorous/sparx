import * as React from 'react';
import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Row,
  Section,
} from '@react-email/components';
import { EmailDivider, EmailMuted, EmailWordmark, useBrand } from '../components';
import { colors, signal, spacing } from '../components/tokens';

// Shared email frame — the platform (bucket-B) twin of the silica redesign's frame
// (docs/impl transactional-email §4 P5). Every coded template inherits the same
// chrome: a thin brand-color top bar, the wordmark header, and a tiered footer, so
// a person's password-reset reads like their order-confirmation. Callers compose
// only body content as children.
//
// Hand-rolled HTML/CSS via @react-email/components: the rendered output is
// table-based markup that survives every popular mail client. Brand colors +
// fonts come from the BrandContext (per-tenant); spacing is fixed.

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
  /** Brief tagline rendered on the first footer line. */
  footerNote?: string;
  /** Render the built-in wordmark header (wordmark + divider). Default `true` — the
   *  CODED templates (welcome-merchant, password-reset, chat-notification) rely on
   *  it. The Builder email renderer passes `false`: its tree carries an author-
   *  editable `email_wordmark` node as the first body element instead (docs/52 §1),
   *  so the header is part of what the merchant edits in /builder/email. */
  header?: boolean;
}

export function EmailLayout({ preview, children, footerNote, header = true }: EmailLayoutProps) {
  const brand = useBrand();
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: brand.muted,
          margin: 0,
          padding: `${spacing.xl}px 0`,
          fontFamily: brand.fontBody,
        }}
      >
        <Container
          style={{
            backgroundColor: brand.background,
            border: `1px solid ${brand.border}`,
            borderRadius: 8,
            margin: '0 auto',
            maxWidth: 560,
            // Padding lives on the inner section so the brand bar can sit flush to
            // the top edge; `overflow:hidden` keeps it inside the rounded corners.
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {/* The thin brand-color top bar — the same signal the silica frame opens
              with, tying the platform emails to the tenant-facing ones. */}
          <Section
            style={{
              backgroundColor: brand.primary,
              height: 4,
              lineHeight: '4px',
              fontSize: 0,
            }}
          >
            &nbsp;
          </Section>

          <Section style={{ padding: `${spacing.xl}px` }}>
            {header ? (
              <>
                <Section>
                  <EmailWordmark />
                </Section>

                <EmailDivider />
              </>
            ) : null}

            {children}

            <EmailDivider />

            {/* Tiered footer: a tagline line over a legal line, both muted. */}
            <EmailMuted style={{ margin: 0 }}>
              {footerNote ?? `${brand.siteName ?? 'sparx'} · Sent with sparx`}
            </EmailMuted>
            <EmailMuted style={{ margin: `${spacing.xs}px 0 0`, color: colors.textMuted }}>
              WizeWorks · sparx.works
            </EmailMuted>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ── PlatformEmailLayout — the "Signal" chassis for sparx PLATFORM emails ──────
//
// The redesign frame the 20-minus-5 coded sparx→owner templates run through
// (billing, auth, domains, team, partner, …). Deliberately SEPARATE from
// `EmailLayout` above (which stays the tenant/broadcast/builder frame, redesigned
// in a later pass) so this change is scoped to platform email with zero regression
// risk to tenant sends.
//
// Chrome: a solid sparx-INK masthead carrying the wordmark (white "spar" + Ember
// "x") — a real brand moment, not a 4px hairline bar — then the body, then a
// footer well with optional quick links + the legal line. Always sparx-branded
// (platform emails pass no tenant brand), so colors come from `signal`, not the
// per-tenant BrandContext. Every value inlined; table-based; 600px single column.

export interface PlatformFooterLink {
  label: string;
  href: string;
}

export interface PlatformEmailLayoutProps {
  /** Inbox preview text (the line after the subject). */
  preview: string;
  children: React.ReactNode;
  /** Optional right-aligned meta on the masthead (e.g. a receipt number). */
  mastheadRight?: string;
  /** Quick links shown as a row above the legal line. */
  footerLinks?: PlatformFooterLink[];
  /** The "you're receiving this because…" line — always state the reason. */
  footerReason?: string;
}

const linkStyle: React.CSSProperties = {
  color: signal.ink,
  fontFamily: signal.font,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
  borderBottom: '1px solid #cfd3dd',
  paddingBottom: 1,
};

export function PlatformEmailLayout({
  preview,
  children,
  mastheadRight,
  footerLinks,
  footerReason,
}: PlatformEmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: signal.canvas,
          margin: 0,
          padding: `${signal.space.xl}px 0`,
          fontFamily: signal.font,
        }}
      >
        <Container
          style={{
            backgroundColor: signal.paper,
            border: `1px solid ${signal.line}`,
            borderRadius: signal.radius.card,
            margin: '0 auto',
            maxWidth: 600,
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {/* Ink masthead — the wordmark, not a hairline bar. */}
          <Section style={{ backgroundColor: signal.ink, padding: '20px 32px' }}>
            <Row>
              <Column style={{ verticalAlign: 'middle' }}>
                <span
                  style={{
                    fontFamily: signal.font,
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: '#ffffff',
                  }}
                >
                  spar<span style={{ color: signal.ember }}>x</span>
                </span>
              </Column>
              {mastheadRight ? (
                <Column style={{ verticalAlign: 'middle', textAlign: 'right' }}>
                  <span
                    style={{
                      fontFamily: signal.mono,
                      fontSize: 12,
                      letterSpacing: '0.02em',
                      color: signal.inkMeta,
                    }}
                  >
                    {mastheadRight}
                  </span>
                </Column>
              ) : null}
            </Row>
          </Section>

          {/* Body */}
          <Section style={{ padding: '34px 32px' }}>{children}</Section>

          {/* Footer well */}
          <Section
            style={{
              backgroundColor: signal.footBg,
              borderTop: `1px solid ${signal.line}`,
              padding: '22px 32px 26px',
            }}
          >
            {footerLinks && footerLinks.length > 0 ? (
              <Section style={{ marginBottom: 12 }}>
                {footerLinks.map((l, i) => (
                  <Link key={i} href={l.href} style={{ ...linkStyle, marginRight: 18 }}>
                    {l.label}
                  </Link>
                ))}
              </Section>
            ) : null}
            {footerReason ? (
              <EmailMuted style={{ margin: 0, color: signal.meta }}>{footerReason}</EmailMuted>
            ) : null}
            <EmailMuted
              style={{ margin: `${footerReason ? signal.space.xs : 0}px 0 0`, color: signal.meta }}
            >
              WizeWorks, Inc. · sparx.works
            </EmailMuted>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
