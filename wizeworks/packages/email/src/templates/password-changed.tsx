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

export interface PasswordChangedEmailProps {
  /** Recipient's name (falls back to "there"). */
  name?: string;
  /** When it changed, human or ISO — rendered verbatim if present. */
  changedAtLabel?: string;
  /** "This wasn't me" link — the reset/security page. Optional. */
  secureUrl?: string;
}

// PLATFORM security email (sparx → account owner) — their password was just changed.
// A confirmation with a clear path to act if it wasn't them.
export function PasswordChangedEmail({
  name,
  changedAtLabel,
  secureUrl,
}: PasswordChangedEmailProps) {
  const platform = usePlatformName();
  return (
    <PlatformEmailLayout
      preview={`Your ${platform} password was changed`}
      footerReason={`You're receiving this because your ${platform} password was changed.`}
    >
      <EmailDisplayHeading>Your password was changed</EmailDisplayHeading>
      <EmailParagraph>
        {name ? `Hi ${name}, ` : ''}this is a confirmation that the password for your {platform}{' '}
        account was just changed{changedAtLabel ? ` on ${changedAtLabel}` : ''}. If this was you,
        you&apos;re all set — no further action needed.
      </EmailParagraph>

      <EmailAlert tone="warn" title="Didn't change your password?">
        Your account may be at risk. Reset your password right away and review your recent sign-ins.
      </EmailAlert>

      {secureUrl ? (
        <EmailActionButton href={secureUrl}>Secure your account</EmailActionButton>
      ) : null}

      <EmailFinePrint>
        For your security, we never include your password in an email.
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export const passwordChangedSubject = (platform: string) => `Your ${platform} password was changed`;
