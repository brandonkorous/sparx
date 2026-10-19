import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailButton, EmailHeading, EmailMuted, EmailParagraph } from '../components';

// Shopper-facing: "confirm this address is yours" (sparx persona issue 329).
//
// A business keeps what a guest did under the email they gave: orders, the
// address they shipped to, bookings. Making an account with that email used to
// hand all of it to whoever made the account, with nothing to show they own the
// inbox. Now the history waits for this link. Sent in the SHOP's name: the
// person made an account with the shop, never with sparx.
export interface CustomerEmailConfirmEmailProps {
  /** The customer-facing site name (Property.name). */
  siteName?: string | null;
  name?: string | null;
  confirmUrl: string;
  expiresInMinutes?: number;
}

export function CustomerEmailConfirmEmail({
  siteName,
  name,
  confirmUrl,
  expiresInMinutes = 60,
}: CustomerEmailConfirmEmailProps) {
  const site = siteName ?? '';
  return (
    <EmailLayout
      audience="visitor"
      preview={site ? `Confirm your email for ${site}` : 'Confirm your email'}
    >
      <Section>
        <EmailHeading>Confirm it’s you</EmailHeading>
        <EmailParagraph>{name ? `Hi ${name},` : 'Hi there,'}</EmailParagraph>
        <EmailParagraph>
          {site
            ? `You made an account at ${site} with this email address. Confirm it is yours, and anything you did there before, like past orders, joins your account.`
            : 'You made an account with this email address. Confirm it is yours, and anything you did there before, like past orders, joins your account.'}
        </EmailParagraph>
        <EmailButton href={confirmUrl}>Confirm my email</EmailButton>
        <EmailMuted>
          {`The link works for ${expiresInMinutes} minutes. If you did not make this account, ignore this email: nothing is shared until the link is opened.`}
        </EmailMuted>
      </Section>
    </EmailLayout>
  );
}

export function customerEmailConfirmSubject(siteName?: string | null): string {
  return siteName ? `Confirm your email for ${siteName}` : 'Confirm your email';
}
