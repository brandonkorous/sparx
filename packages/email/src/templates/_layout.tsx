import * as React from 'react';
import { Body, Container, Head, Html, Preview, Section } from '@react-email/components';
import { EmailDivider, EmailMuted, EmailWordmark, useBrand } from '../components';
import { spacing } from '../components/tokens';

// Shared email frame. The header (wordmark + divider) and footer (divider +
// muted note) are baked in here so every template inherits brand chrome —
// callers just compose body content as children.
//
// Hand-rolled HTML/CSS via @react-email/components: the rendered output is
// table-based markup that survives every popular mail client. Brand colors +
// fonts come from the BrandContext (per-tenant); spacing is fixed.

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
  /** Brief tagline rendered in the footer. */
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
            padding: `${spacing.xl}px`,
          }}
        >
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

          <EmailMuted>{footerNote ?? `${brand.siteName ?? 'Sparx'} · Sent with Sparx`}</EmailMuted>
        </Container>
      </Body>
    </Html>
  );
}
