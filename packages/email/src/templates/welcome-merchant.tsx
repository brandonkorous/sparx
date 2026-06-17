import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailButton, EmailHeading, EmailParagraph } from '../components';

export interface WelcomeMerchantEmailProps {
  /** Owner's first name (falls back to "there"). */
  name?: string;
  /** Where to send them to finish onboarding. */
  dashboardUrl: string;
  /** Tenant-editable opening line (rendered after the greeting). */
  intro?: string;
  /** Tenant-editable closing line (rendered after the CTA). */
  outro?: string;
}

// This is a PLATFORM email (sparx → the new account owner) sent at signup, before
// any site is named. It deliberately carries NO site or tenant name — a tenant has
// many sites and names them later, so there is nothing meaningful to greet with
// here (docs/49). The greeting uses the owner's first name; the site is referred to
// generically.
export function WelcomeMerchantEmail({
  name,
  dashboardUrl,
  intro,
  outro,
}: WelcomeMerchantEmailProps) {
  return (
    <EmailLayout preview="Welcome to sparx">
      <Section>
        <EmailHeading>Welcome to sparx</EmailHeading>
        <EmailParagraph>Hi {name ?? 'there'},</EmailParagraph>
        {intro ? <EmailParagraph>{intro}</EmailParagraph> : null}
        <EmailParagraph>
          Your site is live on sparx. A short checklist is waiting in your dashboard — confirm your
          details, add your first page, and pick a theme when the Sitebuilder module ships. You can
          finish it now or come back anytime.
        </EmailParagraph>
        <EmailButton href={dashboardUrl}>Open dashboard</EmailButton>
        {outro ? <EmailParagraph>{outro}</EmailParagraph> : null}
      </Section>
    </EmailLayout>
  );
}

export const welcomeMerchantSubject = 'Welcome to sparx';
