import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailButton, EmailCallout, EmailHeading, EmailParagraph } from '../components';

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
  return (
    <EmailLayout preview="Your sparx trial ends soon">
      <Section>
        <EmailHeading>Your trial ends soon</EmailHeading>
        <EmailParagraph>
          Hi {accountName ?? 'there'}, your sparx free trial is almost up.
        </EmailParagraph>
        <EmailCallout tone="info">Your trial ends {trialEndLabel}</EmailCallout>
        <EmailButton href={manageUrl}>Add a payment method</EmailButton>
        <EmailParagraph>
          Add a payment method before then to keep your modules running. If you don’t, your account
          pauses until you do — nothing is deleted.
        </EmailParagraph>
      </Section>
    </EmailLayout>
  );
}

export const billingTrialEndingSubject = 'Your sparx trial ends soon';
