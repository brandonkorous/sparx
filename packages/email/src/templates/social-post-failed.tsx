import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailButton, EmailCallout, EmailHeading, EmailMuted, EmailParagraph } from '../components';

/**
 * "Your post didn't go out."
 *
 * The email that closes the social module's worst gap: a scheduled post failing at 6am
 * on a Sunday and nobody finding out until they happened to open the app. It has one
 * job — say plainly what did and did not reach an audience, and give one button that
 * fixes it.
 *
 * Deliberately covers BOTH total and partial failure, because to the person reading it
 * those are the same event ("something I planned didn't happen") and only the wording
 * differs. A partial failure is arguably the more urgent one: it looks like a success in
 * every list until you open it.
 */
export interface SocialPostFailedEmailProps {
  /** The post's opening words, so it is recognizable without opening anything. */
  excerpt: string;
  /** Destinations that did NOT go out, with the reason in plain words. */
  failed: { name: string; reason?: string }[];
  /** Destinations that DID — empty for a total failure. */
  succeeded?: string[];
  /** Deep link into the composer for this post. */
  postUrl: string;
  /** When it was meant to go out, already formatted for a human. */
  scheduledFor?: string;
}

export function SocialPostFailedEmail({
  excerpt,
  failed,
  succeeded = [],
  postUrl,
  scheduledFor,
}: SocialPostFailedEmailProps) {
  const partial = succeeded.length > 0;
  const failedLabel = failed.length === 1 ? 'account' : 'accounts';

  return (
    <EmailLayout
      preview={
        partial ? `Your post reached some accounts but not all of them` : `Your post didn't go out`
      }
    >
      <Section>
        <EmailHeading>
          {partial ? 'Your post only reached some accounts' : "Your post didn't go out"}
        </EmailHeading>

        <EmailCallout tone={partial ? 'warn' : 'warn'}>
          &ldquo;{excerpt}&rdquo;
          {scheduledFor ? ` — due ${scheduledFor}` : null}
        </EmailCallout>

        <EmailParagraph>
          {partial ? (
            <>
              It posted to {succeeded.join(', ')}, but {failed.length} {failedLabel} did not get it.
              Nothing has been posted twice — you can send it to just the ones that missed out.
            </>
          ) : (
            <>
              Nothing was posted to any of your accounts. Your post is safe and unchanged — you can
              fix what went wrong and send it again.
            </>
          )}
        </EmailParagraph>

        {failed.map((target) => (
          <EmailParagraph key={target.name}>
            <strong>{target.name}</strong>
            {target.reason ? ` — ${target.reason}` : null}
          </EmailParagraph>
        ))}

        <EmailButton href={postUrl}>Open the post</EmailButton>

        <EmailMuted>
          You&apos;re getting this because a post you scheduled could not be published. Anything
          that did go out is still live on those accounts.
        </EmailMuted>
      </Section>
    </EmailLayout>
  );
}

export function socialPostFailedSubject(excerpt: string, partial: boolean): string {
  const short = excerpt.length > 40 ? `${excerpt.slice(0, 39)}…` : excerpt;
  return partial ? `Only some accounts got “${short}”` : `Your post didn’t go out: “${short}”`;
}
