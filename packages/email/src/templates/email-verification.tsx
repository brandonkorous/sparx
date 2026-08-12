import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailDisplayHeading,
  EmailFallbackLink,
  EmailFinePrint,
  EmailParagraph,
} from '../components';

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
    <PlatformEmailLayout
      preview="Confirm your sparx email"
      footerReason="You're receiving this because this address was used to create a sparx account."
    >
      <EmailDisplayHeading>Confirm your email</EmailDisplayHeading>
      <EmailParagraph>{name ? `Hi ${name},` : 'Hi there,'}</EmailParagraph>
      {intro ? <EmailParagraph>{intro}</EmailParagraph> : null}
      <EmailParagraph>
        Thanks for creating a sparx account. Confirm this email address to unlock everything —
        connecting a custom domain, going live, and sending email. The link expires in{' '}
        {expiresInMinutes} minutes.
      </EmailParagraph>
      <EmailActionButton href={verifyUrl}>Confirm email</EmailActionButton>
      {outro ? <EmailParagraph>{outro}</EmailParagraph> : null}
      <EmailFallbackLink url={verifyUrl} />
      <EmailFinePrint>
        If you didn&apos;t create a sparx account, you can safely ignore this email.
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export const emailVerificationSubject = 'Confirm your sparx email';
