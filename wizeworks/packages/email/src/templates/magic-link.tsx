import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailDisplayHeading,
  EmailFallbackLink,
  EmailFinePrint,
  EmailParagraph,
  usePlatformName,
} from '../components';

export interface MagicLinkEmailProps {
  /** The one-time signed sign-in URL. */
  magicUrl: string;
  /** How long the link is valid for, surfaced to the recipient. */
  expiresInMinutes?: number;
}

export function MagicLinkEmail({ magicUrl, expiresInMinutes = 15 }: MagicLinkEmailProps) {
  const platform = usePlatformName();
  return (
    <PlatformEmailLayout
      preview={`Your ${platform} sign-in link`}
      footerReason={`You're receiving this because a sign-in link was requested for your ${platform} account.`}
    >
      <EmailDisplayHeading>Sign in to {platform}</EmailDisplayHeading>
      <EmailParagraph>
        Use the button below to sign in. No password needed — this link is all it takes. It expires
        in {expiresInMinutes} minutes and works once.
      </EmailParagraph>
      <EmailActionButton href={magicUrl}>Sign in to {platform}</EmailActionButton>
      <EmailFallbackLink url={magicUrl} />
      <EmailFinePrint>
        If you didn&apos;t try to sign in, you can safely ignore this email — no one can sign in
        without this link.
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export const magicLinkSubject = (platform: string) => `Your ${platform} sign-in link`;
