// The page the confirm-your-email link comes back to, and the page the
// console's band sends an owner to for a new link (sparx persona issue 157).
//
// Sign-up sends the link with `callbackURL: '/verify-email'`; this app hosts
// the sign-in system, so it lands here. There was no page, so a link that
// confirmed the address ended on a 404. Whether the address is confirmed is read
// from the session, never from the URL: the band links here with no `?error`
// too. Better Auth adds `?error=<CODE>` when a link did not confirm.

export function verifyLandingWords(state: { verified: boolean; error: string | null }): {
  confirmed: boolean;
  heading: string;
  lede: string;
} {
  if (state.verified) {
    return {
      confirmed: true,
      heading: 'Your email address is confirmed.',
      lede: 'Thank you. Everything in Piggles is open to you now, including emailing your customers.',
    };
  }
  if (state.error === 'TOKEN_EXPIRED') {
    return {
      confirmed: false,
      heading: 'That link has expired.',
      lede: 'Links to confirm your address work for an hour. Ask for a new one, and use it from the newest email.',
    };
  }
  if (state.error) {
    return {
      confirmed: false,
      heading: 'That link didn’t confirm your address.',
      lede: 'It may have been cut short on its way to you, or it belongs to another account. Ask for a new one.',
    };
  }
  return {
    confirmed: false,
    heading: 'Confirm your email address.',
    lede: 'We’ll email you a link. Press it, and your address is confirmed.',
  };
}

/** What the page says once a new link is on its way. */
export function linkSentWords(email: string): string {
  return `A new link is on its way to ${email}. Open that email and press the link. It works for an hour.`;
}

/**
 * Whether arriving here sends a new link straight away. The console's band says
 * "Send the link again" and can only open this page (the sign-in system lives
 * here, on another site), so it opens it with `?send=1` and the page keeps the
 * button's word: one press, one link. Never for a signed-out visitor or an
 * address that is already confirmed (piggles persona issue 978).
 */
export function sendsOnArrival(state: {
  signedIn: boolean;
  verified: boolean;
  send: string | null;
}): boolean {
  return state.signedIn && !state.verified && state.send === '1';
}
