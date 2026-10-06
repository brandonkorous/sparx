// The active-site cookie, bound to the company that set it.
//
// The cookie outlives the session that wrote it: it is a one-year preference and
// signing out does not clear it. So on a shared computer the NEXT person to sign in
// inherited the last person's site id. api-rest ignored it (it fails closed to the
// caller's own primary site), but this console did not: the shell uses the id as
// the key for the saved tab layout, and a brand-new owner opened onto another
// company's 141 tabs, its quote numbers and page names included (sparx persona
// issue 011). The value now carries the tenant that set it, and a reader drops one
// that names anybody else.
//
// A bare site id, written before this, cannot be checked, so it is dropped too:
// that operator lands on their primary site once, then picks their site again.

export const ACTIVE_PROPERTY_COOKIE = 'piggles_active_property';

/** The cookie value for `siteId`, chosen by a member of `tenantId`. */
export function encodeActiveSite(tenantId: string, siteId: string): string {
  return `${tenantId}.${siteId}`;
}

/** The site id the cookie names, or null when it is missing, malformed, or was set
 *  under a different tenant than the one signed in now. */
export function readActiveSite(
  value: string | null | undefined,
  tenantId: string | null | undefined
): string | null {
  if (!value || !tenantId) return null;
  const dot = value.indexOf('.');
  if (dot <= 0) return null;
  if (value.slice(0, dot) !== tenantId) return null;
  return value.slice(dot + 1) || null;
}
