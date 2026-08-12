import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAmountHero,
  EmailDisplayHeading,
  EmailLineItems,
  EmailParagraph,
  EmailPayCard,
  EmailSectionLabel,
  EmailFinePrint,
  type LineItem,
  type SummaryRow,
} from '../components';

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
  const net = formatCents(netCents, currency);

  const items: LineItem[] = [
    {
      title: 'Gross sales',
      subtitle: `${orderCount} ${orderLabel} settled`,
      amount: formatCents(grossCents, currency),
    },
  ];
  const summary: SummaryRow[] = [
    {
      label: `sparx commission (${commissionRateLabel})`,
      value: `−${formatCents(commissionCents, currency)}`,
    },
  ];
  if (refundCents > 0) {
    summary.push({ label: 'Refunds', value: `−${formatCents(refundCents, currency)}` });
  }

  return (
    <PlatformEmailLayout
      preview={`Your sparx.market settlement for ${periodLabel}`}
      mastheadRight="sparx.market"
      footerLinks={[{ label: 'View settlement', href: settlementUrl }]}
      footerReason="You're receiving this because you sell on sparx.market."
    >
      <EmailDisplayHeading>Your sparx.market settlement</EmailDisplayHeading>
      <EmailParagraph>
        Hi {merchantName}, here&apos;s your settlement for {periodLabel}.
      </EmailParagraph>

      <EmailAmountHero
        amount={net}
        caption={`Net payout · ${periodLabel}`}
        status={
          pendingBankAccount
            ? { label: 'Action needed', tone: 'warn' }
            : { label: 'On its way', tone: 'success' }
        }
      />

      <EmailSectionLabel>Settlement breakdown</EmailSectionLabel>
      <EmailLineItems items={items} summary={summary} total={{ label: 'Net payout', value: net }} />

      {pendingBankAccount ? (
        <>
          <EmailParagraph style={{ marginTop: 20 }}>
            Your payout is ready, but we don&apos;t have a verified bank account on file yet. Add a
            payout account and we&apos;ll send {net} to it.
          </EmailParagraph>
          <EmailActionButton href={settlementUrl}>Add payout account</EmailActionButton>
        </>
      ) : (
        <>
          <EmailPayCard
            brandLabel="ACH"
            title={payoutDestination}
            note="Transfers typically land in 1–3 business days."
          />
          <EmailActionButton href={settlementUrl} variant="ghost">
            View settlement
          </EmailActionButton>
        </>
      )}

      <EmailFinePrint>
        sparx commission is deducted at settlement — it&apos;s never charged separately.
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export const marketSettlementReportSubject = (periodLabel: string): string =>
  `Your sparx.market settlement for ${periodLabel}`;
