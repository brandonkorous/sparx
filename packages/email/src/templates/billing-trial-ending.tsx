import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailCallout,
  EmailDisplayHeading,
  EmailParagraph,
  usePlatform,
} from '../components';

export interface BillingTrialEndingEmailProps {
  /** The tenant's account/business name (falls back to "there"). */
  accountName?: string;
  /** When the trial ends, pre-formatted (e.g. "Aug 5, 2026"). */
  trialEndLabel: string;
  /** Where the tenant adds a payment method — the dashboard billing settings. */
  manageUrl: string;
}

// PLATFORM email (sparx → the tenant) — their free trial ends soon
// (`customer.subscription.trial_will_end`, fired ~3 days out). sparx-branded.
export function BillingTrialEndingEmail({
  accountName,
  trialEndLabel,
  manageUrl,
}: BillingTrialEndingEmailProps) {
  const platform = usePlatform();
  return (
    <PlatformEmailLayout
      preview={`Your ${platform.name} trial ends soon`}
      mastheadRight={platform.billingEmail ?? undefined}
      footerLinks={[{ label: 'Billing settings', href: manageUrl }]}
      footerReason={`You're receiving this because your ${platform.name} free trial is ending soon.`}
    >
      <EmailDisplayHeading>Your trial ends soon</EmailDisplayHeading>
      <EmailParagraph>
        Hi {accountName ?? 'there'}, your {platform.name} free trial is almost up — add a payment
        method to keep everything running without a break.
      </EmailParagraph>
      <EmailCallout tone="info">Your trial ends {trialEndLabel}.</EmailCallout>
      <EmailActionButton href={manageUrl}>Add a payment method</EmailActionButton>
      <EmailParagraph flush style={{ marginTop: 18 }}>
        If you don&apos;t add one before then, your account simply pauses until you do — nothing is
        deleted, and you can pick up right where you left off.
      </EmailParagraph>
    </PlatformEmailLayout>
  );
}

export const billingTrialEndingSubject = (platform: string) => `Your ${platform} trial ends soon`;
