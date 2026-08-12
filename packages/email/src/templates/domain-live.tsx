import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAmountHero,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailParagraph,
} from '../components';

export interface DomainLiveEmailProps {
  /** The domain that just went live, e.g. "rosasflowers.com". */
  domainName: string;
  /** The site's live URL (defaults to https://<domainName>). */
  siteUrl?: string;
  /** Dashboard domains settings page. */
  dashboardUrl: string;
}

// PLATFORM email (sparx → domain owner) — a connected/purchased domain finished DNS
// + SSL verification and is now serving the site (domain-worker marks status='active').
// The good-news counterpart to domain-renewal-reminder.
export function DomainLiveEmail({ domainName, siteUrl, dashboardUrl }: DomainLiveEmailProps) {
  const url = siteUrl ?? `https://${domainName}`;
  return (
    <PlatformEmailLayout
      preview={`${domainName} is live`}
      footerLinks={[{ label: 'Domain settings', href: dashboardUrl }]}
      footerReason={`You're receiving this because ${domainName} is connected through sparx.`}
    >
      <EmailDisplayHeading>Your domain is live</EmailDisplayHeading>
      <EmailParagraph>
        Good news — {domainName} is connected, secured with HTTPS, and now serving your site. Anyone
        who visits it lands on your sparx site automatically.
      </EmailParagraph>

      <EmailAmountHero amount={domainName} status={{ label: 'Live', tone: 'success' }} />

      <EmailActionButton href={url}>Visit your site</EmailActionButton>

      <EmailFinePrint>
        Your SSL certificate renews automatically — there&apos;s nothing you need to maintain.
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export function domainLiveSubject(domainName: string): string {
  return `${domainName} is live`;
}
