import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailButton, EmailCallout, EmailHeading, EmailMuted, EmailParagraph } from '../components';

export interface MarketSettlementReportEmailProps {
  /** The seller's display name. */
  merchantName: string;
  /** Settlement window, e.g. "June 18 – June 25, 2026". */
  periodLabel: string;
  /** Orders that settled in the period. */
  orderCount: number;
  /** ISO currency code, e.g. "USD". */
  currency: string;
  /** Total sales in the period (integer cents). */
  grossCents: number;
  /** sparx commission deducted (positive integer cents). */
  commissionCents: number;
  /** Commission rate for display, e.g. "2%". */
  commissionRateLabel: string;
  /** Refunds deducted (positive integer cents; may be 0). */
  refundCents: number;
  /** Payout = gross − commission − refunds (integer cents). */
  netCents: number;
  /** e.g. "ACH transfer to account ending 1234". */
  payoutDestination: string;
  /** True when no verified bank account is on file. */
  pendingBankAccount: boolean;
  /** Absolute dashboard URL to the settlement detail. */
  settlementUrl: string;
}

// Format integer cents to a localized currency string. The @sparx/email package
// has no shared cents→currency helper, so this stays local to the one template
// that needs it; money in sparx is always integer cents.
function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

// This is a MERCHANT-facing email (sparx.market → the seller) sent when a weekly
// payout run is computed. It names the seller + period, breaks down the
// settlement math, and either confirms the ACH transfer is on its way or prompts
// the seller to add a payout account.
export function MarketSettlementReportEmail({
  merchantName,
  periodLabel,
  orderCount,
  currency,
  grossCents,
  commissionCents,
  commissionRateLabel,
  refundCents,
  netCents,
  payoutDestination,
  pendingBankAccount,
  settlementUrl,
}: MarketSettlementReportEmailProps) {
  const orderLabel = orderCount === 1 ? 'order' : 'orders';

  return (
    <EmailLayout preview={`Your sparx.market settlement for ${periodLabel}`}>
      <Section>
        <EmailHeading>Your sparx.market settlement</EmailHeading>
        <EmailParagraph>Hi {merchantName},</EmailParagraph>
        <EmailParagraph>
          Here&apos;s your sparx.market settlement for {periodLabel}. You had {orderCount}{' '}
          {orderLabel} settle this period — the breakdown is below.
        </EmailParagraph>

        <EmailCallout>
          Gross sales: {formatCents(grossCents, currency)}
          <br />
          sparx commission ({commissionRateLabel}): −{formatCents(commissionCents, currency)}
          {refundCents > 0 ? (
            <>
              <br />
              Refunds: −{formatCents(refundCents, currency)}
            </>
          ) : null}
          <br />
          <strong>Net payout: {formatCents(netCents, currency)}</strong>
        </EmailCallout>

        {pendingBankAccount ? (
          <>
            <EmailParagraph>
              Your payout is ready, but we don&apos;t have a verified bank account on file yet. Add
              a payout account and we&apos;ll send {formatCents(netCents, currency)} to it.
            </EmailParagraph>
            <EmailButton href={settlementUrl}>Add payout account</EmailButton>
          </>
        ) : (
          <>
            <EmailParagraph>
              Your payout of {formatCents(netCents, currency)} is on its way via {payoutDestination}
              . Transfers typically land in 1–3 business days.
            </EmailParagraph>
            <EmailButton href={settlementUrl}>View settlement</EmailButton>
          </>
        )}

        <EmailMuted>
          sparx commission is deducted at settlement — it&apos;s never charged separately.
        </EmailMuted>
      </Section>
    </EmailLayout>
  );
}

export const marketSettlementReportSubject = (periodLabel: string): string =>
  `Your sparx.market settlement for ${periodLabel}`;
