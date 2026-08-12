import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailDisplayHeading,
  EmailLead,
  EmailParagraph,
  EmailSteps,
} from '../components';

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
    <PlatformEmailLayout
      preview="Your account's ready — three quick steps and you're online."
      footerLinks={[
        { label: 'Help center', href: 'https://sparx.works/help' },
        { label: 'Getting started', href: 'https://sparx.works/docs' },
      ]}
      footerReason="You're receiving this because you created a sparx account."
    >
      <EmailDisplayHeading>Welcome to sparx{name ? `, ${name}` : ''}.</EmailDisplayHeading>
      <EmailLead>
        Everything you need to run your business online — a website, a store, a mailing list — now
        lives in one place.
      </EmailLead>
      {intro ? <EmailParagraph>{intro}</EmailParagraph> : null}
      <EmailParagraph>
        Your site is live on sparx. There&rsquo;s no rush, but here&rsquo;s the quickest path to
        getting it ready — most people are up and running in about ten minutes.
      </EmailParagraph>

      <EmailSteps
        steps={[
          {
            title: 'Confirm your details',
            description: 'Name your site and set a web address. You can change both later.',
          },
          {
            title: 'Add your first page',
            description: 'Start from a ready-made template or a blank canvas — no code, ever.',
          },
          {
            title: 'Turn on what you need',
            description:
              'A store, a blog, bookings, email. Switch on only what you use — you pay for nothing else.',
          },
        ]}
      />

      <EmailActionButton href={dashboardUrl}>Open your dashboard</EmailActionButton>

      {outro ? <EmailParagraph>{outro}</EmailParagraph> : null}
      <EmailParagraph flush>
        Glad you&rsquo;re here. Reply to this email anytime — a real person reads it.
      </EmailParagraph>
    </PlatformEmailLayout>
  );
}

export const welcomeMerchantSubject = 'Welcome to sparx';
