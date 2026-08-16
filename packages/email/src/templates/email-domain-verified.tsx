import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAmountHero,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailParagraph,
  usePlatformName,
} from '../components';

export interface EmailDomainVerifiedEmailProps {
  /** The sending domain that just verified, e.g. "mail.rosasflowers.com". */
  domainName: string;
  /** Dashboard email-settings / domains page. */
  dashboardUrl: string;
}

// PLATFORM email (sparx → account owner) — a custom SENDING domain finished DNS
// verification in Mailgun, so the tenant can now send email from their own domain.
// Fired from the email-domains verify endpoint on the pending→verified transition.
export function EmailDomainVerifiedEmail({
  domainName,
  dashboardUrl,
}: EmailDomainVerifiedEmailProps) {
  const platform = usePlatformName();
  return (
    <PlatformEmailLayout
      preview={`You can now send email from ${domainName}`}
      footerLinks={[{ label: 'Email settings', href: dashboardUrl }]}
      footerReason={`You're receiving this because ${domainName} was set up as a sending domain in ${platform}.`}
    >
      <EmailDisplayHeading>Your sending domain is ready</EmailDisplayHeading>
      <EmailParagraph>
        {domainName} passed verification. Your emails — broadcasts, automations, and receipts — now
        send from your own domain, which helps them land in the inbox instead of the spam folder.
      </EmailParagraph>

      <EmailAmountHero amount={domainName} status={{ label: 'Verified', tone: 'success' }} />

      <EmailActionButton href={dashboardUrl}>Go to email settings</EmailActionButton>

      <EmailFinePrint>
        Keep the DNS records we provided in place — removing them will stop your email from sending.
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export function emailDomainVerifiedSubject(domainName: string): string {
  return `You can now send email from ${domainName}`;
}
