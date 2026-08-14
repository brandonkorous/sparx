// Narrow an untrusted `?next=` to something that can only point back inside the
// app that reads it.
//
// Everything that redirects after sign-in reads a destination out of the query
// string, and a destination out of the query string is an open redirect unless
// something says otherwise. The specific danger for the Piggles auth path is
// worse than the usual one: a link that signs somebody in and then lands them on
// an attacker's page is a credible phishing flow, because the sign-in was real.
// The console makes it sharper still — its `?next=` rides INSIDE a handoff token
// that grants a session, so a destination that escapes the app is a destination
// that receives one.
//
// Rejected, and each of these is a real bypass rather than a hypothetical:
//   • `https://evil.com`      — absolute URL
//   • `//evil.com`            — protocol-relative; a browser treats it as absolute
//   • `/\evil.com`            — some parsers normalise the backslash to a slash
//   • `javascript:…`          — not a navigation at all
//
// Anything that is not a plain internal path becomes the fallback rather than an
// error. A person who followed a mangled link should still end up signed in and
// somewhere sensible.
//
// Lives in @piggles/config rather than in one app because BOTH Piggles apps sit
// on the redirect chain — the account app mints the destination and the console
// consumes it — and a guard that is stricter on one end than the other is a
// guard with a hole in the middle.

export function safeInternalPath(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
