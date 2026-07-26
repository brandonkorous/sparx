import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailButton, EmailCallout, EmailHeading, EmailParagraph } from '../components';

export interface BillingPaymentFailedEmailProps {
  /** The tenant's account/business name (falls back to "there"). */
  accountName?: string;
  /** The amount due, pre-formatted with currency (e.g. "$49.00"). */
  amountLabel: string;
  /** Where the tenant updates payment + settles — Stripe's hosted invoice page. */
  updateUrl: string;
}

// PLATFORM email (sparx → the tenant who pays us) — their monthly sparx payment
// failed (`invoice.payment_failed`). sparx-branded; the recipient is the account owner.
export function BillingPaymentFailedEmail({
  accountName,
  amountLabel,
  updateUrl,
}: BillingPaymentFailedEmailProps) {
  return (
    <EmailLayout preview="There was a problem with your sparx payment">
      <Section>
        <EmailHeading>There was a problem with your payment</EmailHeading>
        <EmailParagraph>
          Hi {accountName ?? 'there'}, we couldn’t process the payment for your sparx subscription.
        </EmailParagraph>
        <EmailCallout tone="warn">Amount due: {amountLabel}</EmailCallout>
        <EmailButton href={updateUrl}>Update payment</EmailButton>
        <EmailParagraph>
          Update your payment details to keep your modules running without interruption. We’ll retry
          automatically once it’s sorted.
        </EmailParagraph>
      </Section>
    </EmailLayout>
  );
}

export const billingPaymentFailedSubject = 'There was a problem with your sparx payment';
