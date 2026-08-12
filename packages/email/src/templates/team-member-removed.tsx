import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import { EmailDisplayHeading, EmailFinePrint, EmailParagraph } from '../components';

export interface TeamMemberRemovedEmailProps {
  /** The removed member's name (falls back to "there"). */
  memberName?: string;
  /** The org/site they were removed from. */
  orgName: string;
}

// PLATFORM email (sparx → the REMOVED member) — their access to a workspace was
// revoked. A no-CTA courtesy notice so access changes are never silent.
export function TeamMemberRemovedEmail({ memberName, orgName }: TeamMemberRemovedEmailProps) {
  return (
    <PlatformEmailLayout
      preview={`Your access to ${orgName} was removed`}
      footerReason={`You're receiving this because your access to ${orgName} on sparx changed.`}
    >
      <EmailDisplayHeading>Your access was removed</EmailDisplayHeading>
      <EmailParagraph>
        {memberName ? `Hi ${memberName}, ` : ''}your access to <strong>{orgName}</strong> on sparx
        has been removed, so you&apos;ll no longer be able to sign in to that workspace.
      </EmailParagraph>
      <EmailParagraph>
        If you think this was a mistake, reach out to whoever manages {orgName} — they can invite
        you again.
      </EmailParagraph>
      <EmailFinePrint>Any other sparx workspaces you belong to are unaffected.</EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export function teamMemberRemovedSubject(orgName: string): string {
  return `Your access to ${orgName} was removed`;
}
