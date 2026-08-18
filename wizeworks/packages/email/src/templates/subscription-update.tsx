import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAmountHero,
  EmailDisplayHeading,
  EmailParagraph,
  usePlatform,
  type Tone,
} from '../components';

// PLATFORM email (sparx → the paying tenant) — one email for every subscription
// STATE change, published from the Stripe billing webhook
// (`customer.subscription.created|deleted|updated|paused|resumed`). One template
// with a `kind` discriminator rather than five near-identical files: the shape
// (headline + optional amount + one action) is the same; only the words change.
// sparx-branded; recipient is the account's billing contact.

export type SubscriptionUpdateKind = 'started' | 'canceled' | 'plan-changed' | 'paused' | 'resumed';

export interface SubscriptionUpdateEmailProps {
  /** Which state change this is. Drives all the copy. */
  kind: SubscriptionUpdateKind;
  /** Account/business name (falls back to "there"). */
  accountName?: string;
  /** The plan's human name, e.g. "Growth plan". */
  planLabel?: string;
  /** The recurring amount, pre-formatted, e.g. "$49.00 / month". */
  amountLabel?: string;
  /** When the plan is a trial: the trial end date, e.g. "Aug 20, 2026". */
  trialEndLabel?: string;
  /** Next renewal date, e.g. "Sep 1, 2026". */
  renewsOnLabel?: string;
  /** When a change / cancellation takes effect, e.g. "Aug 31, 2026". */
  effectiveLabel?: string;
  /** The dashboard billing settings page. */
  manageUrl: string;
}

interface Copy {
  heading: string;
  lead: string;
  body?: string;
  cta: string;
  tone: Tone;
  showAmount: boolean;
  amountStatus: string;
}

function copyFor(p: SubscriptionUpdateEmailProps): Copy {
  const plan = p.planLabel ?? 'your plan';
  switch (p.kind) {
    case 'started':
      return p.trialEndLabel
        ? {
            heading: 'Your trial has started',
            lead: `You're on ${plan} — free until ${p.trialEndLabel}. Everything's unlocked; explore at your own pace.`,
            body: 'Add a payment method any time before your trial ends and your plan simply continues without a break.',
            cta: 'View billing',
            tone: 'info',
            showAmount: false,
            amountStatus: 'Trial',
          }
        : {
            heading: 'Your plan is active',
            lead: `You're all set on ${plan}. Thanks for subscribing — everything on your plan is unlocked.`,
            body: p.renewsOnLabel ? `Your plan renews on ${p.renewsOnLabel}.` : undefined,
            cta: 'View billing',
            tone: 'success',
            showAmount: true,
            amountStatus: 'Active',
          };
    case 'canceled':
      return {
        heading: 'Your subscription is canceled',
        lead: `We've canceled ${plan}${p.effectiveLabel ? ` — it stays active until ${p.effectiveLabel}` : ''}. We're sorry to see you go.`,
        body: 'Nothing is deleted. Your sites, content, and data are kept safe, and you can reactivate any time to pick up right where you left off.',
        cta: 'Reactivate',
        tone: 'neutral',
        showAmount: false,
        amountStatus: 'Canceled',
      };
    case 'plan-changed':
      return {
        heading: 'Your plan changed',
        lead: `You're now on ${plan}${p.effectiveLabel ? `, effective ${p.effectiveLabel}` : ''}.`,
        body: p.renewsOnLabel ? `Your next renewal is ${p.renewsOnLabel}.` : undefined,
        cta: 'View billing',
        tone: 'info',
        showAmount: true,
        amountStatus: 'New plan',
      };
    case 'paused':
      return {
        heading: 'Your subscription is paused',
        lead: `${plan} is paused because there's no payment method on file. Your sites and store are paused too — nothing is deleted.`,
        body: 'Add a payment method to switch everything back on instantly.',
        cta: 'Add a payment method',
        tone: 'warn',
        showAmount: false,
        amountStatus: 'Paused',
      };
    case 'resumed':
    default:
      return {
        heading: "You're back up and running",
        lead: `${plan} is active again and everything's back online. Thanks for sticking with us.`,
        body: p.renewsOnLabel ? `Your next renewal is ${p.renewsOnLabel}.` : undefined,
        cta: 'View billing',
        tone: 'success',
        showAmount: true,
        amountStatus: 'Active',
      };
  }
}

export function SubscriptionUpdateEmail(props: SubscriptionUpdateEmailProps) {
  const platform = usePlatform();
  const c = copyFor(props);
  const ghost = props.kind !== 'paused';
  const caption =
    props.trialEndLabel && props.kind === 'started'
      ? `Free until ${props.trialEndLabel}`
      : props.renewsOnLabel
        ? `Renews ${props.renewsOnLabel}`
        : props.planLabel;

  return (
    <PlatformEmailLayout
      preview={c.heading}
      mastheadRight={platform.billingEmail ?? undefined}
      footerLinks={[{ label: 'Billing settings', href: props.manageUrl }]}
      footerReason={`You're receiving this because your ${platform.name} subscription status changed.`}
    >
      <EmailDisplayHeading>{c.heading}</EmailDisplayHeading>
      <EmailParagraph>
        {props.accountName ? `Hi ${props.accountName}, ` : ''}
        {c.lead}
      </EmailParagraph>

      {c.showAmount && props.amountLabel ? (
        <EmailAmountHero
          amount={props.amountLabel}
          caption={caption}
          status={{ label: c.amountStatus, tone: c.tone }}
        />
      ) : null}

      {c.body ? <EmailParagraph>{c.body}</EmailParagraph> : null}

      <EmailActionButton href={props.manageUrl} variant={ghost ? 'ghost' : 'primary'}>
        {c.cta}
      </EmailActionButton>
    </PlatformEmailLayout>
  );
}

export function subscriptionUpdateSubject(
  kind: SubscriptionUpdateKind,
  planLabel: string | undefined,
  platform: string
): string {
  switch (kind) {
    case 'started':
      return `Your ${platform} plan is active`;
    case 'canceled':
      return `Your ${platform} subscription is canceled`;
    case 'plan-changed':
      return planLabel ? `You're now on the ${planLabel}` : `Your ${platform} plan changed`;
    case 'paused':
      return `Your ${platform} subscription is paused`;
    case 'resumed':
    default:
      return `Your ${platform} subscription is active again`;
  }
}
