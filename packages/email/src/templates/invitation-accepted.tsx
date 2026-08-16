import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailDisplayHeading,
  EmailParagraph,
  usePlatformName,
} from '../components';

export interface InvitationAcceptedEmailProps {
  /** The inviter's name (falls back to "there") — the recipient of this email. */
  inviterName?: string;
  /** The person who accepted (name, falling back to their email). */
  inviteeName?: string;
  /** The accepter's email, always shown so the inviter can identify them. */
  inviteeEmail: string;
  /** The org/site they joined. */
  orgName: string;
  /** Link to the team/members page. */
  dashboardUrl: string;
}

// PLATFORM email (sparx → the INVITER) — someone accepted a team invitation and is
// now a member. Closes the loop the invite opened.
export function InvitationAcceptedEmail({
  inviterName,
  inviteeName,
  inviteeEmail,
  orgName,
  dashboardUrl,
}: InvitationAcceptedEmailProps) {
  const platform = usePlatformName();
  const who = inviteeName ?? inviteeEmail;
  return (
    <PlatformEmailLayout
      preview={`${who} joined ${orgName}`}
      footerLinks={[{ label: 'Manage team', href: dashboardUrl }]}
      footerReason={`You're receiving this because you invited ${inviteeEmail} to ${orgName}.`}
    >
      <EmailDisplayHeading>{who} joined the team</EmailDisplayHeading>
      <EmailParagraph>
        {inviterName ? `Hi ${inviterName}, ` : ''}good news — <strong>{who}</strong> accepted your
        invitation and now has access to <strong>{orgName}</strong> on {platform}
        {inviteeName ? ` (${inviteeEmail})` : ''}.
      </EmailParagraph>
      <EmailParagraph>
        You can review what they can do, or change their role, from your team settings any time.
      </EmailParagraph>
      <EmailActionButton href={dashboardUrl} variant="ghost">
        Manage team
      </EmailActionButton>
    </PlatformEmailLayout>
  );
}

export function invitationAcceptedSubject(inviteeName: string, platform: string): string {
  return `${inviteeName} joined your team on ${platform}`;
}
