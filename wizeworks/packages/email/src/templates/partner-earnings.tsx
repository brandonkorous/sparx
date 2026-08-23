import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAmountHero,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailParagraph,
  usePlatformName,
  type Tone,
} from '../components';

export type PartnerEarningsKind = 'referral' | 'commission' | 'payout';

export interface PartnerEarningsEmailProps {
  /** Which earnings event this is. */
  kind: PartnerEarningsKind;
  /** The partner's name (falls back to "there"). */
  partnerName?: string;
  /** The amount, pre-formatted (e.g. "$120.00"). Required for commission/payout. */
  amountLabel?: string;
  /** Link to the partner dashboard / earnings page. */
  dashboardUrl: string;
}

interface Copy {
  heading: string;
  lead: string;
  cta: string;
  status: string;
  tone: Tone;
  fine: string;
}

function copyFor(p: PartnerEarningsEmailProps): Copy {
  switch (p.kind) {
    case 'referral':
      return {
        heading: 'You have a new referral',
        lead: 'Someone signed up through your referral link. When they start paying, you start earning — we&rsquo;ll let you know the moment your first commission lands.',
        cta: 'View referrals',
        status: 'Referred',
        tone: 'info',
        fine: 'Commissions accrue automatically once a referral becomes a paying customer.',
      };
    case 'commission':
      return {
        heading: 'You earned a commission',
        lead: 'One of your referrals just paid, so a commission has been added to your balance. It&rsquo;ll be included in your next payout.',
        cta: 'View earnings',
        status: 'Earned',
        tone: 'success',
        fine: 'Payouts run on a regular schedule once your balance clears the minimum.',
      };
    case 'payout':
    default:
      return {
        heading: 'Your payout is on the way',
        lead: 'We&rsquo;ve sent your partner earnings to your connected account. Transfers typically land in 1&ndash;3 business days.',
        cta: 'View payout',
        status: 'Paid',
        tone: 'success',
        fine: 'This covers all commissions cleared since your last payout.',
      };
  }
}

// PLATFORM email (sparx → the partner) — one email for the three partner-earnings
// moments (a referral signed up, a commission accrued, a payout was sent).
export function PartnerEarningsEmail(props: PartnerEarningsEmailProps) {
  const platform = usePlatformName();
  const c = copyFor(props);
  return (
    <PlatformEmailLayout
      preview={c.heading}
      mastheadRight="partners"
      footerLinks={[{ label: 'Partner dashboard', href: props.dashboardUrl }]}
      footerReason={`You're receiving this because you're a ${platform} partner.`}
    >
      <EmailDisplayHeading>{c.heading}</EmailDisplayHeading>
      <EmailParagraph>
        {props.partnerName ? `Hi ${props.partnerName}, ` : ''}
        {c.lead}
      </EmailParagraph>

      {props.amountLabel ? (
        <EmailAmountHero amount={props.amountLabel} status={{ label: c.status, tone: c.tone }} />
      ) : null}

      <EmailActionButton
        href={props.dashboardUrl}
        variant={props.kind === 'payout' ? 'ghost' : 'primary'}
      >
        {c.cta}
      </EmailActionButton>

      <EmailFinePrint>{c.fine}</EmailFinePrint>
    </PlatformEmailLayout>
  );
}

/** A subject is a string, not a component, so it cannot read the brand context
 *  the body reads — `send.tsx` resolves the name once and passes it in. Every one
 *  of these said "sparx" to whoever the partner belonged to. */
export function partnerEarningsSubject(
  kind: PartnerEarningsKind,
  platform: string,
  amountLabel?: string
): string {
  switch (kind) {
    case 'referral':
      return `You have a new referral on ${platform}`;
    case 'commission':
      return amountLabel ? `You earned ${amountLabel} on ${platform}` : 'You earned a commission';
    case 'payout':
    default:
      return amountLabel ? `Your ${amountLabel} payout is on the way` : 'Your payout is on the way';
  }
}
