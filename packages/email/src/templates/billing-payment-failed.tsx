import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAlert,
  EmailDisplayHeading,
  EmailPayCard,
  EmailParagraph,
  EmailSectionLabel,
  EmailTimeline,
  type TimelineRow,
} from '../components';

export interface BillingPaymentFailedEmailProps {
  /** The tenant's account/business name (falls back to "there"). */
  accountName?: string;
  /** The amount due, pre-formatted with currency (e.g. "$49.00"). */
  amountLabel: string;
  /** Where the tenant updates payment + settles — Stripe's hosted invoice page. */
  updateUrl: string;
  /** The card that was declined, for the payment-method card. Optional. */
  card?: { brandLabel: string; last4: string };
  /** Human date of the failed attempt (e.g. "Aug 10"). Optional. */
  attemptedOnLabel?: string;
  /** The retry schedule shown as a dated "what happens next" timeline. Omit and a
   *  plain reassurance line is shown instead. */
  retries?: TimelineRow[];
}

// PLATFORM email (sparx → the tenant who pays us) — their monthly sparx payment
// failed (`invoice.payment_failed`). sparx-branded; the recipient is the account owner.
export function BillingPaymentFailedEmail({
  accountName,
  amountLabel,
  updateUrl,
  card,
  attemptedOnLabel,
  retries,
}: BillingPaymentFailedEmailProps) {
  return (
    <PlatformEmailLayout
      preview="Update your payment method to keep your sites online."
      mastheadRight="billing@sparx.email"
      footerLinks={[
        { label: 'Update payment', href: updateUrl },
        { label: 'Billing history', href: 'https://sparx.works/settings/billing' },
      ]}
      footerReason="You're receiving this because a payment on your sparx account needs attention."
    >
      <EmailDisplayHeading>Action needed</EmailDisplayHeading>

      <EmailAlert tone="warn" title="We couldn't process your payment">
        Your sites and store are still online — but they&rsquo;ll pause soon if we can&rsquo;t renew
        your subscription.
      </EmailAlert>

      <EmailParagraph>
        Hi {accountName ?? 'there'}, we tried to charge
        {card ? ` your ${card.brandLabel} ending in ${card.last4}` : ' the card on file'} for your
        sparx subscription{attemptedOnLabel ? ` on ${attemptedOnLabel}` : ''}, and it was declined.
        This usually means the card expired, hit a limit, or was replaced by your bank —
        nothing&rsquo;s wrong on your end.
      </EmailParagraph>

      {retries && retries.length > 0 ? (
        <>
          <EmailSectionLabel>What happens next</EmailSectionLabel>
          <EmailTimeline rows={retries} />
        </>
      ) : (
        <EmailParagraph>
          We&rsquo;ll automatically try again over the next few days. Everything stays online in the
          meantime — updating your card now is the quickest way to settle it.
        </EmailParagraph>
      )}

      <EmailPayCard
        brandLabel={card?.brandLabel ?? 'CARD'}
        title={
          card ? `${card.brandLabel} ending in ${card.last4} — declined` : 'Payment method declined'
        }
        note={`Amount due ${amountLabel}${attemptedOnLabel ? ` · Attempted ${attemptedOnLabel}` : ''}`}
      />

      <EmailActionButton href={updateUrl}>Update payment method</EmailActionButton>

      <EmailParagraph flush style={{ marginTop: 18 }}>
        Already updated your card? You can safely ignore this — the next retry will go through.
      </EmailParagraph>
    </PlatformEmailLayout>
  );
}

export const billingPaymentFailedSubject = 'There was a problem with your sparx payment';
