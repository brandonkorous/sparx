// WHAT A BROADCAST STILL NEEDS BEFORE IT CAN GO OUT.
//
// Its own file, with no imports, because one of these rules is a legal one and
// it had nowhere to be tested from.
//
// ── The rule that went missing ──────────────────────────────────────────────
//
// The Email settings screen says, over an empty box:
//
//     Anti-spam laws (like the US CAN-SPAM Act) require a real physical
//     mailing address in every email you send to a list.
//
// Juniper Row's box is empty. She sent "Autumn drop announcement" to 23 people
// on 2026-08-26. Measured: `email_settings.physical_address` is blank, all 23
// `email_scheduled_sends` rows read `sent`, none carries an error.
//
// Three places in the codebase say that cannot happen:
//
//   * `broadcast-service.ts` — "a broadcast from a tenant with no postal
//     address on file is refused, which is the CAN-SPAM rule"
//   * `docs/120` — "marketing send with no configured physicalAddress /
//     unsubscribe still refuses, unchanged"
//   * the settings screen above
//
// Nothing refuses. The composed footer in `email/src/silica/frame.ts` reads:
//
//     if (opts.marketing) { …unsubscribe line… }            // always
//     if (opts.compliance?.physicalAddress) { …address… }   // only if set
//
// The gate was deleted (docs/120 slice 7) on the grounds that silica composes
// the legal footer into every marketing send, so nothing could be authored
// away. That is TRUE OF THE UNSUBSCRIBE LINK AND ONLY OF THE UNSUBSCRIBE LINK.
// The footer has two halves; one became structural and the other did not, and
// the gate that covered both went with the first
// ([[feedback_a_fix_leaves_its_neighbour_behind]]).
//
// ── Why it is checked HERE and not at dispatch ──────────────────────────────
//
// The old gate refused at the dispatch tick: after the send screen had said it
// went to 23 people, in a worker she cannot see, with nothing to press. A rule
// she can satisfy belongs where she is standing when she can still satisfy it,
// so it is one more line in the list the compose screen already shows:
//
//     Before you can send, this still needs …
//
// The server refuses too — the console is one consumer of the API, not the
// gate — but this is the one she reads.

/** The mailing address the law wants in the footer, as the settings hold it. */
export type MailingAddress = string | null | undefined;

/**
 * Whether a postal address is really there.
 *
 * `undefined` means the settings have not loaded, which is NOT the same as
 * blank, so it never reports missing while it does not yet know
 * ([[feedback_never_present_absence_as_measurement]]).
 */
export function hasMailingAddress(address: MailingAddress): boolean | undefined {
  if (address === undefined) return undefined;
  return (address ?? '').trim() !== '';
}

export interface ReadinessFacts {
  name: string;
  subject: string;
  segmentId: string;
  builderEmailId: string;
  emailUnpublished: boolean;
  /** The chosen email is a built-in one an event sends (an order confirmation,
   *  a payment reminder), which can never go to a list. Only true for a draft
   *  saved before the picker stopped offering them; the server refuses it too. */
  emailBuiltIn: boolean;
  recipientCount: number | undefined;
  /** `undefined` while the settings are still loading. */
  mailingAddress: MailingAddress;
}

/**
 * Everything still standing between this broadcast and the Send button, in the
 * words the screen prints after "this still needs".
 */
export function missingPieces(facts: ReadinessFacts): string[] {
  const missing: string[] = [];
  if (facts.name.trim() === '') missing.push('a name');
  if (facts.subject.trim() === '') missing.push('a subject line');
  if (!facts.segmentId) missing.push('who it goes to');
  if (!facts.builderEmailId) missing.push('an email to send');
  if (facts.emailBuiltIn) {
    missing.push(
      'an email you wrote yourself (the one chosen is sent automatically, one customer at a time)'
    );
  }
  if (facts.emailUnpublished) missing.push('a published email (this one is still a draft)');
  if (facts.segmentId && facts.recipientCount === 0) {
    missing.push('an audience with people in it');
  }
  // Last, and worded so she knows it is not a field on this screen. The others
  // are all things to fix here; this one is somewhere else and would otherwise
  // read as a box she cannot find.
  if (hasMailingAddress(facts.mailingAddress) === false) {
    missing.push('a mailing address on your email settings, which the law requires in the footer');
  }
  return missing;
}
