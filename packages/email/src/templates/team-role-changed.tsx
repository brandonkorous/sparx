import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAmountHero,
  EmailDisplayHeading,
  EmailParagraph,
} from '../components';

export interface TeamRoleChangedEmailProps {
  /** The affected member's name (falls back to "there"). */
  memberName?: string;
  /** The org/site the role is in. */
  orgName: string;
  /** Their new role, e.g. "admin", "editor", "viewer". */
  newRole: string;
  /** Link to the workspace. */
  dashboardUrl: string;
}

// PLATFORM email (sparx → the affected member) — an admin changed their role in a
// workspace. Tells them what they can do now.
export function TeamRoleChangedEmail({
  memberName,
  orgName,
  newRole,
  dashboardUrl,
}: TeamRoleChangedEmailProps) {
  return (
    <PlatformEmailLayout
      preview={`Your role in ${orgName} is now ${newRole}`}
      footerLinks={[{ label: 'Open workspace', href: dashboardUrl }]}
      footerReason={`You're receiving this because your role in ${orgName} on sparx changed.`}
    >
      <EmailDisplayHeading>Your role changed</EmailDisplayHeading>
      <EmailParagraph>
        {memberName ? `Hi ${memberName}, ` : ''}your role in <strong>{orgName}</strong> on sparx has
        been updated.
      </EmailParagraph>

      <EmailAmountHero
        amount={newRole}
        caption={orgName}
        status={{ label: 'New role', tone: 'info' }}
      />

      <EmailParagraph>
        This changes what you can see and do in the workspace. Sign in to pick up where you left
        off.
      </EmailParagraph>
      <EmailActionButton href={dashboardUrl} variant="ghost">
        Open workspace
      </EmailActionButton>
    </PlatformEmailLayout>
  );
}

export function teamRoleChangedSubject(orgName: string): string {
  return `Your role in ${orgName} changed`;
}
