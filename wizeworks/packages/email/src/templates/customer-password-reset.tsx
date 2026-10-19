import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailButton, EmailHeading, EmailMuted, EmailParagraph } from '../components';

// Shopper-facing: "set a password for your account at this shop" (sparx persona
// issue 345).
//
// Renée asked Gillett's site to reset her password and got "Set your sparx
// password", from "sparx", about "your sparx account", over a WizeWorks footer:
// the staff email, sent to a shop's customer who has never heard of sparx. The
// account is the shop's, so the email is too, like the confirm email beside it.
export interface CustomerPasswordResetEmailProps {
  /** The customer-facing site name (Property.name). */
  siteName?: string | null;
  name?: string | null;
  resetUrl: string;
  expiresInMinutes?: number;
}

export function CustomerPasswordResetEmail({
  siteName,
  name,
  resetUrl,
  expiresInMinutes = 60,
}: CustomerPasswordResetEmailProps) {
  const site = siteName ?? '';
  return (
    <EmailLayout
      audience="visitor"
      preview={site ? `Set your password for ${site}` : 'Set your password'}
    >
      <Section>
        <EmailHeading>Set your password</EmailHeading>
        <EmailParagraph>{name ? `Hi ${name},` : 'Hi there,'}</EmailParagraph>
        <EmailParagraph>
          {site
            ? `Someone asked to set a new password for your account at ${site}. Use the button to choose one.`
            : 'Someone asked to set a new password for your account. Use the button to choose one.'}
        </EmailParagraph>
        <EmailButton href={resetUrl}>Set my password</EmailButton>
        <EmailMuted>
          {`The link works for ${expiresInMinutes} minutes. If you did not ask for this, ignore this email: your password stays as it is.`}
        </EmailMuted>
      </Section>
    </EmailLayout>
  );
}

export function customerPasswordResetSubject(siteName?: string | null): string {
  return siteName ? `Set your password for ${siteName}` : 'Set your password';
}
