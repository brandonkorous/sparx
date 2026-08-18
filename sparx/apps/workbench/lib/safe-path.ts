/**
 * Reduce an untrusted `callbackURL` query param to a same-origin relative path,
 * or fall back to `/`.
 *
 * The MCP consent guard sends a not-yet-signed-in operator to
 * `/sign-in?callbackURL=/oauth/consent?…` so they land back on consent after
 * authenticating. That value arrives from the URL, so it must never be able to
 * bounce the browser to another origin: we accept only a path that starts with a
 * single `/` (not `//` or `/\`, which browsers read as protocol-relative — an
 * open-redirect). Anything else becomes `/`.
 */
export function safeInternalPath(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0) return '/';
  if (!raw.startsWith('/')) return '/';
  // Reject protocol-relative (`//host`) and backslash (`/\host`) forms — browsers
  // resolve both to another origin.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}
