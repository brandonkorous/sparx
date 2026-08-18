import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAlert,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailParagraph,
  usePlatformName,
} from '../components';

export interface TwoFactorChangedEmailProps {
  /** true = 2FA turned on, false = turned off. */
  enabled: boolean;
  /** Recipient's name (falls back to "there"). */
  name?: string;
  /** "This wasn't me" link — the security page. Optional. */
  secureUrl?: string;
}

// PLATFORM security email (sparx → account owner) — two-factor authentication was
// enabled or disabled on their account.
export function TwoFactorChangedEmail({ enabled, name, secureUrl }: TwoFactorChangedEmailProps) {
  const platform = usePlatformName();
  return (
    <PlatformEmailLayout
      preview={
        enabled ? 'Two-factor authentication is on' : 'Two-factor authentication was turned off'
      }
      footerReason={`You're receiving this because a security setting on your ${platform} account changed.`}
    >
      <EmailDisplayHeading>
        {enabled ? 'Two-factor is on' : 'Two-factor was turned off'}
      </EmailDisplayHeading>
      <EmailParagraph>
        {name ? `Hi ${name}, ` : ''}
        {enabled
          ? `Two-factor authentication is now protecting your ${platform} account. From now on, signing in needs your password and a one-time code — nice work locking things down.`
          : `Two-factor authentication has been turned off for your ${platform} account. Signing in now needs only your password.`}
      </EmailParagraph>

      <EmailAlert
        tone={enabled ? 'warn' : 'danger'}
        title={`Didn't ${enabled ? 'enable' : 'turn off'} two-factor?`}
      >
        If this wasn&apos;t you, someone may have access to your account. Reset your password and
        review your security settings right away.
      </EmailAlert>

      {secureUrl ? (
        <EmailActionButton href={secureUrl} variant={enabled ? 'ghost' : 'primary'}>
          Review security settings
        </EmailActionButton>
      ) : null}

      <EmailFinePrint>
        {enabled
          ? 'Keep your backup codes somewhere safe — they let you back in if you lose your device.'
          : 'We recommend keeping two-factor on for the best protection.'}
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export function twoFactorChangedSubject(enabled: boolean, platform: string): string {
  return enabled
    ? `Two-factor authentication is on for your ${platform} account`
    : 'Two-factor authentication was turned off';
}
