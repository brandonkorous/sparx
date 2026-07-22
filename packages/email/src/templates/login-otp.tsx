import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailCallout, EmailHeading, EmailMuted, EmailParagraph } from '../components';

export interface LoginOtpEmailProps {
  /** The one-time numeric code. */
  code: string;
  /** How long the code is valid for, surfaced to the recipient. */
  expiresInMinutes?: number;
}

export function LoginOtpEmail({ code, expiresInMinutes = 5 }: LoginOtpEmailProps) {
  return (
    <EmailLayout preview="Your sparx sign-in code">
      <Section>
        <EmailHeading>Your sign-in code</EmailHeading>
        <EmailParagraph>
          Enter this code to finish signing in. It expires in {expiresInMinutes} minutes and works
          once.
        </EmailParagraph>
        <EmailCallout tone="info">
          <EmailHeading level={1}>{code}</EmailHeading>
        </EmailCallout>
        <EmailMuted>
          If you didn&apos;t try to sign in, you can safely ignore this email — no one can sign in
          with a code they don&apos;t have.
        </EmailMuted>
      </Section>
    </EmailLayout>
  );
}

export const loginOtpSubject = 'Your sparx sign-in code';
