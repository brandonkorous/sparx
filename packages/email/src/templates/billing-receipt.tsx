import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailButton, EmailCallout, EmailHeading, EmailParagraph } from '../components';

export interface BillingReceiptEmailProps {
  /** The tenant's account/business name, for a light greeting (falls back to "there"). */
  accountName?: string;
  /** The amount paid, pre-formatted with currency (e.g. "$49.00"). */
  amountLabel: string;
  /** The billing period this invoice covers (e.g. "Jul 1 – Jul 31, 2026"). Optional. */
  periodLabel?: string;
  /** Stripe's hosted invoice/receipt page. */
  invoiceUrl: string;
}

// PLATFORM email (sparx → the tenant who pays us) — the receipt for their monthly
// sparx subscription, sent on `invoice.payment_succeeded`. Distinct from a tenant's
// OWN customer receipts (those are Builder-authored, tenant-branded). This one is
// sparx-branded.
export function BillingReceiptEmail({
  accountName,
  amountLabel,
  periodLabel,
  invoiceUrl,
}: BillingReceiptEmailProps) {
  return (
    <EmailLayout preview="Your sparx receipt">
      <Section>
        <EmailHeading>Thanks — your payment went through</EmailHeading>
        <EmailParagraph>
          Hi {accountName ?? 'there'}, here’s your receipt for your sparx subscription.
        </EmailParagraph>
        <EmailCallout tone="success">
          Paid: {amountLabel}
          {periodLabel ? ` · ${periodLabel}` : ''}
        </EmailCallout>
        <EmailButton href={invoiceUrl}>View your invoice</EmailButton>
        <EmailParagraph>You’re all set — there’s nothing you need to do.</EmailParagraph>
      </Section>
    </EmailLayout>
  );
}

export const billingReceiptSubject = 'Your sparx receipt';
