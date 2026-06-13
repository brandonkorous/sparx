import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailButton, EmailHeading, EmailLink, EmailMuted, EmailParagraph } from '../components';

export interface EmailVerificationEmailProps {
  /** Recipient's name; falls back to "there" if unknown. */
  name?: string;
  verifyUrl: string;
  /** How long the link is valid for, surfaced to the recipient. */
  expiresInMinutes?: number;
  /** Tenant-editable opening line (rendered after the greeting). */
  intro?: string;
  /** Tenant-editable closing line (rendered before the footer note). */
  outro?: string;
}

export function EmailVerificationEmail({
  name,
  verifyUrl,
  expiresInMinutes = 60,
  intro,
  outro,
}: EmailVerificationEmailProps) {
  return (
    <EmailLayout preview="Confirm your Sparx email">
      <Section>
        <EmailHeading>Confirm your email</EmailHeading>
        <EmailParagraph>{name ? `Hi ${name},` : 'Hi there,'}</EmailParagraph>
        {intro ? <EmailParagraph>{intro}</EmailParagraph> : null}
        <EmailParagraph>
          Thanks for creating a Sparx account. Confirm this email address to unlock everything —
          connecting a custom domain, going live, and sending email. The link expires in{' '}
          {expiresInMinutes} minutes.
        </EmailParagraph>
        <EmailButton href={verifyUrl}>Confirm email</EmailButton>
        {outro ? <EmailParagraph>{outro}</EmailParagraph> : null}
        <EmailMuted>If the button doesn&apos;t work, paste this URL into your browser:</EmailMuted>
        <EmailParagraph flush>
          <EmailLink href={verifyUrl}>{verifyUrl}</EmailLink>
        </EmailParagraph>
        <EmailMuted>
          If you didn&apos;t create a Sparx account, you can safely ignore this email.
        </EmailMuted>
      </Section>
    </EmailLayout>
  );
}

export const emailVerificationSubject = 'Confirm your Sparx email';
