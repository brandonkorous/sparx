import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailButton, EmailHeading, EmailLink, EmailMuted, EmailParagraph } from '../components';

export interface PasswordResetEmailProps {
  /** Recipient's name; falls back to "there" if unknown. */
  name?: string;
  resetUrl: string;
  /** How long the link is valid for, surfaced to the recipient. */
  expiresInMinutes?: number;
  /** Tenant-editable opening line (rendered after the greeting). */
  intro?: string;
  /** Tenant-editable closing line (rendered before the footer note). */
  outro?: string;
}

export function PasswordResetEmail({
  name,
  resetUrl,
  expiresInMinutes = 60,
  intro,
  outro,
}: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Set your sparx password">
      <Section>
        <EmailHeading>Set your password</EmailHeading>
        <EmailParagraph>{name ? `Hi ${name},` : 'Hi there,'}</EmailParagraph>
        {intro ? <EmailParagraph>{intro}</EmailParagraph> : null}
        <EmailParagraph>
          Use the button below to set a password for your sparx account — whether you&apos;re
          choosing one for the first time or replacing an old one. The link expires in{' '}
          {expiresInMinutes} minutes.
        </EmailParagraph>
        <EmailButton href={resetUrl}>Set password</EmailButton>
        {outro ? <EmailParagraph>{outro}</EmailParagraph> : null}
        <EmailMuted>If the button doesn&apos;t work, paste this URL into your browser:</EmailMuted>
        <EmailParagraph flush>
          <EmailLink href={resetUrl}>{resetUrl}</EmailLink>
        </EmailParagraph>
        <EmailMuted>
          If you didn&apos;t request this, you can safely ignore this email — no changes will be
          made.
        </EmailMuted>
      </Section>
    </EmailLayout>
  );
}

export const passwordResetSubject = 'Set your sparx password';
