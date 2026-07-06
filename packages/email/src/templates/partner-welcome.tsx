import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailButton, EmailHeading, EmailParagraph } from '../components';

export interface PartnerWelcomeEmailProps {
  /** The partner's name (falls back to "there"). */
  name?: string;
  /** Where to send them — the dashboard's Partner section. */
  dashboardUrl: string;
  /** True when a brand-new account was created for them: they'll ALSO receive a
   *  separate set-password email, so we tell them to expect it. False when they
   *  already had a Sparx login and just gained a new partner workspace. */
  needsPassword?: boolean;
}

// Sent when WizeWorks approves a partner application (docs/114 §B.2). A partner IS
// a tenant, so approval provisions a partner workspace — either a brand-new account
// (needsPassword: they also get a set-password email) or a new workspace on an
// existing login. This is the branded "you're in" note; the set-password email is
// the separate, security-scoped one.
export function PartnerWelcomeEmail({
  name,
  dashboardUrl,
  needsPassword,
}: PartnerWelcomeEmailProps) {
  return (
    <EmailLayout preview="You're approved — welcome to the sparx Partner Program">
      <Section>
        <EmailHeading>Welcome to the sparx Partner Program</EmailHeading>
        <EmailParagraph>Hi {name ?? 'there'},</EmailParagraph>
        <EmailParagraph>
          Your application has been approved — you&apos;re officially a sparx partner. Your partner
          workspace is ready: share your referral link, earn commissions, run bootcamps, and get
          paid, all from your dashboard.
        </EmailParagraph>
        <EmailParagraph>
          {needsPassword
            ? "We've sent you a separate email with a link to set your password. Once that's done, sign in and open the Partner section to get started."
            : 'Sign in and switch to your new partner workspace to get started.'}
        </EmailParagraph>
        <EmailButton href={dashboardUrl}>Open your dashboard</EmailButton>
      </Section>
    </EmailLayout>
  );
}

export const partnerWelcomeSubject = "You're approved — welcome to the sparx Partner Program";
