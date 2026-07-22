import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailButton, EmailHeading, EmailLink, EmailMuted, EmailParagraph } from '../components';

export interface MagicLinkEmailProps {
  /** The one-time signed sign-in URL. */
  magicUrl: string;
  /** How long the link is valid for, surfaced to the recipient. */
  expiresInMinutes?: number;
}

export function MagicLinkEmail({ magicUrl, expiresInMinutes = 15 }: MagicLinkEmailProps) {
  return (
    <EmailLayout preview="Your sparx sign-in link">
      <Section>
        <EmailHeading>Sign in to sparx</EmailHeading>
        <EmailParagraph>
          Use the button below to sign in. No password needed — this link is all it takes. It
          expires in {expiresInMinutes} minutes and works once.
        </EmailParagraph>
        <EmailButton href={magicUrl}>Sign in to sparx</EmailButton>
        <EmailMuted>If the button doesn&apos;t work, paste this URL into your browser:</EmailMuted>
        <EmailParagraph flush>
          <EmailLink href={magicUrl}>{magicUrl}</EmailLink>
        </EmailParagraph>
        <EmailMuted>
          If you didn&apos;t try to sign in, you can safely ignore this email — no one can sign in
          without this link.
        </EmailMuted>
      </Section>
    </EmailLayout>
  );
}

export const magicLinkSubject = 'Your sparx sign-in link';
