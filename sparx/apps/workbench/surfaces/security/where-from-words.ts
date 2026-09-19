// WHERE A SIGNED-IN DEVICE CONNECTED FROM, WHEN THERE IS AN ANSWER.
//
// The Devices signed in card read:
//
//     Chrome on Windows · This device
//     From :: · Active 5 hours ago · Signed in 3 weeks ago
//
// `::` is not a place. It is IPv6 for "all zeros" — what a socket reports when
// it has no remote address to report, which is what happens behind a proxy that
// forwards no client address, and on a machine talking to itself.
//
// The card's whole job is one question:
//
//     Every device currently signed in to your account. If you see one you do
//     not recognize, sign it out and change your password.
//
// So a line on it is either evidence she can recognize a device by, or it is
// nothing, and printing a placeholder as though it were evidence is the worst
// of the three ([[feedback_never_present_absence_as_measurement]]).
//
// The user agent beside it was already handled — `describeDevice` answers
// "Unknown device" rather than printing the raw string. The address next to it
// got no such treatment, which is the usual shape: the thinking was done for
// one field and not for the one sitting next to it
// ([[feedback_a_fix_leaves_its_neighbour_behind]]).
//
// And then it happened again, to this file. Both answers lived only on the
// Devices card, so the form-reply pane — the other screen in the console that
// shows a stranger's address and browser — printed "Their IP address ::1" over
// a raw Mozilla/5.0 string, on 7 of the 7 submissions that exist (issue 628).
// `describeDevice` now lives here too, so the pair travels together.
//
// Its own file with no imports so the list below can be tested. A guard that
// lives inside a component is a guard nobody can prove.

/**
 * Addresses that mean "nowhere was recorded".
 *
 * Not a blocklist of suspicious values — every one of these is what some layer
 * writes when it has nothing to write.
 *
 *   `::`         IPv6 unspecified — no remote address on the socket
 *   `::1`        IPv6 loopback — the machine talking to itself
 *   `0.0.0.0`    IPv4 unspecified, the same thing
 *   `127.0.0.1`  IPv4 loopback
 *   `::ffff:127.0.0.1`  loopback as an IPv4-mapped IPv6 address, which is how
 *                Node reports it on a dual-stack socket
 *   `unknown`    what several proxies put in `x-forwarded-for` rather than
 *                omitting the header
 */
const NOWHERE = new Set([
  '::',
  '::1',
  '::ffff:0.0.0.0',
  '::ffff:127.0.0.1',
  '0.0.0.0',
  '127.0.0.1',
  'unknown',
  'null',
  'undefined',
]);

/**
 * The address a device connected from, or null when nothing was recorded.
 *
 * A forwarded chain (`client, proxy1, proxy2`) keeps its FIRST entry, which is
 * the client; the rest are the hops it came through and are not where she is.
 */
export function whereFrom(ipAddress: string | null | undefined): string | null {
  const raw = (ipAddress ?? '').trim();
  if (raw === '') return null;
  const first = (raw.split(',')[0] ?? '').trim();
  if (first === '') return null;
  return NOWHERE.has(first.toLowerCase()) ? null : first;
}

/** `From <address> · `, or nothing at all. The trailing separator belongs to
 *  the clause, so dropping the clause does not leave a stray dot behind. */
export function whereFromPrefix(ipAddress: string | null | undefined): string {
  const from = whereFrom(ipAddress);
  return from === null ? '' : `From ${from} · `;
}

/** The same fact as a sentence, for the confirm dialog that asks whether to
 *  sign a device out. Empty when there is nothing to say. */
export function whereFromSentence(ipAddress: string | null | undefined): string {
  const from = whereFrom(ipAddress);
  return from === null ? '' : `It was last seen from ${from}. `;
}

/**
 * Turn a raw user-agent string into "Chrome on macOS" — the two facts a person
 * actually recognises about a device. Best-effort and deliberately coarse: the
 * goal is "is this the laptop I'm on or something I don't know?", not a forensic
 * breakdown. An unparseable or absent agent falls back to an honest "Unknown
 * device" rather than a made-up guess.
 *
 * It lived in `security-data.ts` beside the hooks, which is why the form-reply
 * pane four folders away printed the whole string instead — a data module full
 * of react-query is not something another surface reaches for. Here it sits
 * beside the address it is always shown next to, and imports nothing, so both
 * are testable on the node seat (issue 628).
 */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent || userAgent.trim() === '') return 'Unknown device';

  const browser = /edg\//i.test(userAgent)
    ? 'Edge'
    : /opr\/|opera/i.test(userAgent)
      ? 'Opera'
      : /chrome|crios/i.test(userAgent)
        ? 'Chrome'
        : /firefox|fxios/i.test(userAgent)
          ? 'Firefox'
          : /safari/i.test(userAgent)
            ? 'Safari'
            : null;

  const os = /windows/i.test(userAgent)
    ? 'Windows'
    : /iphone|ipad|ipod/i.test(userAgent)
      ? 'iOS'
      : /mac os x|macintosh/i.test(userAgent)
        ? 'macOS'
        : /android/i.test(userAgent)
          ? 'Android'
          : /linux/i.test(userAgent)
            ? 'Linux'
            : null;

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return 'Unknown device';
}
