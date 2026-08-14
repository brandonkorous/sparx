import { auth } from '@sparx/auth';
import { toNextJsHandler } from 'better-auth/next-js';

// Better Auth catches every /api/auth/* request here: sign-in, sign-up, session
// lookup, password reset, verification. Mounting it at this path means the
// client SDK inside @sparx/auth/client needs no baseURL config.
//
// THIS IS THE ONLY PLACE IN PIGGLES THAT MOUNTS IT. getpiggles.com is the auth
// authority; mypiggles.com deliberately does not mount a handler and has no
// sign-in UI, because two apps that can both mint sessions are two apps whose
// sign-out behaviour will eventually disagree. The console receives a session
// through the one-time handoff instead (@piggles/auth-handoff).
//
// The cookie is host-only to getpiggles.com. It cannot be widened to cover
// mypiggles.com even in principle — they are different REGISTRABLE domains, not
// sibling subdomains — which is precisely why the handoff exists rather than a
// shared cookie.
export const { POST, GET } = toNextJsHandler(auth);
