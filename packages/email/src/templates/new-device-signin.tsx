import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailLineItems,
  EmailParagraph,
  EmailSectionLabel,
  type LineItem,
} from '../components';

export interface NewDeviceSigninEmailProps {
  /** Recipient's name (falls back to "there"). */
  name?: string;
  /** Approximate location, e.g. "San Diego, CA". Optional. */
  location?: string;
  /** The IP address the sign-in came from. Optional. */
  ipAddress?: string;
  /** The device / browser, e.g. "Chrome on macOS". Optional. */
  device?: string;
  /** When it happened, human or ISO. Optional. */
  signedInAtLabel?: string;
  /** "This wasn't me" link — the security page. Optional. */
  secureUrl?: string;
}

// PLATFORM security email (sparx → account owner) — a sign-in from a device we
// haven't seen before. The details let them recognize it or act.
export function NewDeviceSigninEmail({
  name,
  location,
  ipAddress,
  device,
  signedInAtLabel,
  secureUrl,
}: NewDeviceSigninEmailProps) {
  const rows: LineItem[] = [];
  if (device) rows.push({ title: 'Device', amount: device });
  if (location) rows.push({ title: 'Location', amount: location });
  if (ipAddress) rows.push({ title: 'IP address', amount: ipAddress });
  if (signedInAtLabel) rows.push({ title: 'When', amount: signedInAtLabel });

  return (
    <PlatformEmailLayout
      preview="New sign-in to your sparx account"
      footerReason="You're receiving this because someone signed in to your sparx account from a new device."
    >
      <EmailDisplayHeading>New sign-in to your account</EmailDisplayHeading>
      <EmailParagraph>
        {name ? `Hi ${name}, ` : ''}your sparx account was just signed into from a device we
        haven&apos;t seen before. If this was you, you can safely ignore this email.
      </EmailParagraph>

      {rows.length > 0 ? (
        <>
          <EmailSectionLabel>Sign-in details</EmailSectionLabel>
          <EmailLineItems items={rows} />
        </>
      ) : null}

      <EmailParagraph>
        Don&apos;t recognize this? Secure your account now — reset your password and sign out other
        sessions.
      </EmailParagraph>

      {secureUrl ? (
        <EmailActionButton href={secureUrl}>Secure your account</EmailActionButton>
      ) : null}

      <EmailFinePrint>
        We send this the first time we see a new device, so you always know who&apos;s getting in.
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export const newDeviceSigninSubject = 'New sign-in to your sparx account';
