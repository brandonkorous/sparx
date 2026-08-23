import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailDisplayHeading,
  EmailLead,
  EmailParagraph,
  EmailSteps,
  usePlatform,
  usePlatformName,
} from '../components';

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
  const { url } = usePlatform();
  const platform = usePlatformName();
  return (
    <PlatformEmailLayout
      preview={`You're approved — welcome to the ${platform} Partner Program`}
      footerLinks={url ? [{ label: 'Partner guide', href: `${url}/partners` }] : []}
      footerReason={`You're receiving this because your ${platform} partner application was approved.`}
    >
      <EmailDisplayHeading>
        Welcome to the Partner Program{name ? `, ${name}` : ''}.
      </EmailDisplayHeading>
      <EmailLead>
        You&apos;re officially a {platform} partner — your workspace is ready and there&apos;s money
        to be made.
      </EmailLead>
      <EmailParagraph>Here&apos;s how to get going:</EmailParagraph>

      <EmailSteps
        steps={[
          {
            title: needsPassword ? 'Set your password' : 'Sign in to your workspace',
            description: needsPassword
              ? "We've sent a separate email with a link to set your password — do that first, then sign in."
              : 'Switch to your new partner workspace from the account menu.',
          },
          {
            title: 'Share your referral link',
            description: 'Every sign-up through your link is tracked to you automatically.',
          },
          {
            title: 'Earn, run bootcamps, and get paid',
            description: 'Watch commissions accrue and manage payouts, all from your dashboard.',
          },
        ]}
      />

      <EmailActionButton href={dashboardUrl}>Open your dashboard</EmailActionButton>
    </PlatformEmailLayout>
  );
}

/** A function rather than a constant, because a constant cannot ask which brand
 *  approved them — `send.tsx` resolves the name once per send. */
export const partnerWelcomeSubject = (platform: string): string =>
  `You're approved — welcome to the ${platform} Partner Program`;
