// "Confirm your email address", for the console (sparx persona issue 157).
//
// Until the owner's address is confirmed, the API refuses an email to a whole
// audience, buying a domain and connecting payments once setup is finished.
// Nothing in the console said so, and the refusal pointed at a "dashboard" that
// does not exist. getpiggles.com owns the sign-in system, so the band's door
// leads there, to the page that sends a new link.

export interface EmailViewer {
  email: string;
  emailVerified: boolean;
}

/** The band's sentence and button, or null when there is nothing to say
 *  (confirmed, or not known yet: never claim "unconfirmed" before we know). */
export function verifyEmailNotice(
  viewer: EmailViewer | undefined
): { sentence: string; action: string } | null {
  if (!viewer || viewer.emailVerified) return null;
  return {
    sentence: `Confirm your email address, ${viewer.email}. Until you do, Piggles can’t send an email to a whole audience for you, buy a domain or connect payments.`,
    action: 'Send the link again',
  };
}
