import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import { EmailCodeBlock, EmailDisplayHeading, EmailFinePrint, EmailParagraph } from '../components';

export interface LoginOtpEmailProps {
  /** The one-time numeric code. */
  code: string;
  /** How long the code is valid for, surfaced to the recipient. */
  expiresInMinutes?: number;
}

export function LoginOtpEmail({ code, expiresInMinutes = 5 }: LoginOtpEmailProps) {
  return (
    <PlatformEmailLayout
      preview="Your sparx sign-in code"
      footerReason="You're receiving this because a sign-in code was requested for your sparx account."
    >
      <EmailDisplayHeading>Your sign-in code</EmailDisplayHeading>
      <EmailParagraph>
        Enter this code to finish signing in. It expires in {expiresInMinutes} minutes and works
        once.
      </EmailParagraph>
      <EmailCodeBlock code={code} />
      <EmailFinePrint>
        If you didn&apos;t try to sign in, you can safely ignore this email — no one can sign in
        with a code they don&apos;t have.
      </EmailFinePrint>
    </PlatformEmailLayout>
  );
}

export const loginOtpSubject = 'Your sparx sign-in code';
