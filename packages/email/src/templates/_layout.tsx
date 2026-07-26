import * as React from 'react';
import { Body, Container, Head, Html, Preview, Section } from '@react-email/components';
import { EmailDivider, EmailMuted, EmailWordmark, useBrand } from '../components';
import { colors, spacing } from '../components/tokens';

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
