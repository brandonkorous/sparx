import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailButton, EmailCallout, EmailHeading, EmailMuted, EmailParagraph } from '../components';

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
  const dayLabel = daysUntilExpiry === 1 ? 'day' : 'days';
  const tone = daysUntilExpiry <= 7 ? 'warn' : 'info';

  return (
    <EmailLayout preview={`${domainName} expires in ${daysUntilExpiry} ${dayLabel}`}>
      <Section>
        <EmailHeading>Domain expiring soon</EmailHeading>
        <EmailCallout tone={tone}>
          {domainName} expires in {daysUntilExpiry} {dayLabel} — on {expiresAt}.
        </EmailCallout>
        {autoRenew ? (
          <>
            <EmailParagraph>
              Auto-renew is enabled, so {domainName} will renew automatically before the expiry
              date. No action is needed unless you want to change your renewal settings.
            </EmailParagraph>
            <EmailButton href={renewUrl}>Manage domain</EmailButton>
          </>
        ) : (
          <>
            <EmailParagraph>
              Renew now to keep {domainName} active and avoid losing your site&apos;s custom
              address.
            </EmailParagraph>
            <EmailButton href={renewUrl}>Renew domain</EmailButton>
          </>
        )}
        <EmailMuted>
          You&apos;re receiving this because {domainName} is registered through sparx. Visit your
          domain settings to update renewal preferences.
        </EmailMuted>
      </Section>
    </EmailLayout>
  );
}

export function domainRenewalReminderSubject(domainName: string, daysUntilExpiry: number): string {
  const label = daysUntilExpiry === 1 ? 'day' : 'days';
  return `${domainName} expires in ${daysUntilExpiry} ${label}`;
}
