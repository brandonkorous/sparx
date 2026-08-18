import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailCallout,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailParagraph,
  usePlatformName,
} from '../components';

export interface DomainRenewalReminderEmailProps {
  /** The domain name, e.g. "acme.com". */
  domainName: string;
  /** Days until expiry: 30, 14, or 7. */
  daysUntilExpiry: number;
  /** Human-readable expiry date, e.g. "August 9, 2026". */
  expiresAt: string;
  /** Link to the dashboard Domains settings page. */
  renewUrl: string;
  /** Whether auto-renew is enabled (changes the CTA copy). */
  autoRenew?: boolean;
}

export function DomainRenewalReminderEmail({
  domainName,
  daysUntilExpiry,
  expiresAt,
  renewUrl,
  autoRenew,
}: DomainRenewalReminderEmailProps) {
  const platform = usePlatformName();
  const dayLabel = daysUntilExpiry === 1 ? 'day' : 'days';
  const tone = daysUntilExpiry <= 7 ? 'warn' : 'info';

  return (
    <PlatformEmailLayout
      preview={`${domainName} expires in ${daysUntilExpiry} ${dayLabel}`}
      footerReason={`You're receiving this because ${domainName} is registered through ${platform}.`}
    >
      <EmailDisplayHeading>Domain expiring soon</EmailDisplayHeading>
      <EmailCallout tone={tone}>
        {domainName} expires in {daysUntilExpiry} {dayLabel} — on {expiresAt}.
      </EmailCallout>
      {autoRenew ? (
        <>
          <EmailParagraph>
            Auto-renew is enabled, so {domainName} will renew automatically before the expiry date.
            No action is needed unless you want to change your renewal settings.
          </EmailParagraph>
          <EmailActionButton href={renewUrl} variant="ghost">
            Manage domain
          </EmailActionButton>
        </>
      ) : (
        <>
          <EmailParagraph>
            Renew now to keep {domainName} active and avoid losing your site&apos;s custom address.
          </EmailParagraph>
          <EmailActionButton href={renewUrl}>Renew domain</EmailActionButton>
        </>
      )}
      <EmailFinePrint>
        Visit your domain settings anytime to update renewal preferences.
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export function domainRenewalReminderSubject(domainName: string, daysUntilExpiry: number): string {
  const label = daysUntilExpiry === 1 ? 'day' : 'days';
  return `${domainName} expires in ${daysUntilExpiry} ${label}`;
}
