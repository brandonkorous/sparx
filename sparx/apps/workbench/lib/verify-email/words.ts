// Confirming the owner's email address: what the console says about it
// (sparx persona issue 157).
//
// Until the address is confirmed, api-rest refuses a list send, a domain
// purchase and connecting payments once setup is finished
// (`requireVerifiedEmail`). The old console had a notice with a resend button
// and a page the link came back to; it was removed, and the workbench had
// neither, so an owner who lost the one email sent at sign-up was locked out
// with nowhere to go, and a link that DID confirm the address landed on "That
// link doesn't open anything".

/** Who is signed in, as far as this notice needs. `undefined` while it loads. */
export interface EmailViewer {
  email: string;
  emailVerified: boolean;
}

export interface VerifyNotice {
  title: string;
  body: string;
  action: string;
}

/** The notice at the top of the console, or null when there is nothing to say
 *  (confirmed, or not known yet: never claim "unconfirmed" before we know). */
export function verifyEmailNotice(viewer: EmailViewer | undefined): VerifyNotice | null {
  if (!viewer || viewer.emailVerified) return null;
  return {
    title: 'Confirm your email address.',
    body: `We sent a link to ${viewer.email} when you signed up. Until you press it, sparx can’t send an email to a whole audience for you, buy a domain, or connect payments.`,
    action: 'Send the link again',
  };
}

/** What the notice says once a new link is on its way. */
export function linkSentWords(email: string): string {
  return `A new link is on its way to ${email}. Open that email and press the link. It works for an hour.`;
}

/** The page the link comes back to, and the page a console sends an owner to
 *  for a new link. Whether the address is confirmed is read from the session,
 *  never from the URL: a visit with no `?error` is not proof of anything.
 *  Better Auth adds `?error=<CODE>` when a link did not confirm. */
export function verifyLandingWords(state: { verified: boolean; error: string | null }): {
  confirmed: boolean;
  title: string;
  body: string;
} {
  if (state.verified) {
    return {
      confirmed: true,
      title: 'Your email address is confirmed',
      body: 'Thank you. Everything is open to you now, including sending email to your customers.',
    };
  }
  if (state.error === 'TOKEN_EXPIRED') {
    return {
      confirmed: false,
      title: 'That link has expired',
      body: 'Links to confirm your address work for an hour. Ask for a new one below, and use it from the newest email.',
    };
  }
  if (state.error) {
    return {
      confirmed: false,
      title: 'That link didn’t confirm your address',
      body: 'It may have been cut short on its way to you, or it belongs to another account. Ask for a new one below.',
    };
  }
  return {
    confirmed: false,
    title: 'Confirm your email address',
    body: 'We’ll email you a link. Press it, and your address is confirmed.',
  };
}
