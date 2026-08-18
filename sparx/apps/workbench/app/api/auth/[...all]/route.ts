import { auth } from '@wizeworks/auth';
import { toNextJsHandler } from 'better-auth/next-js';

// Better Auth catches every /api/auth/* request: sign-in, sign-up, session
// lookup, etc. Mounting it here means the client SDK (better-auth/react inside
// @wizeworks/auth/client) needs no baseURL config.
//
// The session cookie this issues is HOST-ONLY to workbench.sparx.works. That is
// deliberate, not an oversight: the alternative — widening the staff cookie to
// .sparx.works so it is shared with app.sparx.works — would expose the staff
// session to every subdomain including tenant-facing ones, and would force
// api-rest to swap its `origin: true` CORS reflection for an allowlist it cannot
// write (tenant custom domains are unbounded). Signing in twice is the cheaper
// cost. The correct fix later is an OIDC hop between the two apps, not a shared
// cookie. See lib/api/token.ts for how the browser then reaches api-rest.
export const { POST, GET } = toNextJsHandler(auth);
