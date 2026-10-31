import { authProxyHandlers } from '@wizeworks/auth-client-server';

// Every /api/auth/* request lands here: sign-in, sign-up, session lookup,
// password reset, verification. Mounting it at this path means the client SDK
// inside @wizeworks/auth/client needs no baseURL config.
//
// The handler itself runs in api-rest (`/auth/piggles/*`, docs/154), which holds
// the only Better Auth instance. This route forwards each request there and
// relays the answer, cookies included, so the address and the cookie stay
// getpiggles.com's own: every emailed link and the Google redirect URI still
// name this domain.
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
export const { POST, GET } = authProxyHandlers();
