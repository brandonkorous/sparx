// WHICH "WELCOME" IS THIS ONE?
//
// The email list showed two rows reading:
//
//     Welcome    Welcome to {{site.name}}    All your sites    Live
//     Welcome    Welcome to {{site.name}}    All your sites    Not sending yet
//
// Same name, same subject, same scope, same day. Nothing on the row says which
// is which, and the only visible difference is a status pill that answers a
// different question.
//
// This is the SECOND half of a defect whose first half is already fixed.
// `nextFreeName` (email-service) now renames a colliding email as it is written
// — "Welcome (Coastal Studio)" — and its test opens with the same story. But a
// rename on the write path cannot repair rows that were already written:
// measured 2026-09-17, **13 tenants** still hold two emails with one name, and
// the account this was found on is one of them.
//
// So the list has to cope with the rows it is handed. It already holds the fact
// that tells them apart — `key`, documented on `EmailSummary` as "the built-in
// identity of a provisioned default, or null for a custom one" — and drew none
// of it ([[feedback_fetched_but_never_rendered]]).

/** What the row needs to say where it came from. */
export interface EmailOrigin {
  name: string;
  key: string | null;
}

/**
 * The line under an email's name, or null when the name stands on its own.
 *
 * Only shown where a name is SHARED, on purpose: on a tidy account every row is
 * already distinct and a provenance note under each one is noise
 * ([[feedback_no_faded_text]] is about the same instinct — a signal used
 * everywhere stops being a signal).
 *
 * It states an ORIGIN, not a behavior. "Piggles sends this one for you" would be
 * a promise about what happens next, and a keyed email whose automation is
 * paused sends nothing ([[feedback_a_promise_in_copy_is_a_contract]]). Where it
 * came from is true whatever anybody does with it afterwards.
 */
export function emailOriginNote(email: EmailOrigin, all: readonly EmailOrigin[]): string | null {
  const sharesName = all.filter((other) => other.name === email.name).length > 1;
  if (!sharesName) return null;
  return email.key === null ? 'A copy on your account' : 'Comes with Piggles';
}
