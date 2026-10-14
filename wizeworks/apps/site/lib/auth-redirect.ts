// Where the sign-in and create-account pages send somebody who is ALREADY signed in
// (sparx persona issue 189). Teodora, signed in, opened the sign-in page from an old
// link and was shown an empty form as if she were signed out.

import type { SessionStatus } from './shop-reach';

/** The page to go on to, or null to show the form. Only a session the provider
 *  has confirmed moves anybody: "loading" and "unreachable" show the form. */
export function signedInDestination(status: SessionStatus, redirect: string | null): string | null {
  if (status !== 'authenticated') return null;
  // A path on this site only. Anything else goes to the account.
  return redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/account';
}
