import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAlert,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailParagraph,
} from '../components';

export interface DomainExpiredEmailProps {
  /** The domain that expired, e.g. "rosasflowers.com". */
  domainName: string;
  /** Human date it expired, e.g. "August 9, 2026". Optional. */
  expiredOnLabel?: string;
  /** Dashboard domains settings page (where they renew). */
  renewUrl: string;
}

// PLATFORM email (sparx → domain owner) — a purchased domain has passed its expiry
// date without renewing. Sent from the nightly domain cron once, post-expiry (the
// renewal reminders only fire BEFORE expiry). Higher-urgency than the reminders.
export function DomainExpiredEmail({
  domainName,
  expiredOnLabel,
  renewUrl,
}: DomainExpiredEmailProps) {
  return (
    <PlatformEmailLayout
      preview={`${domainName} has expired — renew to keep your address`}
      footerLinks={[{ label: 'Domain settings', href: renewUrl }]}
      footerReason={`You're receiving this because ${domainName} is registered through sparx.`}
    >
      <EmailDisplayHeading>Your domain has expired</EmailDisplayHeading>

      <EmailAlert tone="danger" title={`${domainName} has expired`}>
        {expiredOnLabel ? `It lapsed on ${expiredOnLabel}. ` : ''}Visitors may no longer be able to
        reach your site at this address.
      </EmailAlert>

      <EmailParagraph>
        There&apos;s still a short window to renew {domainName} and keep it — after the grace
        period, it&apos;s released and anyone can register it. Renew now to avoid losing your
        address.
      </EmailParagraph>

      <EmailActionButton href={renewUrl}>Renew domain</EmailActionButton>

      <EmailFinePrint>
        Your site and content are safe either way — only the custom web address is affected.
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export function domainExpiredSubject(domainName: string): string {
  return `${domainName} has expired`;
}
