import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailAlert,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailParagraph,
} from '../components';

/**
 * "One of your accounts needs reconnecting."
 *
 * Sent the moment a connected account stops working — a permission that ran out, or one
 * someone removed on the platform's own settings screen. The point is that it arrives
 * BEFORE a post is lost: the health sweep notices on its own schedule rather than
 * everyone finding out from the first send that failed.
 *
 * It says what stops working and what doesn't, because "reconnect your account" with no
 * context reads like a phishing email — and the honest answer ("nothing you have already
 * posted is affected") is genuinely reassuring.
 */
export interface SocialConnectionExpiredEmailProps {
  /** "Facebook Page", "Instagram" — the platform in plain words. */
  platformName: string;
  /** The connected account's own name, when we have it. */
  accountName?: string;
  /** How many posts are queued against this account and will now fail. */
  scheduledCount?: number;
  /** Deep link to the Connections screen. */
  reconnectUrl: string;
}

export function SocialConnectionExpiredEmail({
  platformName,
  accountName,
  scheduledCount = 0,
  reconnectUrl,
}: SocialConnectionExpiredEmailProps) {
  const label = accountName ? `${accountName} (${platformName})` : platformName;

  return (
    <PlatformEmailLayout
      preview={`${platformName} needs reconnecting`}
      footerReason={`You're receiving this because your ${platformName} connection stopped working.`}
    >
      <EmailDisplayHeading>{platformName} needs reconnecting</EmailDisplayHeading>

      <EmailAlert tone="warn" title={`sparx can no longer post to ${label}`}>
        The permission this account gave sparx ran out, or it was removed from the platform&apos;s
        own settings.
      </EmailAlert>

      <EmailParagraph>
        Reconnecting takes a few seconds — you sign in to {platformName} again and everything picks
        up where it left off.
      </EmailParagraph>

      {scheduledCount > 0 ? (
        <EmailParagraph>
          {scheduledCount === 1
            ? 'There is 1 post waiting to go out to this account.'
            : `There are ${scheduledCount} posts waiting to go out to this account.`}{' '}
          They won&apos;t be published until it&apos;s reconnected.
        </EmailParagraph>
      ) : null}

      <EmailActionButton href={reconnectUrl}>Reconnect {platformName}</EmailActionButton>

      <EmailFinePrint>
        Nothing you&apos;ve already posted is affected — it stays live on {platformName}. Your other
        connected accounts keep working normally.
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export function socialConnectionExpiredSubject(platformName: string): string {
  return `Reconnect ${platformName} to keep posting`;
}
