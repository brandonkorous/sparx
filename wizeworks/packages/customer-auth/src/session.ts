// Session cookie constants shared with the api-rest route layer. The token
// itself is now a Better Auth session token (customer_sessions.token); Better
// Auth is configured (server.ts `advanced.cookies.session_token.name`) to
// deliver it in this first-party httpOnly cookie so the site + /api/sparx
// proxy + the /account routes are unchanged from the pre-Better-Auth design.

/** The first-party httpOnly cookie carrying the site session token. */
export const SESSION_COOKIE_NAME = 'sparx_customer_session';

/** Session lifetime (matches server.ts `session.expiresIn`). Sessions slide
 *  forward on use — Better Auth manages the refresh. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Password-reset links expire quickly — surfaced in the email copy. */
export const RESET_TTL_SECONDS = 60 * 60; // 1 hour

/** Default cookie attributes. `secure` is toggled off on dev http by the route
 *  layer; Better Auth sets the cookie itself, so these are for any first-party
 *  cookie the route sets directly (parity with the old design). */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: true,
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
};
