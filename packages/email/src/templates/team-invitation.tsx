import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailCallout,
  EmailDisplayHeading,
  EmailFallbackLink,
  EmailFinePrint,
  EmailParagraph,
  usePlatformName,
} from '../components';

// Team invitation — "{Inviter} invited you to join {Org} on sparx" (docs/114 §A.4).
// Published as an `email.send` event by the Better Auth organization plugin's
// `sendInvitationEmail` callback (packages/auth/src/server.ts) when an admin/owner
// invites a member. The button carries the invitation id to /accept-invite, where
// the recipient (signed in as the invited address) accepts and the `members` row
// is created.

export interface TeamInvitationEmailProps {
  /** The address the invite was sent to — shown so the recipient knows which
   *  account must accept it. */
  inviteeEmail: string;
  /** Human name of the tenant/organization they're being invited into. */
  orgName: string;
  /** Who sent the invite (name, falling back to their email). */
  inviterName: string;
  /** The role they'll hold once they accept (e.g. "editor", "admin"). */
  role: string;
  /** Fully-qualified /accept-invite URL carrying the invitation id. */
  acceptUrl: string;
  /** How long the invite is valid, in days (for the expiry note). */
  expiresInDays: number;
}

export function TeamInvitationEmail({
  inviteeEmail,
  orgName,
  inviterName,
  role,
  acceptUrl,
  expiresInDays,
}: TeamInvitationEmailProps) {
  const platform = usePlatformName();
  return (
    <PlatformEmailLayout
      preview={`${inviterName} invited you to join ${orgName} on ${platform}`}
      footerReason={`You're receiving this because ${inviterName} invited you to ${orgName} on ${platform}.`}
    >
      <EmailDisplayHeading>You&apos;re invited to join {orgName}</EmailDisplayHeading>
      <EmailParagraph>
        {inviterName} invited you to join <strong>{orgName}</strong> on {platform} as a{' '}
        <strong>{role}</strong>. Accept the invitation to get access to the workspace.
      </EmailParagraph>
      <EmailCallout tone="info">
        This invitation was sent to {inviteeEmail}. Sign in with that address (or create an account
        for it) to accept.
      </EmailCallout>
      <EmailActionButton href={acceptUrl}>Accept invitation</EmailActionButton>
      <EmailFallbackLink url={acceptUrl} />
      <EmailFinePrint>
        This invitation expires in {expiresInDays} days. If you weren&apos;t expecting it, you can
        safely ignore this email.
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export function teamInvitationSubject(orgName: string, platform: string): string {
  return `You're invited to join ${orgName} on ${platform}`;
}
