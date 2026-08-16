import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAmountHero,
  EmailDisplayHeading,
  EmailLineItems,
  EmailPayCard,
  EmailParagraph,
  EmailSectionLabel,
  usePlatform,
  type LineItem,
  type SummaryRow,
} from '../components';

export interface BillingReceiptEmailProps {
  /** The tenant's account/business name, for a light greeting (falls back to "there"). */
  accountName?: string;
  /** The amount paid, pre-formatted with currency (e.g. "$49.00"). */
  amountLabel: string;
  /** The billing period this invoice covers (e.g. "Jul 1 – Jul 31, 2026"). Optional. */
  periodLabel?: string;
  /** Stripe's hosted invoice/receipt page. */
  invoiceUrl: string;
  /** Human date the charge landed (e.g. "Aug 1, 2026"). Optional. */
  chargedOnLabel?: string;
  /** Itemized lines. Omit and the receipt shows a single "sparx subscription" line
   *  for `amountLabel` — so an existing single-amount call site still renders a real
   *  table, and a richer caller can pass the true breakdown. */
  lineItems?: LineItem[];
  /** Summary rows between the lines and the total (e.g. Subtotal, Tax). Optional. */
  summary?: SummaryRow[];
  /** The card charged, for the payment-method card. Optional. */
  paymentMethod?: { brandLabel: string; last4: string; note?: string };
  /** Receipt id shown on the masthead + footer (e.g. "SPX-2026-0810"). Optional. */
  receiptNumber?: string;
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
  chargedOnLabel,
  lineItems,
  summary,
  paymentMethod,
  receiptNumber,
}: BillingReceiptEmailProps) {
  const platform = usePlatform();
  const items: LineItem[] =
    lineItems && lineItems.length > 0
      ? lineItems
      : [
          {
            title: `${platform.name} subscription`,
            subtitle: periodLabel ? `Billing period · ${periodLabel}` : undefined,
            amount: amountLabel,
          },
        ];

  const caption = chargedOnLabel
    ? `Charged ${chargedOnLabel}`
    : periodLabel
      ? `Billing period · ${periodLabel}`
      : undefined;

  return (
    <PlatformEmailLayout
      preview={`Payment received${periodLabel ? ` for ${periodLabel}` : ''} — thanks!`}
      mastheadRight={receiptNumber ? `RECEIPT · ${receiptNumber}` : 'RECEIPT'}
      footerLinks={
        platform.appUrl
          ? [
              { label: 'Billing history', href: `${platform.appUrl}/settings/billing` },
              { label: 'Manage plan', href: `${platform.appUrl}/settings/billing` },
            ]
          : undefined
      }
      footerReason={
        receiptNumber
          ? `Receipt ${receiptNumber} for your ${platform.name} subscription.`
          : `A receipt for your ${platform.name} subscription.`
      }
    >
      <EmailDisplayHeading>Payment received</EmailDisplayHeading>
      <EmailParagraph>
        Thanks{accountName ? `, ${accountName}` : ''} — your {platform.name} subscription is paid
        and there is nothing you need to do.
      </EmailParagraph>

      <EmailAmountHero
        amount={amountLabel}
        caption={caption}
        status={{ label: 'Paid', tone: 'success' }}
      />

      <EmailSectionLabel>What you paid for</EmailSectionLabel>
      <EmailLineItems
        items={items}
        summary={summary}
        total={{ label: 'Total paid', value: amountLabel }}
      />

      {paymentMethod ? (
        <EmailPayCard
          brandLabel={paymentMethod.brandLabel}
          title={`${paymentMethod.brandLabel} ending in ${paymentMethod.last4}`}
          note={paymentMethod.note ?? (chargedOnLabel ? `Charged ${chargedOnLabel}` : undefined)}
        />
      ) : null}

      <EmailActionButton href={invoiceUrl} variant="ghost">
        View full invoice
      </EmailActionButton>

      <EmailParagraph flush style={{ marginTop: 18 }}>
        Questions about this charge? Just reply
        {platform.billingEmail ? `, or reach us at ${platform.billingEmail}` : ''}.
      </EmailParagraph>
    </PlatformEmailLayout>
  );
}

export const billingReceiptSubject = (platform: string) => `Your ${platform} receipt`;
